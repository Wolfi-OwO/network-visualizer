import { Request, Response } from 'express'
import * as sim from '../services/packet-simulator.js'
import { BadRequestError } from '../lib/errors.js'
import { captureLinks } from '../lib/hateoas.js'

function captureResource() {
  return { capturing: sim.isRunning(), stats: sim.getStats(), _links: captureLinks() }
}

// GET /api/capture — current capture state + statistics.
export function getCapture(_req: Request, res: Response): void {
  res.json(captureResource())
}

// PATCH /api/capture — start/stop capturing via { "capturing": true|false }.
export function updateCapture(req: Request, res: Response): void {
  const { capturing } = req.body
  if (typeof capturing !== 'boolean') throw new BadRequestError('capturing (boolean) is required')
  if (capturing) sim.startCapture()
  else sim.stopCapture()
  res.json(captureResource())
}
