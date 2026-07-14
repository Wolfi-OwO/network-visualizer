import type { Request, Response } from 'express';
import { AuditModel } from '../db/models/audit.model.js';
import { withLinks } from '../lib/hateoas.js';

// GET /api/audit — recent audit entries (admin only; enforced by route guard).
export async function listAudit(req: Request, res: Response): Promise<void> {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const docs = await AuditModel.find().sort({ at: -1 }).limit(limit);
  const items = docs.map((d) => d.toJSON());
  res.json(withLinks({ count: items.length, items } as object, { self: { href: '/api/audit' } }));
}
