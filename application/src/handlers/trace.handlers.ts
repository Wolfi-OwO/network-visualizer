import { Request, Response } from 'express'
import { tracePacket, type SendPacketRequest } from '../services/packet-sender-service.js'
import { getTopology, getOrCreateDefault } from '../db/network-service.js'
import { BadRequestError, NotFoundError } from '../lib/errors.js'
import { withLinks, type Links } from '../lib/hateoas.js'

// POST /api/networks/:id/traces — create a packet trace through a topology.
// :id may be a topology id or the well-known alias "default".
export async function createTrace(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const body = req.body as SendPacketRequest

  if (!body.srcNodeId || !body.dstNodeId || !body.protocol) {
    throw new BadRequestError('srcNodeId, dstNodeId, and protocol are required')
  }

  const topology = id === 'default' ? await getOrCreateDefault() : await getTopology(id)
  if (!topology) throw new NotFoundError('Topology not found')

  const result = tracePacket(topology, body)
  const links: Links = {
    self: { href: `/api/networks/${topology.id}/traces` },
    topology: { href: `/api/networks/${topology.id}` },
  }
  res.status(201).json(withLinks(result as object, links))
}
