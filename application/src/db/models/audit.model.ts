import { Schema, model } from 'mongoose';
import { config } from '../../config/index.js';

// An audit-log entry: who changed what, when.
const auditSchema = new Schema(
  {
    id: { type: String, required: true, unique: true },
    // No userEmail: userId already identifies the actor, and retaining a
    // plaintext email for up to 90 days past account erasure (see
    // auth-service's eraseUserAndOwnedData) fails Art. 5(1)(c) minimisation.
    userId: { type: String, required: true, index: true },
    action: { type: String, required: true }, // e.g. "create network", "delete node"
    method: { type: String, required: true },
    path: { type: String, required: true },
    status: { type: Number, required: true },
    at: { type: Number, required: true, index: true },
    // TTL field — entries auto-expire after the configured retention period.
    createdAt: { type: Date, default: Date.now, expires: config.auditRetentionDays * 24 * 60 * 60 },
  },
  {
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        return ret;
      },
    },
  },
);

export const AuditModel = model('AuditEntry', auditSchema);
