import { Schema, model, type InferSchemaType } from 'mongoose'

// Nodes and edges carry deeply-nested, device-specific config, so we store them
// as flexible Mixed sub-documents and rely on the shared TS types for shape.
const topologySchema = new Schema(
  {
    /** Business id (uuid) exposed by the API — distinct from Mongo's _id */
    id: { type: String, required: true, unique: true, index: true },
    /** Owner: the user id, or 'local' for the anonymous workspace */
    ownerId: { type: String, required: true, default: 'local', index: true },
    name: { type: String, required: true },
    description: { type: String },
    nodes: { type: [Schema.Types.Mixed], default: [] },
    edges: { type: [Schema.Types.Mixed], default: [] },
    /** Marks the seeded sample topology returned by GET /api/network/default */
    isDefault: { type: Boolean, default: false, index: true },
    createdAt: { type: Number, required: true },
    updatedAt: { type: Number, required: true },
  },
  {
    // Return clean JSON (no _id / __v / isDefault) that matches NetworkTopology.
    toJSON: {
      virtuals: false,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id
        delete ret.__v
        delete ret.isDefault
        delete ret.ownerId
        return ret
      },
    },
  },
)

export type TopologyDocument = InferSchemaType<typeof topologySchema>

export const TopologyModel = model('Topology', topologySchema)
