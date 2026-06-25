import { Router } from 'express'
import * as handlers from '../handlers/packets.handlers.js'

const router = Router()

router.get('/stream', handlers.streamPackets)
router.post('/start', handlers.startCapture)
router.post('/stop', handlers.stopCapture)
router.post('/clear', handlers.clearPackets)
router.get('/status', handlers.getStatus)
router.get('/stats', handlers.getStats)
router.get('/', handlers.listPackets)
router.get('/:id', handlers.getPacketById)

export default router
