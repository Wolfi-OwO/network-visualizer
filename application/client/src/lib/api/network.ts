import { api } from './client'
import type { NetworkTopology, NetworkNode, NetworkEdge } from '../../types'

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
