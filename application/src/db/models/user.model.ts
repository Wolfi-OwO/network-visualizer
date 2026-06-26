import { Schema, model } from 'mongoose'

// An authenticated user (via Google, Microsoft, or local dev login).
const userSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    name: { type: String, required: true },
    avatar: { type: String },
    provider: { type: String, required: true },   // google | microsoft | local
    providerId: { type: String, required: true },
    role: { type: String, default: 'editor' },     // admin | editor | viewer
    createdAt: { type: Number, required: true },
  },
  {
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id
        delete ret.__v
        delete ret.providerId
        return ret
      },
    },
  },
)
userSchema.index({ provider: 1, providerId: 1 }, { unique: true })

export const UserModel = model('User', userSchema)
