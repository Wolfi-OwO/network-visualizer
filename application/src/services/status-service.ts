import mongoose from 'mongoose'
import { HealthSampleModel } from '../db/models/health-sample.model.js'
import * as sim from './packet-simulator.js'
import { config } from '../config/index.js'
import { logger } from '../lib/logger.js'

const SAMPLE_MS = config.healthSampleSeconds * 1000
const DAY = 24 * 60 * 60 * 1000
const round1 = (n: number) => Math.round(n * 10) / 10

export type ComponentStatus = 'operational' | 'degraded' | 'down' | 'idle'

export interface StatusComponent {
  key: string
  name: string
  status: ComponentStatus
  uptime?: { h24: number; d7: number; d30: number }
}

export interface StatusReport {
  status: 'operational' | 'degraded' | 'down'
  currentUptimeSeconds: number          // since this process started
  monitoringSince: number               // first recorded sample
  sampleIntervalMs: number
  components: StatusComponent[]
  history: { at: number; ok: boolean; db: boolean }[]
}

// ── Sampling ──────────────────────────────────────────────────────────────────
async function recordSample(): Promise<void> {
  const start = Date.now()
  let db = false
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db?.admin().ping()
      db = true
    }
  } catch { /* db unreachable */ }
  try {
    await HealthSampleModel.create({
      at: Date.now(), ok: true, db, capture: sim.isRunning(), latencyMs: Date.now() - start,
    })
  } catch (err) {
    logger.error('health sample write failed', err)
  }
}

let sampler: ReturnType<typeof setInterval> | null = null

/** Begin periodic health sampling (records the first sample immediately). */
export function startHealthSampler(): void {
  if (sampler) return
  void recordSample()
  sampler = setInterval(() => void recordSample(), SAMPLE_MS)
  if (typeof sampler.unref === 'function') sampler.unref()
}

export function stopHealthSampler(): void {
  if (sampler) { clearInterval(sampler); sampler = null }
}

// Exposed for tests.
export { recordSample }

// ── Reporting ─────────────────────────────────────────────────────────────────
async function uptimePct(field: 'ok' | 'db', windowMs: number, since: number): Promise<number> {
  const now = Date.now()
  const start = Math.max(now - windowMs, since)
  const span = now - start
  if (span <= SAMPLE_MS) return 100
  const expected = Math.max(1, Math.round(span / SAMPLE_MS))
  const count = await HealthSampleModel.countDocuments({ at: { $gte: start }, [field]: true })
  return round1(Math.min(100, (count / expected) * 100))
}

export async function getStatus(): Promise<StatusReport> {
  const first = await HealthSampleModel.findOne().sort({ at: 1 })
  const latest = await HealthSampleModel.findOne().sort({ at: -1 })
  const monitoringSince = first?.at ?? Date.now()
  const dbUp = mongoose.connection.readyState === 1
  // API is "up" if we have a fresh sample (or none yet — fresh start).
  const apiUp = !latest || Date.now() - latest.at < SAMPLE_MS * 3

  const win = async (field: 'ok' | 'db') => ({
    h24: await uptimePct(field, DAY, monitoringSince),
    d7: await uptimePct(field, 7 * DAY, monitoringSince),
    d30: await uptimePct(field, 30 * DAY, monitoringSince),
  })

  const components: StatusComponent[] = [
    { key: 'api', name: 'API', status: apiUp ? 'operational' : 'down', uptime: await win('ok') },
    { key: 'database', name: 'Database', status: dbUp ? 'operational' : 'down', uptime: await win('db') },
    { key: 'capture', name: 'Packet capture', status: sim.isRunning() ? 'operational' : 'idle' },
  ]

  const history = (await HealthSampleModel.find().sort({ at: -1 }).limit(90))
    .reverse()
    .map((s) => ({ at: s.at, ok: s.ok, db: s.db }))

  const status: StatusReport['status'] = components.some((c) => c.status === 'down')
    ? 'down'
    : components.some((c) => c.status === 'degraded') ? 'degraded' : 'operational'

  return {
    status,
    currentUptimeSeconds: Math.round(process.uptime()),
    monitoringSince,
    sampleIntervalMs: SAMPLE_MS,
    components,
    history,
  }
}
