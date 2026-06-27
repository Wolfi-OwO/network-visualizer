import { api } from './client.ts'

export interface Metrics {
  status: string
  uptimeSeconds: number
  timestamp: string
  requests: number
  process: { node: string; pid: number; memoryMB: { rss: number; heapUsed: number; heapTotal: number } }
  database: { state: string; topologies: number; users: number; auditEntries: number; versions: number }
  capture: { capturing: boolean; packets: number; packetsPerSecond: number; bytesPerSecond: number }
  auth: { providers: string[] }
}

export type ComponentStatus = 'operational' | 'degraded' | 'down' | 'idle'

export interface StatusComponent {
  key: string
  name: string
  status: ComponentStatus
  uptime?: { h24: number; d7: number; d30: number }
}

export interface StatusReport {
  status: 'operational' | 'degraded' | 'down'
  currentUptimeSeconds: number
  monitoringSince: number
  sampleIntervalMs: number
  components: StatusComponent[]
  history: { at: number; ok: boolean; db: boolean }[]
}

// Admin observability — runtime + application metrics; plus the public status page.
export const system = {
  metrics: () => api.get<Metrics>('/metrics'),
  status: () => api.get<StatusReport>('/status'),
}
