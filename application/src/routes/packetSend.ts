import { Router, type Request, type Response } from 'express'
import { tracePacket, type SendPacketRequest } from '../services/packetSenderService'
import { getTopology, getOrCreateDefault } from '../services/networkService'

const router = Router()

router.post('/trace', (req: Request, res: Response) => {
  try {
    const body = req.body as SendPacketRequest & { topologyId?: string }

    if (!body.srcNodeId || !body.dstNodeId || !body.protocol) {
      res.status(400).json({ error: 'srcNodeId, dstNodeId, and protocol are required' })
      return
    }

    const topology = body.topologyId
      ? getTopology(body.topologyId)
      : getOrCreateDefault()

    if (!topology) {
      res.status(404).json({ error: 'Topology not found' })
      return
    }

    const result = tracePacket(topology, body)
    res.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Trace failed'
    res.status(500).json({ error: msg })
  }
})

export default router
