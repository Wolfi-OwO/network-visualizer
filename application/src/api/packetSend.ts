import { Router, type Request, type Response } from 'express'
import { tracePacket, type SendPacketRequest } from '../services/packetSenderService.js'
import { getTopology, getOrCreateDefault } from '../db/networkService.js'
import { BadRequestError, NotFoundError } from '../lib/errors.js'

const router = Router()

router.post('/trace', (req: Request, res: Response) => {
  const body = req.body as SendPacketRequest & { topologyId?: string }

  if (!body.srcNodeId || !body.dstNodeId || !body.protocol) {
    throw new BadRequestError('srcNodeId, dstNodeId, and protocol are required')
  }

  const topology = body.topologyId ? getTopology(body.topologyId) : getOrCreateDefault()
  if (!topology) throw new NotFoundError('Topology not found')

  res.json(tracePacket(topology, body))
})

export default router
