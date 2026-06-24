import { v4 as uuidv4 } from 'uuid'
import type { NetworkTopology, NetworkNode, FirewallRule, ServiceConfig, RoutingTableEntry } from '../types'

// Realistic application-layer response banner for a reached service
function serviceBanner(svc: ServiceConfig, node: NetworkNode, dstIp: string): string {
  const host = node.config.hostname ?? node.label
  switch (svc.name.toUpperCase()) {
    case 'HTTP':
      return `HTTP/1.1 200 OK — ${host} served "${node.config.webPage?.title ?? 'It works!'}"`
    case 'HTTPS':
      return `TLS 1.3 handshake OK → HTTP/1.1 200 OK — "${node.config.webPage?.title ?? 'It works!'}"`
    case 'SSH':
      return `SSH-2.0-OpenSSH_9.6 — secure shell session established with ${host}`
    case 'FTP':
      return `220 ${host} FTP service ready`
    case 'SMTP':
      return `220 ${host} ESMTP mail service ready`
    case 'DNS':
      return `DNS service on ${host} answered the query`
    case 'TELNET':
      return `Telnet session opened to ${host} (${dstIp})`
    case 'RDP':
      return `RDP connection negotiated with ${host}`
    default:
      return `${svc.name} service on ${host} (${dstIp}:${svc.port}) responded ✓`
  }
}

export interface SendPacketRequest {
  topologyId?: string
  srcNodeId: string
  dstNodeId: string
  protocol: 'tcp' | 'udp' | 'icmp'
  srcPort?: number
  dstPort?: number
  ttl?: number
}

export type HopAction =
  | 'start'
  | 'switch_forward'
  | 'route'
  | 'firewall_allow'
  | 'firewall_deny'
  | 'firewall_drop'
  | 'delivered'
  | 'ttl_exceeded'
  | 'no_route'
  | 'port_closed'

export interface TraceHop {
  step: number
  nodeId: string
  nodeName: string
  nodeType: string
  action: HopAction
  detail: string
  firewallRule?: FirewallRule
  ingressInterface?: string
  egressInterface?: string
  latencyMs: number
  edgeId?: string
}

export interface TraceResult {
  id: string
  success: boolean
  blocked: boolean
  blockedAt?: string
  blockedBy?: string
  dropType?: 'deny' | 'drop'
  path: string[]
  edgePath: string[]
  hops: TraceHop[]
  totalLatencyMs: number
  packet: {
    srcNodeId: string
    dstNodeId: string
    srcIp: string
    dstIp: string
    protocol: string
    srcPort?: number
    dstPort?: number
    ttl: number
  }
  timestamp: number
}

// ── IP utilities ───────────────────────────────────────────────────────────────

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, o) => (acc << 8) | parseInt(o, 10), 0) >>> 0
}

function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const [network, prefixStr] = cidr.split('/')
    const prefix = parseInt(prefixStr, 10)
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return false
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
    return (ipToInt(ip) & mask) === (ipToInt(network) & mask)
  } catch { return false }
}

function matchIp(ip: string, pattern: string): boolean {
  if (!pattern || pattern === 'any' || pattern === '0.0.0.0/0') return true
  if (pattern === ip) return true
  if (pattern.includes('/')) return ipInCidr(ip, pattern)
  return false
}

// RFC 1918 private space (NOT loopback/link-local — those are special-use)
function isPrivateIpAddr(ip: string): boolean {
  return ipInCidr(ip, '10.0.0.0/8') || ipInCidr(ip, '172.16.0.0/12') || ipInCidr(ip, '192.168.0.0/16')
}

// Derive the traversal direction relative to the trust boundary so that
// egress ('out') rules actually take effect (was hard-coded to 'in').
function fwDirection(srcIp: string, dstIp: string): 'in' | 'out' {
  const sp = isPrivateIpAddr(srcIp)
  const dp = isPrivateIpAddr(dstIp)
  if (sp && !dp) return 'out'   // internal → Internet (egress)
  if (!sp && dp) return 'in'    // Internet → internal (ingress)
  return 'in'                   // lateral / east-west
}

// Longest-prefix-match route selection (RFC 1812), default route last.
function pickRoute(routes: RoutingTableEntry[] | undefined, dstIp: string): RoutingTableEntry | undefined {
  if (!routes?.length) return undefined
  let best: RoutingTableEntry | undefined
  let bestLen = -1
  for (const r of routes) {
    const len = maskToCidr(r.mask)
    const isDefault = (r.destination === '0.0.0.0' && len === 0) || r.type === 'default'
    const matches = isDefault || matchIp(dstIp, `${r.destination}/${len}`)
    if (!matches) continue
    const effLen = isDefault ? 0 : len
    if (effLen > bestLen) { best = r; bestLen = effLen }
  }
  return best
}

function matchPort(port: number | undefined, pattern: string): boolean {
  if (!pattern || pattern === 'any') return true
  if (port === undefined) return true
  if (pattern.includes(','))
    return pattern.split(',').some(p => parseInt(p.trim(), 10) === port)
  if (pattern.includes('-')) {
    const [lo, hi] = pattern.split('-').map(Number)
    return port >= lo && port <= hi
  }
  const n = parseInt(pattern, 10)
  return !isNaN(n) && n === port
}

function matchProtocol(proto: string, pattern: string): boolean {
  if (!pattern || pattern === 'any') return true
  return proto.toLowerCase() === pattern.toLowerCase()
}

function checkFirewallRules(
  rules: FirewallRule[],
  srcIp: string,
  dstIp: string,
  protocol: string,
  dstPort: number | undefined,
  direction: 'in' | 'out',
): { action: 'allow' | 'deny' | 'drop' | 'reject'; rule: FirewallRule } | null {
  const sorted = [...rules].filter(r => r.enabled).sort((a, b) => a.priority - b.priority)
  for (const rule of sorted) {
    const dirMatch = rule.direction === 'both' || rule.direction === direction
    if (!dirMatch) continue
    if (
      matchIp(srcIp, rule.srcIp) &&
      matchIp(dstIp, rule.dstIp) &&
      matchProtocol(protocol, rule.protocol) &&
      matchPort(dstPort, rule.dstPort)
    ) {
      return { action: rule.action, rule }
    }
  }
  return null
}

// ── Graph utilities ────────────────────────────────────────────────────────────

interface GraphEdge { edgeId: string; neighborId: string; latency: number }
type Graph = Map<string, GraphEdge[]>

function buildGraph(topology: NetworkTopology): Graph {
  const g: Graph = new Map()
  for (const n of topology.nodes) g.set(n.id, [])
  for (const e of topology.edges) {
    const latency = parseFloat(e.config.latency ?? '1') || 1
    g.get(e.source)?.push({ edgeId: e.id, neighborId: e.target, latency })
    g.get(e.target)?.push({ edgeId: e.id, neighborId: e.source, latency })
  }
  return g
}

function bfsPath(
  graph: Graph,
  src: string,
  dst: string,
): { nodePath: string[]; edgePath: string[] } | null {
  if (src === dst) return { nodePath: [src], edgePath: [] }
  const visited = new Set<string>([src])
  const queue: { nodeId: string; nodePath: string[]; edgePath: string[] }[] = [
    { nodeId: src, nodePath: [src], edgePath: [] },
  ]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const { edgeId, neighborId, } of graph.get(current.nodeId) ?? []) {
      if (visited.has(neighborId)) continue
      visited.add(neighborId)
      const nodePath = [...current.nodePath, neighborId]
      const edgePath = [...current.edgePath, edgeId]
      if (neighborId === dst) return { nodePath, edgePath }
      queue.push({ nodeId: neighborId, nodePath, edgePath })
    }
  }
  return null
}

function getNodeIp(node: NetworkNode): string {
  return node.config.interfaces?.[0]?.ipAddress ?? ''   // '' = unnumbered (no fabricated/invalid IPs)
}

function randLatency(base: number): number {
  return parseFloat((base + Math.random() * base * 0.3).toFixed(2))
}

// ── Main trace function ────────────────────────────────────────────────────────

export function tracePacket(
  topology: NetworkTopology,
  req: SendPacketRequest,
): TraceResult {
  const id = uuidv4()
  const timestamp = Date.now()
  const ttl = req.ttl ?? 64

  const srcNode = topology.nodes.find(n => n.id === req.srcNodeId)
  const dstNode = topology.nodes.find(n => n.id === req.dstNodeId)

  if (!srcNode || !dstNode) {
    return makeError(id, timestamp, req, 'Source or destination node not found')
  }
  if (srcNode.config.powered === false) {
    return makeError(id, timestamp, req, `${srcNode.config.hostname ?? srcNode.label} is powered off`)
  }
  if (dstNode.config.powered === false) {
    return makeError(id, timestamp, req, `${dstNode.config.hostname ?? dstNode.label} is powered off`)
  }

  // Resolve addresses. A host with no IP can't communicate (it must DHCP first).
  // Internet-facing nodes are treated as publicly addressed.
  const isInternet = (n: NetworkNode) => n.type === 'cloud' || n.type === 'www' || n.type === 'isp'
  let srcIp = getNodeIp(srcNode)
  let dstIp = getNodeIp(dstNode)
  if (!srcIp) {
    if (isInternet(srcNode)) srcIp = '198.51.100.1'
    else return makeError(id, timestamp, req, `${srcNode.config.hostname ?? srcNode.label} has no IP address — power it on / run DHCP first`)
  }
  if (!dstIp) {
    if (isInternet(dstNode)) dstIp = '203.0.113.10'
    else return makeError(id, timestamp, req, `${dstNode.config.hostname ?? dstNode.label} has no IP address`)
  }

  const graph = buildGraph(topology)
  const pathResult = bfsPath(graph, req.srcNodeId, req.dstNodeId)

  if (!pathResult) {
    return makeError(id, timestamp, req, 'No path found between nodes')
  }

  const { nodePath, edgePath } = pathResult
  const hops: TraceHop[] = []
  let totalLatency = 0
  let blocked = false
  let blockedAt: string | undefined
  let blockedBy: string | undefined
  let dropType: 'deny' | 'drop' | undefined

  // Get edge latencies for each hop
  const edgeLatencyMap = new Map<string, number>()
  for (const e of topology.edges) {
    edgeLatencyMap.set(e.id, parseFloat(e.config.latency ?? '1') || 1)
  }

  // ── Hop 0: start ──────────────────────────────────────────────────────────
  hops.push({
    step: 0,
    nodeId: srcNode.id,
    nodeName: srcNode.config.hostname ?? srcNode.label,
    nodeType: srcNode.type,
    action: 'start',
    detail: `Sending ${req.protocol.toUpperCase()} packet from ${srcIp}${req.dstPort ? `:*` : ''} to ${dstIp}${req.dstPort ? `:${req.dstPort}` : ''} (TTL=${ttl})`,
    latencyMs: 0,
    edgeId: edgePath[0],
  })

  // ── Walk the path ─────────────────────────────────────────────────────────
  let l3Hops = 0   // TTL is only decremented by Layer-3 devices (RFC 791)
  for (let i = 1; i < nodePath.length; i++) {
    const node = topology.nodes.find(n => n.id === nodePath[i])
    if (!node) continue

    const edgeId = edgePath[i - 1]
    const linkLatency = edgeLatencyMap.get(edgeId) ?? 1
    const hopLatency = randLatency(linkLatency)
    totalLatency += hopLatency

    const isDestination = i === nodePath.length - 1
    const nodeName = node.config.hostname ?? node.label
    const isL3 = node.type === 'router' || node.type === 'l3switch' || node.type === 'firewall'

    // ── TTL: only routers / L3 switches / firewalls decrement it ─────────────
    if (isL3) {
      l3Hops++
      if (l3Hops > ttl) {
        hops.push({
          step: i, nodeId: node.id, nodeName, nodeType: node.type,
          action: 'ttl_exceeded',
          detail: `TTL expired in transit at ${nodeName} (exceeded ${ttl} L3 hops)`,
          latencyMs: hopLatency, edgeId,
        })
        blocked = true; blockedAt = nodeName; blockedBy = 'TTL exceeded'
        break
      }
    }

    // ── Powered-off device on the path ───────────────────────────────────────
    if (node.config.powered === false) {
      hops.push({
        step: i, nodeId: node.id, nodeName, nodeType: node.type,
        action: 'no_route',
        detail: `${nodeName} is powered off — packet dropped`,
        latencyMs: hopLatency, edgeId,
      })
      blocked = true
      blockedAt = nodeName
      blockedBy = 'Device powered off'
      break
    }

    // ── Firewall node ───────────────────────────────────────────────────────
    if (node.type === 'firewall' && node.config.firewallRules?.length) {
      const direction = fwDirection(srcIp, dstIp)
      const match = checkFirewallRules(
        node.config.firewallRules,
        srcIp,
        dstIp,
        req.protocol,
        req.dstPort,
        direction,
      )

      // No matching rule → implicit deny-all (real firewalls deny by default)
      const denied = !match || match.action !== 'allow'
      if (denied) {
        const action: HopAction = match?.action === 'drop' ? 'firewall_drop' : 'firewall_deny'
        const reason = match
          ? `Rule #${match.rule.priority} "${match.rule.description}" — ${match.action.toUpperCase()}`
          : 'Implicit deny (no matching rule)'
        hops.push({
          step: i, nodeId: node.id, nodeName, nodeType: node.type, action,
          detail: `${reason} [${direction}] ${req.protocol.toUpperCase()} ${srcIp} → ${dstIp}${req.dstPort ? `:${req.dstPort}` : ''}`,
          firewallRule: match?.rule,
          ingressInterface: node.config.interfaces?.[0]?.name,
          latencyMs: hopLatency, edgeId,
        })
        blocked = true
        blockedAt = nodeName
        blockedBy = match ? match.rule.description : 'Implicit deny (no matching rule)'
        dropType = match?.action === 'drop' ? 'drop' : 'deny'
        break
      }
      // Source-NAT at the firewall if it is the Internet edge
      const nextNodeF = topology.nodes.find(n => n.id === nodePath[i + 1])
      let fwNat = ''
      if (nextNodeF && isInternet(nextNodeF) && isPrivateIpAddr(srcIp) && !isPrivateIpAddr(dstIp)) {
        const pub = node.config.interfaces?.map(x => x.ipAddress).find(ip => ip && !isPrivateIpAddr(ip)) ?? '203.0.113.1'
        fwNat = `  ·  NAT ${srcIp} → ${pub}`
        srcIp = pub
      }
      hops.push({
        step: i, nodeId: node.id, nodeName, nodeType: node.type, action: 'firewall_allow',
        detail: `Rule #${match.rule.priority} "${match.rule.description}" — ALLOW [${direction}] ${req.protocol.toUpperCase()} ${srcIp}→${dstIp}${fwNat}`,
        firewallRule: match.rule,
        latencyMs: hopLatency, edgeId,
      })
    }
    // ── Router / Layer-3 switch ───────────────────────────────────────────────
    else if (node.type === 'router' || node.type === 'l3switch') {
      const hasTable = (node.config.routingTable?.length ?? 0) > 0
      const route = pickRoute(node.config.routingTable, dstIp)   // longest-prefix match

      // With a routing table configured, enforce it — no matching entry = drop
      if (hasTable && !route && !isDestination) {
        hops.push({
          step: i, nodeId: node.id, nodeName, nodeType: node.type, action: 'no_route',
          detail: `No route to host ${dstIp} — ${node.config.routingTable!.length} route(s) in table, none match`,
          latencyMs: hopLatency, edgeId,
        })
        blocked = true; blockedAt = nodeName; blockedBy = `No route to ${dstIp}`
        break
      }

      // Source-NAT/PAT at the Internet edge (next hop is the public Internet)
      const nextNodeR = topology.nodes.find(n => n.id === nodePath[i + 1])
      let natNote = ''
      if (!isDestination && nextNodeR && isInternet(nextNodeR) && isPrivateIpAddr(srcIp) && !isPrivateIpAddr(dstIp)) {
        const publicIp = node.config.interfaces?.map(x => x.ipAddress).find(ip => ip && !isPrivateIpAddr(ip)) ?? '203.0.113.1'
        natNote = `  ·  NAT ${srcIp} → ${publicIp}`
        srcIp = publicIp   // translated for the remaining outbound hops
      }

      const nextHop = nodePath[i + 1]
        ? (topology.nodes.find(n => n.id === nodePath[i + 1])?.config.hostname ?? nodePath[i + 1])
        : 'destination'

      hops.push({
        step: i, nodeId: node.id, nodeName, nodeType: node.type,
        action: isDestination ? 'delivered' : 'route',
        detail: isDestination
          ? `Packet delivered to ${nodeName} (${dstIp})`
          : route
            ? `Longest-prefix match: ${route.type} route ${route.destination}/${maskToCidr(route.mask)} → next hop ${nextHop} (iface ${route.interface ?? node.config.interfaces?.[0]?.name ?? 'eth0'})${natNote}`
            : `Forwarding (directly connected — no routing table configured) → ${nextHop}${natNote}`,
        latencyMs: hopLatency, edgeId,
      })
    }
    // ── Switch / Hub / Wi-Fi AP ──────────────────────────────────────────────
    else if (node.type === 'switch' || node.type === 'hub' || node.type === 'wifiap') {
      const l2 = node.type === 'wifiap' ? 'Wireless (802.11) bridging' : 'Layer-2 forwarding'
      hops.push({
        step: i,
        nodeId: node.id,
        nodeName,
        nodeType: node.type,
        action: 'switch_forward',
        detail: `${l2} via ${nodeName} — MAC address lookup → forwarding frame`,
        latencyMs: hopLatency,
        edgeId,
      })
    }
    // ── DHCP / DNS service ────────────────────────────────────────────────────
    else if (node.type === 'dhcp' || node.type === 'dns') {
      const svc = node.type === 'dhcp' ? 'DHCP' : 'DNS'
      let detail: string
      if (isDestination) {
        if (node.type === 'dns') {
          const recs = node.config.dns?.records?.length ?? 0
          detail = node.config.dns?.enabled
            ? `DNS query received by ${nodeName} — resolving against ${recs} record(s)`
            : `Reached ${nodeName}, but its DNS service is disabled`
        } else {
          detail = node.config.dhcp?.enabled
            ? `DHCP request received by ${nodeName} — pool ${node.config.dhcp.poolStart}–${node.config.dhcp.poolEnd}`
            : `Reached ${nodeName}, but its DHCP service is disabled`
        }
      } else {
        detail = `Passing through ${svc} server ${nodeName}`
      }
      hops.push({
        step: i,
        nodeId: node.id,
        nodeName,
        nodeType: node.type,
        action: isDestination ? 'delivered' : 'switch_forward',
        detail,
        latencyMs: hopLatency,
        edgeId,
      })
    }
    // ── Internet / WWW / ISP ──────────────────────────────────────────────────
    else if (node.type === 'cloud' || node.type === 'www' || node.type === 'isp') {
      hops.push({
        step: i,
        nodeId: node.id,
        nodeName,
        nodeType: node.type,
        action: isDestination ? 'delivered' : 'route',
        detail: isDestination
          ? `Packet reached the public Internet (${nodeName})`
          : `Forwarding across the Internet / WAN via ${nodeName}`,
        latencyMs: hopLatency,
        edgeId,
      })
    }
    // ── Layer-7 delivery devices (Load Balancer / Reverse Proxy / API Gateway) ─
    else if (node.type === 'load_balancer' || node.type === 'proxy' || node.type === 'api_gateway') {
      const role = node.type === 'load_balancer' ? 'Load balancer'
        : node.type === 'api_gateway' ? 'API gateway' : 'Reverse proxy'
      const services = node.config.services?.filter(s => s.enabled) ?? []
      if (isDestination) {
        // Traffic addressed to its virtual IP / listener
        if ((req.protocol === 'tcp' || req.protocol === 'udp') && req.dstPort && services.length > 0) {
          const svc = services.find(s => s.port === req.dstPort && s.protocol === req.protocol)
          if (!svc) {
            hops.push({ step: i, nodeId: node.id, nodeName, nodeType: node.type, action: 'port_closed',
              detail: `${role} ${nodeName}: no listener on ${req.protocol.toUpperCase()}/${req.dstPort} — connection refused`,
              latencyMs: hopLatency, edgeId })
            blocked = true; blockedAt = nodeName; blockedBy = `Port ${req.dstPort} closed`
            break
          }
        }
        const detail = node.type === 'load_balancer'
          ? `${role} ${nodeName}: terminated client connection, selected a healthy backend (round-robin) and proxied the request`
          : node.type === 'api_gateway'
            ? `${role} ${nodeName}: authenticated & routed the API call to the matching upstream service`
            : `${role} ${nodeName}: terminated TLS and forwarded the request to its backend pool`
        hops.push({ step: i, nodeId: node.id, nodeName, nodeType: node.type, action: 'delivered', detail, latencyMs: hopLatency, edgeId })
      } else {
        // In transit: it makes an L7 forwarding decision toward the next hop
        const nextHop = nodePath[i + 1]
          ? (topology.nodes.find(n => n.id === nodePath[i + 1])?.config.hostname ?? nodePath[i + 1])
          : 'upstream'
        hops.push({ step: i, nodeId: node.id, nodeName, nodeType: node.type, action: 'route',
          detail: `${role} ${nodeName}: forwarding (L7) → ${nextHop}`, latencyMs: hopLatency, edgeId })
      }
    }
    // ── Destination / other (PC, server, printer, phone…) ─────────────────────
    else {
      // At the destination, evaluate listening services for TCP/UDP packets
      if (isDestination && (req.protocol === 'tcp' || req.protocol === 'udp') && req.dstPort) {
        const services = node.config.services?.filter(s => s.enabled) ?? []
        if (services.length > 0) {
          const svc = services.find(s => s.port === req.dstPort && s.protocol === req.protocol)
          if (svc) {
            hops.push({
              step: i, nodeId: node.id, nodeName, nodeType: node.type,
              action: 'delivered',
              detail: serviceBanner(svc, node, dstIp),
              latencyMs: hopLatency, edgeId,
            })
          } else {
            // Port closed — nothing listening on that port
            hops.push({
              step: i, nodeId: node.id, nodeName, nodeType: node.type,
              action: 'port_closed',
              detail: `Connection refused — TCP RST from ${nodeName} (${dstIp}): no service listening on ${req.protocol.toUpperCase()}/${req.dstPort}`,
              latencyMs: hopLatency, edgeId,
            })
            blocked = true
            blockedAt = nodeName
            blockedBy = `Port ${req.dstPort} closed`
          }
        } else {
          hops.push({
            step: i, nodeId: node.id, nodeName, nodeType: node.type,
            action: 'delivered',
            detail: `Packet delivered to ${nodeName} (${dstIp}) ✓`,
            latencyMs: hopLatency, edgeId,
          })
        }
      } else {
        hops.push({
          step: i,
          nodeId: node.id,
          nodeName,
          nodeType: node.type,
          action: isDestination ? 'delivered' : 'switch_forward',
          detail: isDestination
            ? `Packet delivered to ${nodeName} (${dstIp}) ✓`
            : `Forwarding through ${nodeName}`,
          latencyMs: hopLatency,
          edgeId,
        })
      }
    }
  }

  const success = !blocked && hops.some(h => h.action === 'delivered')

  return {
    id,
    success,
    blocked,
    blockedAt,
    blockedBy,
    dropType,
    path: nodePath,
    edgePath,
    hops,
    totalLatencyMs: parseFloat(totalLatency.toFixed(2)),
    packet: {
      srcNodeId: req.srcNodeId,
      dstNodeId: req.dstNodeId,
      srcIp,
      dstIp,
      protocol: req.protocol,
      srcPort: req.srcPort,
      dstPort: req.dstPort,
      ttl,
    },
    timestamp,
  }
}

function makeError(
  id: string,
  timestamp: number,
  req: SendPacketRequest,
  message: string,
): TraceResult {
  return {
    id,
    success: false,
    blocked: false,
    path: [],
    edgePath: [],
    hops: [{ step: 0, nodeId: req.srcNodeId, nodeName: req.srcNodeId, nodeType: 'unknown', action: 'no_route', detail: message, latencyMs: 0 }],
    totalLatencyMs: 0,
    packet: { srcNodeId: req.srcNodeId, dstNodeId: req.dstNodeId, srcIp: '', dstIp: '', protocol: req.protocol, dstPort: req.dstPort, ttl: 64 },
    timestamp,
  }
}

function maskToCidr(mask: string): number {
  if (!mask || mask === '0.0.0.0') return 0
  return mask.split('.').reduce((acc, o) => {
    let byte = parseInt(o, 10)
    let bits = 0
    while (byte & 0x80) { bits++; byte = (byte << 1) & 0xff }
    return acc + bits
  }, 0)
}
