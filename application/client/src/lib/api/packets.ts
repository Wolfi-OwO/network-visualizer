import { api } from './client'
import type { Packet, PacketStats } from '../../types'

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
