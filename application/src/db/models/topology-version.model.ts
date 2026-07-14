import { Schema, model } from 'mongoose';

// An immutable snapshot of a topology at a point in time.
const versionSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    topologyId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    version: { type: Number, required: true }, // incrementing per topology
    label: { type: String },
    name: { type: String, required: true },
    nodes: { type: [Schema.Types.Mixed], default: [] },
    edges: { type: [Schema.Types.Mixed], default: [] },
    createdAt: { type: Number, required: true },
  },
  {
    minimize: false,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.__v;
        delete ret.ownerId;
        return ret;
      },
    },
  },
);
versionSchema.index({ topologyId: 1, version: 1 }, { unique: true });

export const TopologyVersionModel = model('TopologyVersion', versionSchema);
