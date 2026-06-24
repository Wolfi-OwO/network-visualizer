import { v4 as uuidv4 } from 'uuid';
import { NetworkTopology, NetworkNode, NetworkEdge, FirewallRule, RoutingTableEntry } from '../types';

const topologies = new Map<string, NetworkTopology>();

function createDefaultTopology(): NetworkTopology {
  const id = uuidv4();
  const now = Date.now();

  const nodes: NetworkNode[] = [
    {
      id: 'internet-1',
      type: 'cloud',
      label: 'Internet',
      position: { x: 500, y: 50 },
      config: { hostname: 'Internet', description: 'External Network / ISP' },
    },
    {
      id: 'fw-1',
      type: 'firewall',
      label: 'Firewall',
      position: { x: 500, y: 200 },
      config: {
        hostname: 'FW-01',
        model: 'Cisco ASA 5505',
        description: 'Perimeter Firewall',
        interfaces: [
          { name: 'GigabitEthernet0/0', ipAddress: '203.0.113.1', subnetMask: '255.255.255.252', cidr: '/30', macAddress: '00:1a:2b:3c:4d:01', status: 'up', speed: '1 Gbps', description: 'WAN Interface' },
          { name: 'GigabitEthernet0/1', ipAddress: '10.0.0.1', subnetMask: '255.255.255.0', cidr: '/24', macAddress: '00:1a:2b:3c:4d:02', status: 'up', speed: '1 Gbps', description: 'LAN Interface' },
          { name: 'GigabitEthernet0/2', ipAddress: '172.16.0.1', subnetMask: '255.255.0.0', cidr: '/16', macAddress: '00:1a:2b:3c:4d:03', status: 'up', speed: '1 Gbps', description: 'DMZ Interface' },
        ],
        firewallRules: [
          { id: uuidv4(), priority: 1, action: 'allow', protocol: 'tcp', srcIp: 'any', srcPort: 'any', dstIp: '10.0.0.0/24', dstPort: '80,443', direction: 'in', description: 'Allow HTTP/HTTPS inbound', enabled: true, hits: 14523 },
          { id: uuidv4(), priority: 2, action: 'allow', protocol: 'tcp', srcIp: '10.0.0.0/24', srcPort: 'any', dstIp: 'any', dstPort: 'any', direction: 'out', description: 'Allow all outbound from LAN', enabled: true, hits: 89234 },
          { id: uuidv4(), priority: 3, action: 'allow', protocol: 'icmp', srcIp: 'any', srcPort: 'any', dstIp: 'any', dstPort: 'any', direction: 'both', description: 'Allow ICMP (ping)', enabled: true, hits: 3421 },
          { id: uuidv4(), priority: 4, action: 'deny', protocol: 'tcp', srcIp: 'any', srcPort: 'any', dstIp: 'any', dstPort: '22', direction: 'in', description: 'Block SSH from WAN', enabled: true, hits: 12847 },
          { id: uuidv4(), priority: 5, action: 'drop', protocol: 'any', srcIp: 'any', srcPort: 'any', dstIp: 'any', dstPort: 'any', direction: 'in', description: 'Default deny all inbound', enabled: true, hits: 45678 },
        ],
        routingTable: [
          { id: uuidv4(), destination: '0.0.0.0', mask: '0.0.0.0', gateway: '203.0.113.2', interface: 'GigabitEthernet0/0', metric: 1, type: 'default' },
          { id: uuidv4(), destination: '10.0.0.0', mask: '255.255.255.0', gateway: '0.0.0.0', interface: 'GigabitEthernet0/1', metric: 0, type: 'connected' },
          { id: uuidv4(), destination: '172.16.0.0', mask: '255.255.0.0', gateway: '0.0.0.0', interface: 'GigabitEthernet0/2', metric: 0, type: 'connected' },
        ],
      },
    },
    {
      id: 'router-1',
      type: 'router',
      label: 'Core Router',
      position: { x: 500, y: 380 },
      config: {
        hostname: 'RTR-CORE-01',
        model: 'Cisco ISR 4321',
        description: 'Core Distribution Router',
        interfaces: [
          { name: 'GigabitEthernet0/0/0', ipAddress: '10.0.0.254', subnetMask: '255.255.255.0', cidr: '/24', macAddress: '00:2a:3b:4c:5d:01', status: 'up', speed: '1 Gbps' },
          { name: 'GigabitEthernet0/0/1', ipAddress: '10.1.0.1', subnetMask: '255.255.255.0', cidr: '/24', macAddress: '00:2a:3b:4c:5d:02', status: 'up', speed: '1 Gbps' },
          { name: 'GigabitEthernet0/0/2', ipAddress: '10.2.0.1', subnetMask: '255.255.255.0', cidr: '/24', macAddress: '00:2a:3b:4c:5d:03', status: 'up', speed: '1 Gbps' },
        ],
        routingTable: [
          { id: uuidv4(), destination: '0.0.0.0', mask: '0.0.0.0', gateway: '10.0.0.1', interface: 'GigabitEthernet0/0/0', metric: 1, type: 'default' },
          { id: uuidv4(), destination: '10.1.0.0', mask: '255.255.255.0', gateway: '0.0.0.0', interface: 'GigabitEthernet0/0/1', metric: 0, type: 'connected' },
          { id: uuidv4(), destination: '10.2.0.0', mask: '255.255.255.0', gateway: '0.0.0.0', interface: 'GigabitEthernet0/0/2', metric: 0, type: 'connected' },
          { id: uuidv4(), destination: '192.168.10.0', mask: '255.255.255.0', gateway: '10.1.0.254', interface: 'GigabitEthernet0/0/1', metric: 2, type: 'static' },
        ],
      },
    },
    {
      id: 'switch-1',
      type: 'switch',
      label: 'Switch-A',
      position: { x: 250, y: 540 },
      config: {
        hostname: 'SW-A-01',
        model: 'Cisco Catalyst 2960',
        description: 'Access Layer Switch - Floor A',
        interfaces: [
          { name: 'FastEthernet0/1', status: 'up', speed: '100 Mbps', description: 'Uplink to Router' },
          { name: 'FastEthernet0/2', status: 'up', speed: '100 Mbps', description: 'PC-01' },
          { name: 'FastEthernet0/3', status: 'up', speed: '100 Mbps', description: 'PC-02' },
          { name: 'FastEthernet0/4', status: 'down', speed: '100 Mbps', description: 'Unused' },
        ],
        vlans: [
          { id: 1, name: 'Default', ports: ['FastEthernet0/1'], tagged: false },
          { id: 10, name: 'Users', ports: ['FastEthernet0/2', 'FastEthernet0/3'], tagged: false },
          { id: 20, name: 'Printers', ports: [], tagged: false },
        ],
      },
    },
    {
      id: 'switch-2',
      type: 'switch',
      label: 'Switch-B',
      position: { x: 750, y: 540 },
      config: {
        hostname: 'SW-B-01',
        model: 'Cisco Catalyst 2960',
        description: 'Access Layer Switch - Floor B',
        interfaces: [
          { name: 'FastEthernet0/1', status: 'up', speed: '100 Mbps', description: 'Uplink to Router' },
          { name: 'FastEthernet0/2', status: 'up', speed: '100 Mbps', description: 'Server-01' },
          { name: 'FastEthernet0/3', status: 'up', speed: '100 Mbps', description: 'Printer-01' },
        ],
        vlans: [
          { id: 1, name: 'Default', ports: ['FastEthernet0/1'], tagged: false },
          { id: 30, name: 'Servers', ports: ['FastEthernet0/2'], tagged: false },
          { id: 40, name: 'Printers', ports: ['FastEthernet0/3'], tagged: false },
        ],
      },
    },
    {
      id: 'pc-1',
      type: 'pc',
      label: 'PC-01',
      position: { x: 100, y: 700 },
      config: {
        hostname: 'WORKSTATION-01',
        osType: 'Windows 11',
        description: 'User Workstation',
        interfaces: [
          { name: 'Ethernet', ipAddress: '10.1.0.10', subnetMask: '255.255.255.0', cidr: '/24', macAddress: '00:3c:4d:5e:6f:10', status: 'up', speed: '100 Mbps' },
        ],
        routingTable: [
          { id: uuidv4(), destination: '0.0.0.0', mask: '0.0.0.0', gateway: '10.1.0.1', interface: 'Ethernet', metric: 1, type: 'default' },
        ],
      },
    },
    {
      id: 'pc-2',
      type: 'pc',
      label: 'PC-02',
      position: { x: 300, y: 700 },
      config: {
        hostname: 'WORKSTATION-02',
        osType: 'Ubuntu 22.04',
        description: 'Developer Workstation',
        interfaces: [
          { name: 'eth0', ipAddress: '10.1.0.11', subnetMask: '255.255.255.0', cidr: '/24', macAddress: '00:3c:4d:5e:6f:11', status: 'up', speed: '100 Mbps' },
        ],
        routingTable: [
          { id: uuidv4(), destination: '0.0.0.0', mask: '0.0.0.0', gateway: '10.1.0.1', interface: 'eth0', metric: 1, type: 'default' },
        ],
      },
    },
    {
      id: 'server-1',
      type: 'server',
      label: 'Web Server',
      position: { x: 700, y: 700 },
      config: {
        hostname: 'SRV-WEB-01',
        osType: 'Ubuntu Server 22.04',
        description: 'Nginx Web Server',
        interfaces: [
          { name: 'eth0', ipAddress: '10.2.0.10', subnetMask: '255.255.255.0', cidr: '/24', macAddress: '00:4d:5e:6f:70:10', status: 'up', speed: '1 Gbps' },
        ],
      },
    },
    {
      id: 'printer-1',
      type: 'printer',
      label: 'Printer',
      position: { x: 850, y: 700 },
      config: {
        hostname: 'PRN-01',
        description: 'Network Printer',
        interfaces: [
          { name: 'LAN', ipAddress: '10.2.0.50', subnetMask: '255.255.255.0', cidr: '/24', macAddress: '00:5e:6f:70:81:50', status: 'up', speed: '100 Mbps' },
        ],
      },
    },
    {
      id: 'dmz-server-1',
      type: 'server',
      label: 'DMZ Server',
      position: { x: 750, y: 300 },
      config: {
        hostname: 'SRV-DMZ-01',
        osType: 'CentOS 7',
        description: 'Public-facing Web Server in DMZ',
        interfaces: [
          { name: 'eth0', ipAddress: '172.16.0.10', subnetMask: '255.255.0.0', cidr: '/16', macAddress: '00:6f:70:81:92:10', status: 'up', speed: '1 Gbps' },
        ],
      },
    },
  ];

  const edges: NetworkEdge[] = [
    { id: uuidv4(), source: 'internet-1', target: 'fw-1', label: 'WAN', config: { bandwidth: '100 Mbps', latency: '10ms', duplex: 'full', status: 'up' } },
    { id: uuidv4(), source: 'fw-1', target: 'router-1', label: 'LAN trunk', config: { bandwidth: '1 Gbps', latency: '1ms', duplex: 'full', status: 'up' } },
    { id: uuidv4(), source: 'fw-1', target: 'dmz-server-1', label: 'DMZ', config: { bandwidth: '100 Mbps', latency: '1ms', duplex: 'full', status: 'up' } },
    { id: uuidv4(), source: 'router-1', target: 'switch-1', label: 'Fa0/1', config: { bandwidth: '100 Mbps', latency: '0.5ms', duplex: 'full', status: 'up' } },
    { id: uuidv4(), source: 'router-1', target: 'switch-2', label: 'Fa0/2', config: { bandwidth: '100 Mbps', latency: '0.5ms', duplex: 'full', status: 'up' } },
    { id: uuidv4(), source: 'switch-1', target: 'pc-1', label: 'Fa0/2', config: { bandwidth: '100 Mbps', latency: '0.1ms', duplex: 'full', status: 'up' } },
    { id: uuidv4(), source: 'switch-1', target: 'pc-2', label: 'Fa0/3', config: { bandwidth: '100 Mbps', latency: '0.1ms', duplex: 'full', status: 'up' } },
    { id: uuidv4(), source: 'switch-2', target: 'server-1', label: 'Fa0/2', config: { bandwidth: '1 Gbps', latency: '0.1ms', duplex: 'full', status: 'up' } },
    { id: uuidv4(), source: 'switch-2', target: 'printer-1', label: 'Fa0/3', config: { bandwidth: '100 Mbps', latency: '0.1ms', duplex: 'full', status: 'up' } },
  ];

  const topology: NetworkTopology = {
    id,
    name: 'Enterprise Network',
    description: 'Sample enterprise network with DMZ, firewall, routing, and endpoint devices',
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  };

  topologies.set(id, topology);
  return topology;
}

let defaultTopologyId: string | null = null;

export function getOrCreateDefault(): NetworkTopology {
  if (defaultTopologyId && topologies.has(defaultTopologyId)) {
    return topologies.get(defaultTopologyId)!;
  }
  const t = createDefaultTopology();
  defaultTopologyId = t.id;
  return t;
}

export function getAllTopologies(): NetworkTopology[] {
  return Array.from(topologies.values());
}

export function getTopology(id: string): NetworkTopology | undefined {
  return topologies.get(id);
}

export function createTopology(name: string, description?: string): NetworkTopology {
  const id = uuidv4();
  const now = Date.now();
  const topology: NetworkTopology = {
    id, name, description,
    nodes: [], edges: [],
    createdAt: now, updatedAt: now,
  };
  topologies.set(id, topology);
  return topology;
}

export function updateTopology(id: string, updates: Partial<NetworkTopology>): NetworkTopology | null {
  const topology = topologies.get(id);
  if (!topology) return null;
  const updated = { ...topology, ...updates, updatedAt: Date.now() };
  topologies.set(id, updated);
  return updated;
}

export function deleteTopology(id: string): boolean {
  return topologies.delete(id);
}

export function addNode(topologyId: string, node: Omit<NetworkNode, 'id'>): NetworkNode | null {
  const topology = topologies.get(topologyId);
  if (!topology) return null;
  const newNode: NetworkNode = { ...node, id: uuidv4() };
  topology.nodes.push(newNode);
  topology.updatedAt = Date.now();
  return newNode;
}

export function updateNode(topologyId: string, nodeId: string, updates: Partial<NetworkNode>): NetworkNode | null {
  const topology = topologies.get(topologyId);
  if (!topology) return null;
  const idx = topology.nodes.findIndex(n => n.id === nodeId);
  if (idx === -1) return null;
  topology.nodes[idx] = { ...topology.nodes[idx], ...updates };
  topology.updatedAt = Date.now();
  return topology.nodes[idx];
}

export function deleteNode(topologyId: string, nodeId: string): boolean {
  const topology = topologies.get(topologyId);
  if (!topology) return false;
  const before = topology.nodes.length;
  topology.nodes = topology.nodes.filter(n => n.id !== nodeId);
  topology.edges = topology.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
  topology.updatedAt = Date.now();
  return topology.nodes.length < before;
}

export function addEdge(topologyId: string, edge: Omit<NetworkEdge, 'id'>): NetworkEdge | null {
  const topology = topologies.get(topologyId);
  if (!topology) return null;
  const newEdge: NetworkEdge = { ...edge, id: uuidv4() };
  topology.edges.push(newEdge);
  topology.updatedAt = Date.now();
  return newEdge;
}

export function updateEdge(topologyId: string, edgeId: string, updates: Partial<NetworkEdge>): NetworkEdge | null {
  const topology = topologies.get(topologyId);
  if (!topology) return null;
  const idx = topology.edges.findIndex(e => e.id === edgeId);
  if (idx === -1) return null;
  topology.edges[idx] = { ...topology.edges[idx], ...updates };
  topology.updatedAt = Date.now();
  return topology.edges[idx];
}

export function deleteEdge(topologyId: string, edgeId: string): boolean {
  const topology = topologies.get(topologyId);
  if (!topology) return false;
  const before = topology.edges.length;
  topology.edges = topology.edges.filter(e => e.id !== edgeId);
  topology.updatedAt = Date.now();
  return topology.edges.length < before;
}
