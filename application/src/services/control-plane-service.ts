import type {
  NetworkTopology,
  NetworkNode,
  NetworkEdge,
  NetworkInterface,
} from '../types/index.js';
import { ipToInt, prefixOf, inSubnet, isPrivate } from '../lib/ip.js';

// ─────────────────────────────────────────────────────────────────────────────
// Control-plane derivation — produces the operational state tables a real device
// would hold in a converged network (the output of `show ...` commands), derived
// deterministically from the topology. Only the tables relevant to a device's
// role are returned.
// ─────────────────────────────────────────────────────────────────────────────

export interface ArpEntry {
  ip: string;
  mac: string;
  iface: string;
  type: 'dynamic' | 'static';
}
export interface MacEntry {
  vlan: number;
  mac: string;
  port: string;
  type: 'dynamic' | 'static';
}
export interface LeaseEntry {
  ip: string;
  mac: string;
  hostname: string;
  state: string;
  lease: string;
}
export interface OspfNeighbor {
  neighborId: string;
  state: string;
  address: string;
  iface: string;
}
export interface StpPort {
  port: string;
  neighbor: string;
  role: 'root' | 'designated' | 'blocking';
  state: 'forwarding' | 'blocking';
}
export interface StpInfo {
  bridgeId: string;
  rootBridgeId: string;
  isRoot: boolean;
  ports: StpPort[];
}
export interface AclEntry {
  seq: number;
  action: string;
  protocol: string;
  src: string;
  dst: string;
  direction: string;
  hits: number;
  enabled: boolean;
}
export interface NatEntry {
  protocol: string;
  insideLocal: string;
  insideGlobal: string;
  outsideGlobal: string;
}

export interface ControlPlaneReport {
  nodeId: string;
  type: string;
  hostname: string;
  arp?: ArpEntry[];
  macTable?: MacEntry[];
  dhcpLeases?: LeaseEntry[];
  ospfNeighbors?: OspfNeighbor[];
  stp?: StpInfo;
  acl?: AclEntry[];
  nat?: NatEntry[];
}

const L2_TYPES = new Set(['switch', 'hub', 'l3switch', 'wifiap']);
const ROUTER_TYPES = new Set(['router', 'l3switch']);
const CLIENT_TYPES = new Set(['pc', 'laptop', 'phone', 'printer', 'iot']);

function ifaces(n: NetworkNode): NetworkInterface[] {
  return n.config.interfaces ?? [];
}
function ipv4Ifaces(n: NetworkNode): NetworkInterface[] {
  return ifaces(n).filter((i) => ipToInt(i.ipAddress) !== null);
}
function firstMac(n: NetworkNode): string | undefined {
  return ifaces(n).find((i) => i.macAddress)?.macAddress;
}
function nameOf(n: NetworkNode): string {
  return n.config.hostname || n.label || n.id;
}
function randPort(): number {
  return 1024 + Math.floor(Math.random() * 64000);
}

interface Neighbor {
  node: NetworkNode;
  edge: NetworkEdge;
  port: string;
}
function neighborsOf(
  topo: NetworkTopology,
  node: NetworkNode,
  byId: Map<string, NetworkNode>,
): Neighbor[] {
  const out: Neighbor[] = [];
  topo.edges.forEach((e, i) => {
    const otherId = e.source === node.id ? e.target : e.target === node.id ? e.source : null;
    if (!otherId) return;
    const other = byId.get(otherId);
    if (!other) return;
    out.push({ node: other, edge: e, port: e.label || `port${i + 1}` });
  });
  return out;
}

// ── ARP table (any device that has an IP) ────────────────────────────────────
function buildArp(topo: NetworkTopology, node: NetworkNode): ArpEntry[] {
  const mine = ipv4Ifaces(node);
  if (mine.length === 0) return [];
  const seen = new Set<string>();
  const arp: ArpEntry[] = [];
  for (const local of mine) {
    const prefix = prefixOf(local);
    if (prefix === null) continue;
    for (const other of topo.nodes) {
      if (other.id === node.id) continue;
      for (const oi of ipv4Ifaces(other)) {
        if (oi.ipAddress === local.ipAddress) continue;
        if (!inSubnet(oi.ipAddress!, local.ipAddress!, prefix)) continue;
        if (seen.has(oi.ipAddress!)) continue;
        seen.add(oi.ipAddress!);
        arp.push({
          ip: oi.ipAddress!,
          mac: oi.macAddress ?? 'incomplete',
          iface: local.name,
          type: 'dynamic',
        });
      }
    }
  }
  return arp;
}

// ── MAC address table (switches) ─────────────────────────────────────────────
function buildMacTable(
  topo: NetworkTopology,
  node: NetworkNode,
  byId: Map<string, NetworkNode>,
): MacEntry[] {
  const vlanForPort = (port: string): number =>
    node.config.vlans?.find((v) => v.ports.includes(port))?.id ?? 1;
  const table: MacEntry[] = [];
  for (const nb of neighborsOf(topo, node, byId)) {
    const mac = firstMac(nb.node);
    if (!mac) continue;
    table.push({ vlan: vlanForPort(nb.port), mac, port: nb.port, type: 'dynamic' });
  }
  return table;
}

// ── DHCP leases (gateway / DHCP server) ──────────────────────────────────────
function gatewayIps(topo: NetworkTopology): Set<string> {
  const gws = new Set<string>();
  for (const n of topo.nodes) {
    for (const r of n.config.routingTable ?? []) {
      if (
        (r.destination === '0.0.0.0' || r.type === 'default') &&
        r.gateway &&
        r.gateway !== '0.0.0.0'
      )
        gws.add(r.gateway);
    }
  }
  return gws;
}
function isDhcpServer(node: NetworkNode, gws: Set<string>): boolean {
  if (node.config.dhcp?.enabled) return true;
  if (node.type === 'dhcp') return true;
  return ipv4Ifaces(node).some((i) => gws.has(i.ipAddress!));
}
function buildLeases(topo: NetworkTopology, node: NetworkNode): LeaseEntry[] {
  const myNets = ipv4Ifaces(node)
    .map((i) => ({ ip: i.ipAddress!, prefix: prefixOf(i) }))
    .filter((x) => x.prefix !== null);
  const leases: LeaseEntry[] = [];
  for (const h of topo.nodes) {
    if (!CLIENT_TYPES.has(h.type)) continue;
    for (const hi of ipv4Ifaces(h)) {
      const inMine = myNets.some((m) => inSubnet(hi.ipAddress!, m.ip, m.prefix!));
      if (!inMine) continue;
      leases.push({
        ip: hi.ipAddress!,
        mac: hi.macAddress ?? '—',
        hostname: nameOf(h),
        state: 'Active',
        lease: '23:59:00',
      });
      break;
    }
  }
  return leases;
}

// ── OSPF neighbors (routers / L3) ────────────────────────────────────────────
function buildOspf(
  topo: NetworkTopology,
  node: NetworkNode,
  byId: Map<string, NetworkNode>,
): OspfNeighbor[] {
  const out: OspfNeighbor[] = [];
  const mine = ipv4Ifaces(node);
  for (const nb of neighborsOf(topo, node, byId)) {
    if (!ROUTER_TYPES.has(nb.node.type) && nb.node.type !== 'firewall') continue;
    for (const local of mine) {
      const prefix = prefixOf(local);
      if (prefix === null) continue;
      const peer = ipv4Ifaces(nb.node).find(
        (i) => inSubnet(i.ipAddress!, local.ipAddress!, prefix) && i.ipAddress !== local.ipAddress,
      );
      if (!peer) continue;
      const peerHigher = (ipToInt(peer.ipAddress) ?? 0) > (ipToInt(local.ipAddress) ?? 0);
      out.push({
        neighborId: peer.ipAddress!,
        state: peerHigher ? 'FULL/DR' : 'FULL/BDR',
        address: peer.ipAddress!,
        iface: local.name,
      });
      break;
    }
  }
  return out;
}

// ── STP (switches), root computed per connected switch component ─────────────
function buildStp(
  topo: NetworkTopology,
  node: NetworkNode,
  byId: Map<string, NetworkNode>,
): StpInfo {
  const switches = topo.nodes.filter((n) => L2_TYPES.has(n.type));
  const bridgeId = (n: NetworkNode) => `32768.${firstMac(n) ?? n.id}`;
  // Switch-to-switch adjacency
  const adj = new Map<string, Set<string>>();
  for (const s of switches) adj.set(s.id, new Set());
  for (const e of topo.edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source)!.add(e.target);
      adj.get(e.target)!.add(e.source);
    }
  }
  // Connected component of this switch
  const comp = new Set<string>([node.id]);
  const stack = [node.id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const nx of adj.get(cur) ?? [])
      if (!comp.has(nx)) {
        comp.add(nx);
        stack.push(nx);
      }
  }
  const rootNode =
    switches
      .filter((s) => comp.has(s.id))
      .sort((a, b) => bridgeId(a).localeCompare(bridgeId(b)))[0] ?? node;
  const isRoot = rootNode.id === node.id;

  // BFS distances from root to determine this switch's root port
  const dist = new Map<string, number>([[rootNode.id, 0]]);
  const q = [rootNode.id];
  while (q.length) {
    const cur = q.shift()!;
    for (const nx of adj.get(cur) ?? [])
      if (!dist.has(nx)) {
        dist.set(nx, dist.get(cur)! + 1);
        q.push(nx);
      }
  }
  const myDist = dist.get(node.id) ?? Infinity;

  const ports: StpPort[] = neighborsOf(topo, node, byId).map((nb) => {
    if (!L2_TYPES.has(nb.node.type))
      return {
        port: nb.port,
        neighbor: nameOf(nb.node),
        role: 'designated' as const,
        state: 'forwarding' as const,
      };
    if (isRoot)
      return {
        port: nb.port,
        neighbor: nameOf(nb.node),
        role: 'designated' as const,
        state: 'forwarding' as const,
      };
    const nbDist = dist.get(nb.node.id) ?? Infinity;
    if (nbDist === myDist - 1)
      return {
        port: nb.port,
        neighbor: nameOf(nb.node),
        role: 'root' as const,
        state: 'forwarding' as const,
      };
    if (nbDist >= myDist)
      return {
        port: nb.port,
        neighbor: nameOf(nb.node),
        role: 'designated' as const,
        state: 'forwarding' as const,
      };
    return {
      port: nb.port,
      neighbor: nameOf(nb.node),
      role: 'blocking' as const,
      state: 'blocking' as const,
    };
  });

  return { bridgeId: bridgeId(node), rootBridgeId: bridgeId(rootNode), isRoot, ports };
}

// ── ACL with hit counters (firewalls) ────────────────────────────────────────
function buildAcl(node: NetworkNode): AclEntry[] {
  return (node.config.firewallRules ?? [])
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((r) => ({
      seq: r.priority,
      action: r.action,
      protocol: r.protocol,
      src: `${r.srcIp}:${r.srcPort}`,
      dst: `${r.dstIp}:${r.dstPort}`,
      direction: r.direction,
      hits: r.hits ?? 0,
      enabled: r.enabled,
    }));
}

// ── NAT translation table (internet edge: public + private interfaces) ───────
function buildNat(topo: NetworkTopology, node: NetworkNode): NatEntry[] {
  const wan = ipv4Ifaces(node).find((i) => !isPrivate(i.ipAddress!));
  const hasLan = ipv4Ifaces(node).some((i) => isPrivate(i.ipAddress!));
  if (!wan || !hasLan) return [];
  const insideHosts = topo.nodes
    .filter((n) => n.id !== node.id)
    .flatMap((n) =>
      ipv4Ifaces(n)
        .filter((i) => isPrivate(i.ipAddress!))
        .map((i) => i.ipAddress!),
    );
  const outsides = topo.nodes
    .flatMap((n) =>
      ipv4Ifaces(n)
        .filter((i) => !isPrivate(i.ipAddress!))
        .map((i) => i.ipAddress!),
    )
    .filter((ip) => ip !== wan.ipAddress);
  const pickOutside = () =>
    outsides.length ? outsides[Math.floor(Math.random() * outsides.length)] : '93.184.216.34';
  return insideHosts.slice(0, 8).map((ip) => ({
    protocol: 'tcp',
    insideLocal: `${ip}:${randPort()}`,
    insideGlobal: `${wan.ipAddress}:${randPort()}`,
    outsideGlobal: `${pickOutside()}:443`,
  }));
}

// ── Entry point ──────────────────────────────────────────────────────────────
export function controlPlaneForNode(
  topo: NetworkTopology,
  nodeId: string,
): ControlPlaneReport | null {
  const byId = new Map(topo.nodes.map((n) => [n.id, n]));
  const node = byId.get(nodeId);
  if (!node) return null;

  const report: ControlPlaneReport = { nodeId, type: node.type, hostname: nameOf(node) };
  const gws = gatewayIps(topo);

  if (ipv4Ifaces(node).length > 0) report.arp = buildArp(topo, node);
  if (L2_TYPES.has(node.type)) {
    report.macTable = buildMacTable(topo, node, byId);
    report.stp = buildStp(topo, node, byId);
  }
  if (ROUTER_TYPES.has(node.type) || node.type === 'firewall')
    report.ospfNeighbors = buildOspf(topo, node, byId);
  if (isDhcpServer(node, gws)) report.dhcpLeases = buildLeases(topo, node);
  if ((node.config.firewallRules ?? []).length > 0) report.acl = buildAcl(node);
  const nat = buildNat(topo, node);
  if (nat.length > 0) report.nat = nat;

  return report;
}
