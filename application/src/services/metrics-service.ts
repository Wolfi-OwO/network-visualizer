import mongoose from 'mongoose'
import type { Request, Response, NextFunction } from 'express'
import { TopologyModel } from '../db/models/topology.model.js'
import { UserModel } from '../db/models/user.model.js'
import { AuditModel } from '../db/models/audit.model.js'
import { TopologyVersionModel } from '../db/models/topology-version.model.js'
import * as sim from './packet-simulator.js'
import { enabledProviders } from '../config/index.js'

export interface Metrics {
  status: 'ok'
  uptimeSeconds: number
  timestamp: string
  requests: number
  process: { node: string; pid: number; memoryMB: { rss: number; heapUsed: number; heapTotal: number } }
  database: { state: string; topologies: number; users: number; auditEntries: number; versions: number }
  capture: { capturing: boolean; packets: number; packetsPerSecond: number; bytesPerSecond: number }
  auth: { providers: string[] }
}

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting']
const mb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10
const round1 = (n: number) => Math.round(n * 10) / 10

// ── Lightweight request counter ───────────────────────────────────────────────
let requestCount = 0
export function countRequest(_req: Request, _res: Response, next: NextFunction): void {
  requestCount++
  next()
}

export async function collectMetrics(): Promise<Metrics> {
  const mem = process.memoryUsage()
  const connected = mongoose.connection.readyState === 1
  const [topologies, users, auditEntries, versions] = connected
    ? await Promise.all([
        TopologyModel.countDocuments(),
        UserModel.countDocuments(),
        AuditModel.countDocuments(),
        TopologyVersionModel.countDocuments(),
      ])
    : [0, 0, 0, 0]
  const stats = sim.getStats()
  return {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    requests: requestCount,
    process: {
      node: process.version,
      pid: process.pid,
      memoryMB: { rss: mb(mem.rss), heapUsed: mb(mem.heapUsed), heapTotal: mb(mem.heapTotal) },
    },
    database: { state: DB_STATES[mongoose.connection.readyState] ?? 'unknown', topologies, users, auditEntries, versions },
    capture: {
      capturing: sim.isRunning(),
      packets: stats.total,
      packetsPerSecond: round1(stats.packetsPerSecond),
      bytesPerSecond: round1(stats.bytesPerSecond),
    },
    auth: { providers: enabledProviders() },
  }
}
