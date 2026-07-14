import { Router } from 'express';
import * as handlers from '../handlers/packets.handlers.js';

const router = Router();

router.get('/stream', handlers.streamPackets);
router.get('/', handlers.listPackets);
router.get('/:id', handlers.getPacketById);
router.delete('/', handlers.clearPackets);

export default router;
