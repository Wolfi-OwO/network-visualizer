import type { NetworkTopology, NetworkNode, NetworkInterface } from '../types/index.js'
import { ipToInt, prefixOf, networkOf } from '../lib/ip.js'

// ─────────────────────────────────────────────────────────────────────────────
// Design-validation engine — flags the misconfigurations a real network engineer
// would catch on review. Pure functions over a topology; no side effects.
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning' | 'info'

export interface ValidationFinding {
  id: string
  severity: Severity
  category: string
  message: string
  nodeId?: string
  nodeLabel?: string
  edgeId?: string
}

export interface ValidationReport {
  ok: boolean
  counts: { error: number; warning: number; info: number }
  checks: number
  findings: ValidationFinding[]
}

// ── helpers ──────────────────────────────────────────────────────────────────
function inSubnet(candidate: string, ip: string, prefix: number): boolean {
  const c = networkOf(candidate, prefix)
  const n = networkOf(ip, prefix)
  return c !== null && n !== null && c === n
}

const NON_HOST_TYPES = new Set(['switch', 'hub', 'l3switch', 'wifiap', 'router', 'firewall', 'cloud', 'isp', 'www', 'ids_ips', 'vpn_gateway'])
const ENDPOINTS_SKIP_LINKCHECK = new Set(['switch', 'hub', 'l3switch', 'wifiap', 'cloud', 'isp', 'www'])

function ifaces(n: NetworkNode): NetworkInterface[] {
  return n.config.interfaces ?? []
}
function ipv4Ifaces(n: NetworkNode): NetworkInterface[] {
  return ifaces(n).filter((i) => ipToInt(i.ipAddress) !== null)
}

// ── The checks ───────────────────────────────────────────────────────────────
export function validateTopology(topo: NetworkTopology): ValidationReport {
  const findings: ValidationFinding[] = []
  let seq = 0
  const add = (severity: Severity, category: string, message: string, ref?: { nodeId?: string; nodeLabel?: string; edgeId?: string }) => {
    findings.push({ id: `f${++seq}`, severity, category, message, ...ref })
  }
  const label = (n: NetworkNode) => n.config.hostname || n.label || n.id

  // 1) Duplicate IPv4 addresses
  const ipOwners = new Map<string, { node: NetworkNode; iface: string }[]>()
  for (const n of topo.nodes) {
    for (const i of ipv4Ifaces(n)) {
      const list = ipOwners.get(i.ipAddress!) ?? []
      list.push({ node: n, iface: i.name })
      ipOwners.set(i.ipAddress!, list)
    }
  }
  for (const [ip, owners] of ipOwners) {
    if (owners.length > 1) {
      const who = owners.map((o) => `${label(o.node)}:${o.iface}`).join(', ')
      add('error', 'duplicate-ip', `Duplicate IP ${ip} assigned to ${owners.length} interfaces (${who})`, { nodeId: owners[0].node.id, nodeLabel: label(owners[0].node) })
    }
  }

  // 2) Duplicate MAC addresses
  const macOwners = new Map<string, NetworkNode[]>()
  for (const n of topo.nodes) {
    for (const i of ifaces(n)) {
      const mac = i.macAddress?.toLowerCase()
      if (!mac || mac === 'ff:ff:ff:ff:ff:ff') continue
      const list = macOwners.get(mac) ?? []
      list.push(n)
      macOwners.set(mac, list)
    }
  }
  for (const [mac, owners] of macOwners) {
    if (owners.length > 1) {
      add('error', 'duplicate-mac', `Duplicate MAC ${mac} on ${owners.map(label).join(', ')}`, { nodeId: owners[0].id, nodeLabel: label(owners[0]) })
    }
  }

  // 3) Default gateway not within any connected subnet
  for (const n of topo.nodes) {
    const routes = n.config.routingTable ?? []
    const defaults = routes.filter((r) => (r.destination === '0.0.0.0' || r.type === 'default') && r.gateway && r.gateway !== '0.0.0.0')
    const ips = ipv4Ifaces(n)
    for (const d of defaults) {
      const reachable = ips.some((i) => {
        const p = prefixOf(i)
        return p !== null && inSubnet(d.gateway, i.ipAddress!, p)
      })
      if (ips.length > 0 && !reachable) {
        add('error', 'gateway-unreachable', `Default gateway ${d.gateway} is not in any of ${label(n)}'s connected subnets`, { nodeId: n.id, nodeLabel: label(n) })
      }
    }
  }

  // 4) Hosts with an IP but no default route (can't leave their subnet)
  for (const n of topo.nodes) {
    if (NON_HOST_TYPES.has(n.type)) continue
    const hasIp = ipv4Ifaces(n).length > 0
    const hasDefault = (n.config.routingTable ?? []).some((r) => r.destination === '0.0.0.0' || r.type === 'default')
    if (hasIp && !hasDefault) {
      add('info', 'no-default-route', `${label(n)} has no default route — it can only reach its own subnet`, { nodeId: n.id, nodeLabel: label(n) })
    }
  }

  // 5) Isolated nodes (no links)
  const degree = new Map<string, number>()
  for (const e of topo.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
  }
  for (const n of topo.nodes) {
    if ((degree.get(n.id) ?? 0) === 0) {
      add('warning', 'isolated-node', `${label(n)} is not connected to any link`, { nodeId: n.id, nodeLabel: label(n) })
    }
  }

  // 6) Directly-connected L3 devices that share no common subnet
  const nodeById = new Map(topo.nodes.map((n) => [n.id, n]))
  for (const e of topo.edges) {
    const a = nodeById.get(e.source)
    const b = nodeById.get(e.target)
    if (!a || !b) continue
    if (ENDPOINTS_SKIP_LINKCHECK.has(a.type) || ENDPOINTS_SKIP_LINKCHECK.has(b.type)) continue
    const ai = ipv4Ifaces(a)
    const bi = ipv4Ifaces(b)
    if (ai.length === 0 || bi.length === 0) continue
    const share = ai.some((x) => {
      const px = prefixOf(x)
      return px !== null && bi.some((y) => inSubnet(y.ipAddress!, x.ipAddress!, px))
    })
    if (!share) {
      add('warning', 'link-subnet-mismatch', `${label(a)} ↔ ${label(b)} are directly connected but share no common subnet`, { edgeId: e.id, nodeId: a.id })
    }
  }

  // 7) Shadowed firewall rules (an earlier match-all rule makes later ones dead)
  for (const n of topo.nodes) {
    const rules = (n.config.firewallRules ?? []).filter((r) => r.enabled).slice().sort((x, y) => x.priority - y.priority)
    const isAny = (v: string) => v === 'any' || v === '*' || v === '0.0.0.0/0'
    const matchAll = (r: typeof rules[number]) => r.protocol === 'any' && isAny(r.srcIp) && isAny(r.srcPort) && isAny(r.dstIp) && isAny(r.dstPort)
    for (let i = 0; i < rules.length; i++) {
      if (!matchAll(rules[i])) continue
      const dir = rules[i].direction
      for (let j = i + 1; j < rules.length; j++) {
        if (dir === 'both' || rules[j].direction === dir || rules[j].direction === 'both') {
          add('warning', 'shadowed-rule', `${label(n)} firewall rule #${rules[j].priority} ("${rules[j].description}") is shadowed by match-all rule #${rules[i].priority} and never matches`, { nodeId: n.id, nodeLabel: label(n) })
        }
      }
      break // only report against the first match-all per node
    }
  }

  const counts = {
    error: findings.filter((f) => f.severity === 'error').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
  }
  return { ok: counts.error === 0, counts, checks: 7, findings }
}
