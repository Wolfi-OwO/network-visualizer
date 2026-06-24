import type { LucideIcon } from 'lucide-react'
import {
  Router, Waypoints, Network, CircleDot,
  ShieldCheck, ShieldAlert, KeyRound,
  Wifi, Scale, Repeat, Webhook,
  Server, Compass, Share2, Mail, FolderTree, Database, Boxes,
  HardDrive, Archive,
  Monitor, Laptop, Smartphone, Printer, Cpu,
  RadioTower, Globe, Cloud, Box,
} from 'lucide-react'
import type { NodeType } from '../../types'

export type DeviceRole =
  | 'l3' | 'l2' | 'security' | 'wireless' | 'delivery'
  | 'server' | 'storage' | 'endpoint' | 'internet'

export interface DeviceMeta {
  label: string
  Icon: LucideIcon
  color: string
  bg: string
  role: DeviceRole
  hint: string
  /** Can run listening services (HTTP/DNS/…). A normal PC cannot. */
  canHostServices: boolean
  /** Requests an address from a DHCP server when powered on. */
  dhcpClient: boolean
}

const HOST_BG = '#1a1e24'
const SRV_BG = '#2a1e0d'

export const DEVICE_META: Record<NodeType, DeviceMeta> = {
  // ── Routing & Switching ──
  router:       { label: 'Router',         Icon: Router,      color: '#58a6ff', bg: '#0d2040', role: 'l3', hint: 'Layer-3 routing', canHostServices: false, dhcpClient: false },
  l3switch:     { label: 'L3 Switch',      Icon: Waypoints,   color: '#58a6ff', bg: '#0d2040', role: 'l3', hint: 'Routing + switching', canHostServices: false, dhcpClient: false },
  switch:       { label: 'L2 Switch',      Icon: Network,     color: '#3fb950', bg: '#0d2a18', role: 'l2', hint: 'Layer-2 switching / VLANs', canHostServices: false, dhcpClient: false },
  hub:          { label: 'Hub',            Icon: CircleDot,   color: '#bc8cff', bg: '#1a0d2a', role: 'l2', hint: 'Layer-1 repeater', canHostServices: false, dhcpClient: false },

  // ── Security ──
  firewall:     { label: 'Firewall',       Icon: ShieldCheck, color: '#f85149', bg: '#2a0d0d', role: 'security', hint: 'Stateful ACL firewall', canHostServices: false, dhcpClient: false },
  ids_ips:      { label: 'IDS / IPS',      Icon: ShieldAlert, color: '#ff7b72', bg: '#2a0d0d', role: 'security', hint: 'Intrusion detection/prevention', canHostServices: false, dhcpClient: false },
  vpn_gateway:  { label: 'VPN Gateway',    Icon: KeyRound,    color: '#f0883e', bg: '#2a1a0d', role: 'security', hint: 'Site-to-site / remote VPN', canHostServices: false, dhcpClient: false },

  // ── Wireless ──
  wifiap:       { label: 'Access Point',   Icon: Wifi,        color: '#ffa657', bg: '#2a1a0d', role: 'wireless', hint: 'Wi-Fi access point', canHostServices: false, dhcpClient: false },

  // ── Traffic & Delivery ──
  load_balancer:{ label: 'Load Balancer',  Icon: Scale,       color: '#d2a8ff', bg: '#1a0d2a', role: 'delivery', hint: 'Distributes traffic across a pool', canHostServices: true, dhcpClient: false },
  proxy:        { label: 'Reverse Proxy',  Icon: Repeat,      color: '#bc8cff', bg: '#1a0d2a', role: 'delivery', hint: 'Terminates & forwards to backends', canHostServices: true, dhcpClient: false },
  api_gateway:  { label: 'API Gateway',    Icon: Webhook,     color: '#c297ff', bg: '#1a0d2a', role: 'delivery', hint: 'Routes & secures API calls', canHostServices: true, dhcpClient: false },

  // ── Servers & Services ──
  server:       { label: 'Server',         Icon: Server,      color: '#d29922', bg: SRV_BG,    role: 'server', hint: 'Generic server', canHostServices: true, dhcpClient: true },
  dns:          { label: 'DNS Server',     Icon: Compass,     color: '#a371f7', bg: '#180d2a', role: 'server', hint: 'Name resolution', canHostServices: true, dhcpClient: true },
  dhcp:         { label: 'DHCP Server',    Icon: Share2,      color: '#2dd4bf', bg: '#0a2422', role: 'server', hint: 'Address assignment', canHostServices: true, dhcpClient: false },
  mailserver:   { label: 'Mail Server',    Icon: Mail,        color: '#e3b341', bg: SRV_BG,    role: 'server', hint: 'SMTP / IMAP', canHostServices: true, dhcpClient: true },
  fileserver:   { label: 'File Server',    Icon: FolderTree,  color: '#56d4dd', bg: '#0a1e2a', role: 'server', hint: 'SMB / NFS shares', canHostServices: true, dhcpClient: true },
  database:     { label: 'Database',       Icon: Database,    color: '#f778ba', bg: '#2a0d20', role: 'server', hint: 'SQL / NoSQL database', canHostServices: true, dhcpClient: true },
  virtualhost:  { label: 'Virtual Host',   Icon: Boxes,       color: '#79c0ff', bg: '#0d1829', role: 'server', hint: 'Hypervisor / VM host', canHostServices: true, dhcpClient: true },

  // ── Storage ──
  nas:          { label: 'NAS',            Icon: HardDrive,   color: '#8b949e', bg: HOST_BG,   role: 'storage', hint: 'Network attached storage', canHostServices: true, dhcpClient: true },
  storage:      { label: 'Storage Array',  Icon: Archive,     color: '#6e7681', bg: HOST_BG,   role: 'storage', hint: 'SAN / storage system', canHostServices: true, dhcpClient: true },

  // ── Endpoints ──
  pc:           { label: 'Workstation',    Icon: Monitor,     color: '#8b949e', bg: HOST_BG,   role: 'endpoint', hint: 'Desktop / workstation', canHostServices: false, dhcpClient: true },
  laptop:       { label: 'Laptop',         Icon: Laptop,      color: '#8b949e', bg: HOST_BG,   role: 'endpoint', hint: 'Portable client', canHostServices: false, dhcpClient: true },
  phone:        { label: 'Smartphone',     Icon: Smartphone,  color: '#8b949e', bg: HOST_BG,   role: 'endpoint', hint: 'Mobile / VoIP', canHostServices: false, dhcpClient: true },
  printer:      { label: 'Printer',        Icon: Printer,     color: '#8b949e', bg: HOST_BG,   role: 'endpoint', hint: 'Network printer', canHostServices: false, dhcpClient: true },
  iot:          { label: 'IoT Device',     Icon: Cpu,         color: '#56d4dd', bg: '#0a1e2a', role: 'endpoint', hint: 'Sensor / smart device', canHostServices: false, dhcpClient: true },

  // ── Internet & Cloud ──
  isp:          { label: 'ISP',            Icon: RadioTower,  color: '#38bdf8', bg: '#0a1e2a', role: 'internet', hint: 'Internet service provider', canHostServices: false, dhcpClient: false },
  www:          { label: 'WWW / Internet', Icon: Globe,       color: '#38bdf8', bg: '#0a1e2a', role: 'internet', hint: 'Public Internet', canHostServices: true, dhcpClient: false },
  cloud:        { label: 'Cloud',          Icon: Cloud,       color: '#58a6ff', bg: '#0d1829', role: 'internet', hint: 'Cloud / WAN', canHostServices: false, dhcpClient: false },
}

const FALLBACK: DeviceMeta = {
  label: 'Device', Icon: Box, color: '#8b949e', bg: HOST_BG, role: 'endpoint',
  hint: 'Network device', canHostServices: false, dhcpClient: false,
}

export function meta(type: string): DeviceMeta {
  return DEVICE_META[type as NodeType] ?? FALLBACK
}

export function canHostServices(type: string): boolean {
  return meta(type).canHostServices
}
export function isDhcpClient(type: string): boolean {
  return meta(type).dhcpClient
}

// ── Built-in hardware / adapters per device type ─────────────────────────────
const HARDWARE: Partial<Record<NodeType, string[]>> = {
  router:       ['Routing engine', '4× Gigabit Ethernet', 'Console / Mgmt port'],
  l3switch:     ['L3 switching ASIC', '24× Gigabit Ethernet', '4× SFP+ uplink'],
  switch:       ['L2 switching ASIC', '24× Gigabit Ethernet'],
  hub:          ['Signal repeater', 'Ethernet ports'],
  firewall:     ['Stateful inspection engine', 'WAN / LAN / DMZ NICs', 'Crypto accelerator'],
  ids_ips:      ['Deep-packet-inspection engine', 'Monitoring NIC (SPAN)'],
  vpn_gateway:  ['IPsec / SSL-VPN engine', 'Crypto accelerator', 'WAN NIC'],
  wifiap:       ['Wi-Fi 6 radio (2.4/5 GHz)', 'PoE Gigabit uplink'],
  load_balancer:['L4/L7 balancing engine', 'Dual 10G NIC', 'TLS offload'],
  proxy:        ['Reverse-proxy engine', 'TLS offload', 'Gigabit NIC'],
  api_gateway:  ['API routing engine', 'Auth & rate-limiting', 'Gigabit NIC'],
  server:       ['Multi-core CPU', 'ECC RAM', '10G Ethernet NIC', 'RAID storage'],
  dns:          ['CPU', 'RAM', 'Gigabit Ethernet NIC'],
  dhcp:         ['CPU', 'RAM', 'Gigabit Ethernet NIC'],
  mailserver:   ['Multi-core CPU', 'ECC RAM', 'Gigabit NIC', 'Mail store'],
  fileserver:   ['CPU', 'ECC RAM', '10G NIC', 'RAID array'],
  database:     ['Multi-core CPU', 'Large ECC RAM', 'NVMe storage', '10G NIC'],
  virtualhost:  ['Many-core CPU', 'Large RAM', 'Multiple NICs', 'Hypervisor'],
  nas:          ['Storage controller', 'Disk array', '2× Gigabit NIC'],
  storage:      ['SAN controller', 'Disk shelves', 'Fibre Channel / iSCSI'],
  pc:           ['CPU', 'RAM', 'Gigabit Ethernet NIC', 'Wi-Fi card'],
  laptop:       ['CPU', 'RAM', 'Wi-Fi 6 card', 'Ethernet NIC', 'Battery'],
  phone:        ['Mobile SoC', 'Wi-Fi card', 'Cellular modem', 'Bluetooth'],
  printer:      ['Print engine', 'Ethernet NIC', 'Wi-Fi card'],
  iot:          ['Microcontroller', 'Wi-Fi / Zigbee radio', 'Sensors'],
  isp:          ['Carrier backbone', 'BGP routers', 'Fibre uplinks'],
  www:          ['Global Internet', 'Anycast edge'],
  cloud:        ['Cloud region', 'Virtual networking'],
}

const WIRELESS_TYPES = new Set<NodeType>(['wifiap', 'laptop', 'phone', 'printer', 'iot'])

export function hardwareFor(type: string): string[] {
  return HARDWARE[type as NodeType] ?? ['Network interface']
}
export function isWireless(type: string): boolean {
  return WIRELESS_TYPES.has(type as NodeType)
}

// Palette grouping (categories → subcategory rows are just ordering here)
export const PALETTE_CATEGORIES: { category: string; types: NodeType[] }[] = [
  { category: 'Routing & Switching', types: ['router', 'l3switch', 'switch', 'hub'] },
  { category: 'Security',            types: ['firewall', 'ids_ips', 'vpn_gateway'] },
  { category: 'Wireless',            types: ['wifiap'] },
  { category: 'Traffic & Delivery',  types: ['load_balancer', 'proxy', 'api_gateway'] },
  { category: 'Servers & Services',  types: ['server', 'dns', 'dhcp', 'mailserver', 'fileserver', 'database', 'virtualhost'] },
  { category: 'Storage',             types: ['nas', 'storage'] },
  { category: 'Endpoints',           types: ['pc', 'laptop', 'phone', 'printer', 'iot'] },
  { category: 'Internet & Cloud',    types: ['isp', 'www', 'cloud'] },
]
