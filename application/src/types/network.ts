// Network-topology domain types (nodes, edges, device config).

export interface NetworkInterface {
  name: string;
  ipAddress?: string;
  subnetMask?: string;
  cidr?: string;
  macAddress?: string;
  status: 'up' | 'down';
  speed?: string;
  duplex?: 'full' | 'half';
  description?: string;
  vlan?: number;         // access VLAN of this port (untagged = 1)
}

export interface RoutingTableEntry {
  id: string;
  destination: string;
  mask: string;
  gateway: string;
  interface: string;
  metric: number;
  type: 'static' | 'dynamic' | 'connected' | 'default';
  protocol?: string;
}

export interface FirewallRule {
  id: string;
  priority: number;
  action: 'allow' | 'deny' | 'drop' | 'reject';
  protocol: 'tcp' | 'udp' | 'icmp' | 'any';
  srcIp: string;
  srcPort: string;
  dstIp: string;
  dstPort: string;
  direction: 'in' | 'out' | 'both';
  description: string;
  enabled: boolean;
  hits?: number;
}

export interface VlanConfig {
  id: number;
  name: string;
  ports: string[];
  tagged: boolean;
}

export interface DhcpConfig {
  enabled: boolean;
  poolStart: string;
  poolEnd: string;
  subnetMask: string;
  gateway: string;
  dnsServers: string;
  leaseHours: number;
}

export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'NS' | 'TXT';

export interface DnsRecord {
  id: string;
  hostname: string;
  type: DnsRecordType;
  value: string;
  ttl: number;
}

export interface DnsConfig {
  enabled: boolean;
  forwarders: string;
  records: DnsRecord[];
}

export interface ServiceConfig {
  id: string;
  name: string;
  port: number;
  protocol: 'tcp' | 'udp';
  enabled: boolean;
  description?: string;
  version?: string;
}

export interface WebPage {
  title: string;
  body: string;
}

export interface NetworkNodeConfig {
  hostname?: string;
  description?: string;
  interfaces?: NetworkInterface[];
  routingTable?: RoutingTableEntry[];
  firewallRules?: FirewallRule[];
  vlans?: VlanConfig[];
  dhcp?: DhcpConfig;
  dns?: DnsConfig;
  services?: ServiceConfig[];
  webPage?: WebPage;
  powered?: boolean;
  zone?: string;          // security zone (Internal/DMZ/External/Management/…)
  osType?: string;
  model?: string;
  serialNumber?: string;
  mgmtIp?: string;
  enabled?: boolean;
}

export type NodeType =
  | 'router' | 'l3switch' | 'switch' | 'hub'
  | 'firewall' | 'ids_ips' | 'vpn_gateway'
  | 'wifiap'
  | 'load_balancer' | 'proxy' | 'api_gateway'
  | 'server' | 'dns' | 'dhcp' | 'mailserver' | 'fileserver' | 'database' | 'virtualhost'
  | 'nas' | 'storage'
  | 'pc' | 'laptop' | 'phone' | 'printer' | 'iot'
  | 'isp' | 'www' | 'cloud';

export interface NetworkNode {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  config: NetworkNodeConfig;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  config: {
    bandwidth?: string;
    latency?: string;
    duplex?: 'full' | 'half';
    vlan?: number[];
    encapsulation?: string;
    status?: 'up' | 'down';
  };
}

export interface NetworkTopology {
  id: string;
  name: string;
  description?: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  createdAt: number;
  updatedAt: number;
}
