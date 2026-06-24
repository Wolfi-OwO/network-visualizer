import { Router, Request, Response } from 'express';
import * as sim from '../services/packetSimulator';

const router = Router();

router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  let lastId = 0;

  const send = () => {
    const packets = sim.getPackets(lastId, 50);
    if (packets.length > 0) {
      lastId = packets[packets.length - 1].id;
      res.write(`data: ${JSON.stringify(packets)}\n\n`);
    }
  };

  const interval = setInterval(send, 300);

  req.on('close', () => {
    clearInterval(interval);
  });
});

router.post('/start', (_req: Request, res: Response) => {
  sim.startCapture();
  res.json({ status: 'started', capturing: true });
});

router.post('/stop', (_req: Request, res: Response) => {
  sim.stopCapture();
  res.json({ status: 'stopped', capturing: false });
});

router.post('/clear', (_req: Request, res: Response) => {
  sim.clearPackets();
  res.json({ status: 'cleared' });
});

router.get('/status', (_req: Request, res: Response) => {
  res.json({ capturing: sim.isRunning(), stats: sim.getStats() });
});

router.get('/stats', (_req: Request, res: Response) => {
  res.json(sim.getStats());
});

router.get('/', (req: Request, res: Response) => {
  const since = req.query.since ? parseInt(req.query.since as string) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;
  const packets = sim.getPackets(since, limit);
  res.json({ packets, total: packets.length });
});

router.get('/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const packet = sim.getPacketById(id);
  if (!packet) {
    res.status(404).json({ error: 'Packet not found' });
    return;
  }
  res.json(packet);
});

export default router;
