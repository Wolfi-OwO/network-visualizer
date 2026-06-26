import type { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { AuditModel } from '../db/models/audit.model.js'
import { logger } from '../lib/logger.js'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Records mutating, authenticated requests to the audit log (fire-and-forget).
export function audit(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method)) return next()
  res.on('finish', () => {
    if (!req.user) return                       // only log actions by known users
    if (res.statusCode >= 400) return           // skip failed attempts
    AuditModel.create({
      id: uuidv4(),
      userId: req.user.id,
      userEmail: req.user.email,
      action: `${req.method} ${req.baseUrl}${req.path}`,
      method: req.method,
      path: `${req.baseUrl}${req.path}`,
      status: res.statusCode,
      at: Date.now(),
    }).catch((err) => logger.error('audit write failed', err))
  })
  next()
}
