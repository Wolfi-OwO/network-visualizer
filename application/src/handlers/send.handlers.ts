import { Request, Response } from 'express'
import { tracePacket, type SendPacketRequest } from '../services/packetSenderService.js'
import { getTopology, getOrCreateDefault } from '../db/networkService.js'
import { BadRequestError, NotFoundError } from '../lib/errors.js'

export async function trace(req: Request, res: Response): Promise<void> {
  const body = req.body as SendPacketRequest & { topologyId?: string }

  if (!body.srcNodeId || !body.dstNodeId || !body.protocol) {
    throw new BadRequestError('srcNodeId, dstNodeId, and protocol are required')
  }

  const topology = body.topologyId ? await getTopology(body.topologyId) : await getOrCreateDefault()
  if (!topology) throw new NotFoundError('Topology not found')

  res.json(tracePacket(topology, body))
}
