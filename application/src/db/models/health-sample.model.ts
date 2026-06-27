import { Schema, model } from 'mongoose'

// A periodic health probe used to compute service uptime for the status page.
const healthSampleSchema = new Schema(
  {
    at: { type: Number, required: true, index: true },   // epoch ms
    ok: { type: Boolean, required: true },                // process answered the probe
    db: { type: Boolean, required: true },                // database reachable
    capture: { type: Boolean, required: true },           // packet capture running
    latencyMs: { type: Number, required: true },
    // Auto-expire samples after 90 days.
    createdAt: { type: Date, default: Date.now, expires: 90 * 24 * 60 * 60 },
  },
  { toJSON: { transform: (_d, ret: Record<string, unknown>) => { delete ret._id; delete ret.__v; delete ret.createdAt; return ret } } },
)

export const HealthSampleModel = model('HealthSample', healthSampleSchema)
