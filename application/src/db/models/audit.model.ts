import { Schema, model } from 'mongoose'

// An audit-log entry: who changed what, when.
const auditSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true },
    action: { type: String, required: true },   // e.g. "create network", "delete node"
    method: { type: String, required: true },
    path: { type: String, required: true },
    status: { type: Number, required: true },
    at: { type: Number, required: true, index: true },
  },
  {
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => { delete ret._id; delete ret.__v; return ret },
    },
  },
)

export const AuditModel = model('AuditEntry', auditSchema)
