import type { Request, Response } from 'express';
import { collectMetrics } from '../services/metrics-service.js';
import { withLinks } from '../lib/hateoas.js';

// GET /api/metrics — runtime + application metrics (admin only; enforced by route).
export async function getMetrics(_req: Request, res: Response): Promise<void> {
  const metrics = await collectMetrics();
  res.json(withLinks(metrics as object, { self: { href: '/api/metrics' } }));
}
