import { Router, Request, Response } from 'express';
import * as networkService from '../services/networkService';

const router = Router();

// ── Lightweight schema validation for incoming topology data ──────────────────
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function validNodes(v: unknown): boolean {
  return Array.isArray(v) && v.every(n =>
    isObj(n) && typeof n.id === 'string' && typeof n.type === 'string'
    && isObj(n.position) && typeof n.position.x === 'number' && typeof n.position.y === 'number'
    && isObj(n.config));
}
function validEdges(v: unknown): boolean {
  return Array.isArray(v) && v.every(e =>
    isObj(e) && typeof e.id === 'string' && typeof e.source === 'string' && typeof e.target === 'string');
}
// Returns an error string if the patch is malformed, else null
function validateTopologyPatch(body: unknown): string | null {
  if (!isObj(body)) return 'Body must be an object';
  if ('nodes' in body && !validNodes(body.nodes)) return 'Invalid nodes: each needs id, type, position {x,y}, config';
  if ('edges' in body && !validEdges(body.edges)) return 'Invalid edges: each needs id, source, target';
  return null;
}

router.get('/', (_req: Request, res: Response) => {
  const topologies = networkService.getAllTopologies();
  if (topologies.length === 0) {
    networkService.getOrCreateDefault();
  }
  res.json(networkService.getAllTopologies());
});

router.get('/default', (_req: Request, res: Response) => {
  const topology = networkService.getOrCreateDefault();
  res.json(topology);
});

router.post('/', (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const topology = networkService.createTopology(name, description);
  res.status(201).json(topology);
});

router.get('/:id', (req: Request, res: Response) => {
  const topology = networkService.getTopology(req.params.id);
  if (!topology) {
    res.status(404).json({ error: 'Topology not found' });
    return;
  }
  res.json(topology);
});

router.put('/:id', (req: Request, res: Response) => {
  const err = validateTopologyPatch(req.body);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }
  const topology = networkService.updateTopology(req.params.id, req.body);
  if (!topology) {
    res.status(404).json({ error: 'Topology not found' });
    return;
  }
  res.json(topology);
});

router.delete('/:id', (req: Request, res: Response) => {
  const deleted = networkService.deleteTopology(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Topology not found' });
    return;
  }
  res.json({ deleted: true });
});

router.post('/:id/nodes', (req: Request, res: Response) => {
  const node = networkService.addNode(req.params.id, req.body);
  if (!node) {
    res.status(404).json({ error: 'Topology not found' });
    return;
  }
  res.status(201).json(node);
});

router.put('/:id/nodes/:nodeId', (req: Request, res: Response) => {
  const node = networkService.updateNode(req.params.id, req.params.nodeId, req.body);
  if (!node) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }
  res.json(node);
});

router.delete('/:id/nodes/:nodeId', (req: Request, res: Response) => {
  const deleted = networkService.deleteNode(req.params.id, req.params.nodeId);
  if (!deleted) {
    res.status(404).json({ error: 'Node not found' });
    return;
  }
  res.json({ deleted: true });
});

router.post('/:id/edges', (req: Request, res: Response) => {
  const edge = networkService.addEdge(req.params.id, req.body);
  if (!edge) {
    res.status(404).json({ error: 'Topology not found' });
    return;
  }
  res.status(201).json(edge);
});

router.put('/:id/edges/:edgeId', (req: Request, res: Response) => {
  const edge = networkService.updateEdge(req.params.id, req.params.edgeId, req.body);
  if (!edge) {
    res.status(404).json({ error: 'Edge not found' });
    return;
  }
  res.json(edge);
});

router.delete('/:id/edges/:edgeId', (req: Request, res: Response) => {
  const deleted = networkService.deleteEdge(req.params.id, req.params.edgeId);
  if (!deleted) {
    res.status(404).json({ error: 'Edge not found' });
    return;
  }
  res.json({ deleted: true });
});

export default router;
