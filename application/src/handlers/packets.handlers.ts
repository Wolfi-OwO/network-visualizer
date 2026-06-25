import { Request, Response } from 'express'
import * as sim from '../services/packetSimulator.js'
import { BadRequestError, NotFoundError } from '../lib/errors.js'

export function streamPackets(req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  let lastId = 0
  const send = () => {
    const packets = sim.getPackets(lastId, 50)
    if (packets.length > 0) {
      lastId = packets[packets.length - 1].id
      res.write(`data: ${JSON.stringify(packets)}\n\n`)
    }
  }
  const interval = setInterval(send, 300)
  req.on('close', () => clearInterval(interval))
}

export function startCapture(_req: Request, res: Response): void {
  sim.startCapture()
  res.json({ status: 'started', capturing: true })
}

export function stopCapture(_req: Request, res: Response): void {
  sim.stopCapture()
  res.json({ status: 'stopped', capturing: false })
}

export function clearPackets(_req: Request, res: Response): void {
  sim.clearPackets()
  res.json({ status: 'cleared' })
}

export function getStatus(_req: Request, res: Response): void {
  res.json({ capturing: sim.isRunning(), stats: sim.getStats() })
}

export function getStats(_req: Request, res: Response): void {
  res.json(sim.getStats())
}

export function listPackets(req: Request, res: Response): void {
  const since = req.query.since ? parseInt(req.query.since as string) : undefined
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 200
  const packets = sim.getPackets(since, limit)
  res.json({ packets, total: packets.length })
}

export function getPacketById(req: Request, res: Response): void {
  const id = parseInt(req.params.id)
  if (Number.isNaN(id)) throw new BadRequestError('id must be a number')
  const packet = sim.getPacketById(id)
  if (!packet) throw new NotFoundError('Packet not found')
  res.json(packet)
}
