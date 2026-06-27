import { api } from './client.ts'
import type { NetworkTopology, NetworkNode, NetworkEdge } from '../../types/index.ts'

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

export interface VersionSummary {
  id: string
  version: number
  label?: string
  name: string
  nodeCount: number
  edgeCount: number
  createdAt: number
}

export interface ControlPlaneReport {
  nodeId: string
  type: string
  hostname: string
  arp?: { ip: string; mac: string; iface: string; type: string }[]
  macTable?: { vlan: number; mac: string; port: string; type: string }[]
  dhcpLeases?: { ip: string; mac: string; hostname: string; state: string; lease: string }[]
  ospfNeighbors?: { neighborId: string; state: string; address: string; iface: string }[]
  stp?: { bridgeId: string; rootBridgeId: string; isRoot: boolean; ports: { port: string; neighbor: string; role: string; state: string }[] }
  acl?: { seq: number; action: string; protocol: string; src: string; dst: string; direction: string; hits: number; enabled: boolean }[]
  nat?: { protocol: string; insideLocal: string; insideGlobal: string; outsideGlobal: string }[]
}

// Topologies — RESTful resource at /api/networks
export const network = {
  list: () => api.get<{ items: NetworkTopology[]; count: number }>('/networks'),
  getDefault: () => api.get<NetworkTopology>('/networks/default'),
  get: (id: string) => api.get<NetworkTopology>(`/networks/${id}`),
  create: (name: string, description?: string) =>
    api.post<NetworkTopology>('/networks', { name, description }),
  update: (id: string, data: Partial<NetworkTopology>) =>
    api.put<NetworkTopology>(`/networks/${id}`, data),
  delete: (id: string) => api.delete<void>(`/networks/${id}`),
  addNode: (topologyId: string, node: Omit<NetworkNode, 'id'>) =>
    api.post<NetworkNode>(`/networks/${topologyId}/nodes`, node),
  updateNode: (topologyId: string, nodeId: string, data: Partial<NetworkNode>) =>
    api.put<NetworkNode>(`/networks/${topologyId}/nodes/${nodeId}`, data),
  deleteNode: (topologyId: string, nodeId: string) =>
    api.delete<void>(`/networks/${topologyId}/nodes/${nodeId}`),
  addEdge: (topologyId: string, edge: Omit<NetworkEdge, 'id'>) =>
    api.post<NetworkEdge>(`/networks/${topologyId}/edges`, edge),
  updateEdge: (topologyId: string, edgeId: string, data: Partial<NetworkEdge>) =>
    api.put<NetworkEdge>(`/networks/${topologyId}/edges/${edgeId}`, data),
  deleteEdge: (topologyId: string, edgeId: string) =>
    api.delete<void>(`/networks/${topologyId}/edges/${edgeId}`),
  validate: (id: string) => api.get<ValidationReport>(`/networks/${id}/validation`),
  controlPlane: (id: string, nodeId: string) =>
    api.get<ControlPlaneReport>(`/networks/${id}/nodes/${nodeId}/control-plane`),
  deviceConfig: (id: string, nodeId: string) =>
    api.get<string>(`/networks/${id}/nodes/${nodeId}/config`, { responseType: 'text' }),
  topologyConfig: (id: string) =>
    api.get<string>(`/networks/${id}/config`, { responseType: 'text' }),
  versions: (id: string) => api.get<{ count: number; items: VersionSummary[] }>(`/networks/${id}/versions`),
  createVersion: (id: string, label?: string) => api.post<VersionSummary>(`/networks/${id}/versions`, { label }),
  restoreVersion: (id: string, versionId: string) =>
    api.post<NetworkTopology>(`/networks/${id}/versions/${versionId}/restore`),
}
