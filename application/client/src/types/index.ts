export interface EthernetLayer {
  srcMac: string
  dstMac: string
  etherType: string
  etherTypeName: string
}

export interface IpLayer {
  version: number
  headerLength: number
  dscp: number
  ecn: number
  totalLength: number
  identification: string
  flags: string
  fragmentOffset: number
  ttl: number
  protocol: number
  protocolName: string
  checksum: string
  srcIp: string
  dstIp: string
}

export interface TcpFlags {
  fin: boolean
  syn: boolean
  rst: boolean
  psh: boolean
  ack: boolean
  urg: boolean
}

export interface TcpLayer {
  srcPort: number
  dstPort: number
  sequenceNumber: number
  acknowledgmentNumber: number
  dataOffset: number
  flags: TcpFlags
  windowSize: number
  checksum: string
  urgentPointer: number
}

export interface UdpLayer {
  srcPort: number
  dstPort: number
  length: number
  checksum: string
}

export interface IcmpLayer {
  type: number
  typeName: string
  code: number
  checksum: string
  identifier?: number
  sequenceNumber?: number
  data?: string
}

export interface DnsQuery {
  name: string
  type: string
  class: string
}

export interface DnsAnswer {
  name: string
  type: string
  class: string
  ttl: number
  dataLength: number
  address?: string
  cname?: string
}

export interface DnsLayer {
  transactionId: string
  flags: string
  isResponse: boolean
  opcode: string
  questions: number
  answerRRs: number
  authorityRRs: number
  additionalRRs: number
  queries: DnsQuery[]
  answers: DnsAnswer[]
}

export interface HttpLayer {
  isRequest: boolean
  method?: string
  uri?: string
  version: string
  statusCode?: number
  statusMessage?: string
  headers: Record<string, string>
  contentLength?: number
}

export interface ArpLayer {
  hardwareType: number
  protocolType: string
  hardwareSize: number
  protocolSize: number
  opcode: number
  opcodeName: string
  senderMac: string
  senderIp: string
  targetMac: string
  targetIp: string
}

export interface TlsLayer {
  contentType: string
  version: string
  length: number
  handshakeType?: string
  cipherSuites?: string[]
  serverName?: string
}

// Generic, render-everywhere view for protocols without a bespoke typed layer
// (DHCP, STP, NTP, LLDP, SNMP, OSPF, SSDP, mDNS, SIP, …)
export interface ProtoField {
  key: string
  value: string
}

export interface ProtoView {
  name: string
  summary?: string
  fields: ProtoField[]
}

export interface Packet {
  id: number
  timestamp: number
  relativeTime: number
  length: number
  capturedLength: number
  protocol: string
  info: string
  color: string
  ethernet?: EthernetLayer
  ip?: IpLayer
  tcp?: TcpLayer
  udp?: UdpLayer
  icmp?: IcmpLayer
  dns?: DnsLayer
  http?: HttpLayer
  arp?: ArpLayer
  tls?: TlsLayer
  protoViews?: ProtoView[]
  hexDump: string[]
  rawBytes: number[]
}

export interface PacketStats {
  total: number
  byProtocol: Record<string, number>
  bytesTotal: number
  startTime: number
  duration: number
  packetsPerSecond: number
  bytesPerSecond: number
}

export interface NetworkInterface {
  name: string
  ipAddress?: string
  subnetMask?: string
  cidr?: string
  macAddress?: string
  status: 'up' | 'down'
  speed?: string
  duplex?: 'full' | 'half'
  description?: string
}

export interface RoutingTableEntry {
  id: string
  destination: string
  mask: string
  gateway: string
  interface: string
  metric: number
  type: 'static' | 'dynamic' | 'connected' | 'default'
  protocol?: string
}

export interface FirewallRule {
  id: string
  priority: number
  action: 'allow' | 'deny' | 'drop' | 'reject'
  protocol: 'tcp' | 'udp' | 'icmp' | 'any'
  srcIp: string
  srcPort: string
  dstIp: string
  dstPort: string
  direction: 'in' | 'out' | 'both'
  description: string
  enabled: boolean
  hits?: number
}

export interface VlanConfig {
  id: number
  name: string
  ports: string[]
  tagged: boolean
}

export interface DhcpConfig {
  enabled: boolean
  poolStart: string
  poolEnd: string
  subnetMask: string
  gateway: string
  dnsServers: string   // comma-separated list
  leaseHours: number
}

export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'NS' | 'TXT'

export interface DnsRecord {
  id: string
  hostname: string
  type: DnsRecordType
  value: string
  ttl: number
}

export interface DnsConfig {
  enabled: boolean
  forwarders: string   // comma-separated upstream resolvers
  records: DnsRecord[]
}

export interface ServiceConfig {
  id: string
  name: string                 // HTTP, HTTPS, FTP, SSH, DNS, SMTP, RDP, Telnet …
  port: number
  protocol: 'tcp' | 'udp'
  enabled: boolean
  description?: string
  version?: string
}

export interface WebPage {
  title: string
  body: string
}

export interface NetworkNodeConfig {
  hostname?: string
  description?: string
  interfaces?: NetworkInterface[]
  routingTable?: RoutingTableEntry[]
  firewallRules?: FirewallRule[]
  vlans?: VlanConfig[]
  dhcp?: DhcpConfig
  dns?: DnsConfig
  services?: ServiceConfig[]
  webPage?: WebPage
  powered?: boolean        // device power state (undefined = on)
  osType?: string
  model?: string
  serialNumber?: string
  mgmtIp?: string
  enabled?: boolean
}

export type NodeType =
  | 'router' | 'l3switch' | 'switch' | 'hub'
  | 'firewall' | 'ids_ips' | 'vpn_gateway'
  | 'wifiap'
  | 'load_balancer' | 'proxy' | 'api_gateway'
  | 'server' | 'dns' | 'dhcp' | 'mailserver' | 'fileserver' | 'database' | 'virtualhost'
  | 'nas' | 'storage'
  | 'pc' | 'laptop' | 'phone' | 'printer' | 'iot'
  | 'isp' | 'www' | 'cloud'

export interface NetworkNode {
  id: string
  type: NodeType
  label: string
  position: { x: number; y: number }
  config: NetworkNodeConfig
}

export interface NetworkEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
  config: {
    bandwidth?: string
    latency?: string
    duplex?: 'full' | 'half'
    vlan?: number[]
    encapsulation?: string
    status?: 'up' | 'down'
  }
}

export interface NetworkTopology {
  id: string
  name: string
  description?: string
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  createdAt: number
  updatedAt: number
}

export interface CIDRResult {
  input: string
  ipAddress: string
  cidrPrefix: number
  networkAddress: string
  broadcastAddress: string
  firstHost: string
  lastHost: string
  subnetMask: string
  wildcardMask: string
  totalHosts: number
  usableHosts: number
  binarySubnetMask: string
  binaryNetworkAddress: string
  binaryIpAddress: string
  ipClass: string
  isPrivate: boolean
  octets: number[]
  networkOctets: number[]
  broadcastOctets: number[]
}
