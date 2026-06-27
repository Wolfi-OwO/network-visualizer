import type { Request, Response } from 'express'
import { getStatus } from '../services/status-service.js'
import { withLinks } from '../lib/hateoas.js'

// GET /api/status — public service status + uptime (the status page data).
export async function getServiceStatus(_req: Request, res: Response): Promise<void> {
  const report = await getStatus()
  res.json(withLinks(report as object, { self: { href: '/api/status' } }))
}
