import { api } from './client.ts'

export interface Metrics {
  status: string
  uptimeSeconds: number
  timestamp: string
  requests: number
  process: {
    node: string
    pid: number
    memoryMB: { rss: number; heapUsed: number; heapTotal: number }
  }
  database: {
    state: string
    topologies: number
    users: number
    auditEntries: number
    versions: number
  }
  capture: { capturing: boolean; packets: number; packetsPerSecond: number; bytesPerSecond: number }
  auth: { providers: string[] }
}

// Admin observability — runtime + application metrics.
export const system = {
  // `silent`: the admin dashboard polls this and handles a non-admin 403 itself.
  metrics: () => api.get<Metrics>('/metrics', { silent: true }),
}
