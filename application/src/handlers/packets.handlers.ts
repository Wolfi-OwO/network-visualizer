import { Request, Response } from 'express'
import * as sim from '../services/packet-simulator.js'
import { BadRequestError, NotFoundError } from '../lib/errors.js'
import { withLinks, packetLinks, packetsCollectionLinks } from '../lib/hateoas.js'

// GET /api/packets — captured packets (collection).
export function listPackets(req: Request, res: Response): void {
  const since = req.query.since ? parseInt(req.query.since as string) : undefined
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 200
  const packets = sim.getPackets(since, limit)
  res.json({ _links: packetsCollectionLinks(), count: packets.length, items: packets })
}

// GET /api/packets/:id — single captured packet.
export function getPacketById(req: Request, res: Response): void {
  const id = parseInt(req.params.id)
  if (Number.isNaN(id)) throw new BadRequestError('id must be a number')
  const packet = sim.getPacketById(id)
  if (!packet) throw new NotFoundError('Packet not found')
  res.json(withLinks(packet, packetLinks(id)))
}

// GET /api/packets/stream — live packet feed (Server-Sent Events).
export function streamPackets(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  let lastId = 0
  const tick = () => {
    const packets = sim.getPackets(lastId, 50)
    if (packets.length > 0) {
      lastId = packets[packets.length - 1].id
      res.write(`data: ${JSON.stringify(packets)}\n\n`)
    }
  }
  const interval = setInterval(tick, 300)
  req.on('close', () => clearInterval(interval))
}

// DELETE /api/packets — clear all captured packets.
export function clearPackets(_req: Request, res: Response): void {
  sim.clearPackets()
  res.status(204).end()
}
