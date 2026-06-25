import axios from 'axios'
import type { Packet, PacketStats, NetworkTopology, NetworkNode, NetworkEdge, CIDRResult } from '../types'

const api = axios.create({ baseURL: '/api' })

export const packets = {
  list: (since?: number, limit = 200) =>
    api.get<{ packets: Packet[]; total: number }>('/packets', { params: { since, limit } }),
  getById: (id: number) => api.get<Packet>(`/packets/${id}`),
  start: () => api.post<{ status: string; capturing: boolean }>('/packets/start'),
  stop: () => api.post<{ status: string; capturing: boolean }>('/packets/stop'),
  clear: () => api.post<{ status: string }>('/packets/clear'),
  status: () => api.get<{ capturing: boolean; stats: PacketStats }>('/packets/status'),
  stats: () => api.get<PacketStats>('/packets/stats'),
  streamUrl: () => '/api/packets/stream',
}

export const cidr = {
  calculate: (input: string) =>
    api.post<CIDRResult>('/cidr/calculate', { input }),
  subnets: (network: string, count?: number, prefixLength?: number) =>
    api.post<{ subnets: CIDRResult[]; count: number }>('/cidr/subnets', { network, count, prefixLength }),
  supernet: (networks: string[]) =>
    api.post<CIDRResult>('/cidr/supernet', { networks }),
}

export interface TraceHop {
  step: number
  nodeId: string
  nodeName: string
  nodeType: string
  action: string
  detail: string
  firewallRule?: { priority: number; action: string; description: string }
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

export const send = {
  trace: (params: {
    srcNodeId: string
    dstNodeId: string
    protocol: 'tcp' | 'udp' | 'icmp'
    dstPort?: number
    ttl?: number
    topologyId?: string
  }) => api.post<TraceResult>('/send/trace', params),
}

export const network = {
  list: () => api.get<NetworkTopology[]>('/network'),
  getDefault: () => api.get<NetworkTopology>('/network/default'),
  get: (id: string) => api.get<NetworkTopology>(`/network/${id}`),
  create: (name: string, description?: string) =>
    api.post<NetworkTopology>('/network', { name, description }),
  update: (id: string, data: Partial<NetworkTopology>) =>
    api.put<NetworkTopology>(`/network/${id}`, data),
  delete: (id: string) => api.delete<{ deleted: boolean }>(`/network/${id}`),
  addNode: (topologyId: string, node: Omit<NetworkNode, 'id'>) =>
    api.post<NetworkNode>(`/network/${topologyId}/nodes`, node),
  updateNode: (topologyId: string, nodeId: string, data: Partial<NetworkNode>) =>
    api.put<NetworkNode>(`/network/${topologyId}/nodes/${nodeId}`, data),
  deleteNode: (topologyId: string, nodeId: string) =>
    api.delete<{ deleted: boolean }>(`/network/${topologyId}/nodes/${nodeId}`),
  addEdge: (topologyId: string, edge: Omit<NetworkEdge, 'id'>) =>
    api.post<NetworkEdge>(`/network/${topologyId}/edges`, edge),
  updateEdge: (topologyId: string, edgeId: string, data: Partial<NetworkEdge>) =>
    api.put<NetworkEdge>(`/network/${topologyId}/edges/${edgeId}`, data),
  deleteEdge: (topologyId: string, edgeId: string) =>
    api.delete<{ deleted: boolean }>(`/network/${topologyId}/edges/${edgeId}`),
}
