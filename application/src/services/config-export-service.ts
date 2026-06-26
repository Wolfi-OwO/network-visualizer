import type { NetworkTopology, NetworkNode } from '../types/index.js'
import { prefixOf, intToIp } from '../lib/ip.js'

// ─────────────────────────────────────────────────────────────────────────────
// Config export — renders a device's settings as a Cisco-IOS-style
// running-config, derived from the topology. Useful as an "enterprise" artifact
// (review, diff, backup) and to make the modelled config tangible.
// ─────────────────────────────────────────────────────────────────────────────

const L2_TYPES = new Set(['switch', 'hub', 'l3switch', 'wifiap'])

function prefixToMask(prefix: number): string {
  return intToIp(prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0)
}
function wildcard(prefix: number): string {
  return intToIp(prefix === 0 ? 0xffffffff : (~(0xffffffff << (32 - prefix))) >>> 0)
}
function hostname(n: NetworkNode): string {
  return (n.config.hostname || n.label || n.id).replace(/\s+/g, '-')
}

function aclAddr(v: string): string {
  if (!v || v === 'any' || v === '*' || v === '0.0.0.0/0') return 'any'
  const [ip, cidr] = v.split('/')
  if (cidr) {
    const p = parseInt(cidr, 10)
    return p === 32 ? `host ${ip}` : `${ip} ${wildcard(p)}`
  }
  return `host ${ip}`
}

export function deviceRunningConfig(topo: NetworkTopology, node: NetworkNode): string {
  const L: string[] = []
  const c = node.config
  L.push('!')
  L.push(`! ${node.type} — exported from NetViz (${topo.name})`)
  L.push('!')
  L.push(`hostname ${hostname(node)}`)
  if (c.model) L.push(`! model: ${c.model}`)
  if (c.osType) L.push(`! os: ${c.osType}`)
  L.push('!')

  const isSwitch = L2_TYPES.has(node.type)

  // Interfaces
  for (const i of c.interfaces ?? []) {
    L.push(`interface ${i.name}`)
    if (i.description) L.push(` description ${i.description}`)
    if (isSwitch) {
      const vlan = c.vlans?.find((v) => v.ports.includes(i.name))
      if (vlan) L.push(` switchport access vlan ${vlan.id}`)
      if (i.speed) L.push(` ! speed ${i.speed}`)
    } else if (i.ipAddress) {
      const p = prefixOf(i)
      L.push(` ip address ${i.ipAddress} ${p !== null ? prefixToMask(p) : (i.subnetMask ?? '255.255.255.0')}`)
    }
    L.push(i.status === 'down' ? ' shutdown' : ' no shutdown')
    L.push('!')
  }

  // VLAN database (switches)
  if (c.vlans?.length) {
    for (const v of c.vlans) {
      L.push(`vlan ${v.id}`)
      L.push(` name ${v.name}`)
    }
    L.push('!')
  }

  // Static / default routes
  const routes = (c.routingTable ?? []).filter((r) => r.type !== 'connected')
  for (const r of routes) {
    L.push(`ip route ${r.destination} ${r.mask} ${r.gateway}`)
  }
  if (routes.length) L.push('!')

  // Firewall rules → extended ACL
  if (c.firewallRules?.length) {
    L.push('ip access-list extended NETVIZ_ACL')
    for (const r of [...c.firewallRules].sort((a, b) => a.priority - b.priority)) {
      const act = r.action === 'allow' ? 'permit' : 'deny'
      const proto = r.protocol === 'any' ? 'ip' : r.protocol
      const dport = r.dstPort && r.dstPort !== 'any' ? ` eq ${r.dstPort.split(',')[0]}` : ''
      const state = r.enabled ? '' : '   ! (disabled)'
      L.push(` ${act} ${proto} ${aclAddr(r.srcIp)} ${aclAddr(r.dstIp)}${dport}  ! #${r.priority} ${r.direction}${r.hits != null ? ` (${r.hits} hits)` : ''}${state}`)
    }
    L.push('!')
  }

  // DHCP pool
  if (c.dhcp?.enabled) {
    L.push('ip dhcp pool NETVIZ')
    L.push(` network ${c.dhcp.poolStart} ${c.dhcp.subnetMask}`)
    L.push(` default-router ${c.dhcp.gateway}`)
    L.push(` dns-server ${c.dhcp.dnsServers}`)
    L.push(` lease ${Math.round((c.dhcp.leaseHours ?? 24) / 24)} 0 0`)
    L.push('!')
  }

  // Services
  if (c.services?.length) {
    for (const s of c.services) L.push(`! service ${s.name} ${s.protocol}/${s.port} ${s.enabled ? 'enabled' : 'disabled'}`)
    L.push('!')
  }

  L.push('end')
  return L.join('\n') + '\n'
}

export function topologyConfigBundle(topo: NetworkTopology): string {
  const parts = topo.nodes.map((n) => {
    const banner = `========================================================================\n` +
      `  ${hostname(n)}  (${n.type})\n` +
      `========================================================================`
    return `${banner}\n${deviceRunningConfig(topo, n)}`
  })
  return `! NetViz configuration archive — ${topo.name}\n! generated ${new Date().toISOString()}\n! ${topo.nodes.length} devices\n\n${parts.join('\n')}`
}
