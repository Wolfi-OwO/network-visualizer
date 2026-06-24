import { Router, Request, Response } from 'express';
import * as cidrService from '../services/cidrService';

const router = Router();

router.post('/calculate', (req: Request, res: Response) => {
  try {
    const { input } = req.body;
    if (!input) {
      res.status(400).json({ error: 'Input is required' });
      return;
    }
    const result = cidrService.parseCIDR(input);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/subnets', (req: Request, res: Response) => {
  try {
    const { network, count, prefixLength } = req.body;
    if (!network) {
      res.status(400).json({ error: 'network is required' });
      return;
    }
    const subnets = cidrService.generateSubnets(network, count, prefixLength);
    res.json({ subnets, count: subnets.length });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/supernet', (req: Request, res: Response) => {
  try {
    const { networks } = req.body;
    if (!networks || !Array.isArray(networks) || networks.length < 2) {
      res.status(400).json({ error: 'networks array with at least 2 entries is required' });
      return;
    }
    const result = cidrService.findSupernet(networks);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/validate/:ip', (req: Request, res: Response) => {
  const valid = cidrService.validateIpAddress(req.params.ip);
  res.json({ ip: req.params.ip, valid });
});

export default router;
