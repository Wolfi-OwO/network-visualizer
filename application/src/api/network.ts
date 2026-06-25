import { Router, Request, Response } from 'express';
import * as networkService from '../db/networkService.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';

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
// Throws BadRequestError if the patch is malformed
function assertValidTopologyPatch(body: unknown): void {
  if (!isObj(body)) throw new BadRequestError('Body must be an object');
  if ('nodes' in body && !validNodes(body.nodes)) throw new BadRequestError('Invalid nodes: each needs id, type, position {x,y}, config');
  if ('edges' in body && !validEdges(body.edges)) throw new BadRequestError('Invalid edges: each needs id, source, target');
}

router.get('/', (_req: Request, res: Response) => {
  const topologies = networkService.getAllTopologies();
  if (topologies.length === 0) {
    networkService.getOrCreateDefault();
  }
  res.json(networkService.getAllTopologies());
});

router.get('/default', (_req: Request, res: Response) => {
  res.json(networkService.getOrCreateDefault());
});

router.post('/', (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) throw new BadRequestError('name is required');
  res.status(201).json(networkService.createTopology(name, description));
});

router.get('/:id', (req: Request, res: Response) => {
  const topology = networkService.getTopology(req.params.id);
  if (!topology) throw new NotFoundError('Topology not found');
  res.json(topology);
});

router.put('/:id', (req: Request, res: Response) => {
  assertValidTopologyPatch(req.body);
  const topology = networkService.updateTopology(req.params.id, req.body);
  if (!topology) throw new NotFoundError('Topology not found');
  res.json(topology);
});

router.delete('/:id', (req: Request, res: Response) => {
  if (!networkService.deleteTopology(req.params.id)) throw new NotFoundError('Topology not found');
  res.json({ deleted: true });
});

router.post('/:id/nodes', (req: Request, res: Response) => {
  const node = networkService.addNode(req.params.id, req.body);
  if (!node) throw new NotFoundError('Topology not found');
  res.status(201).json(node);
});

router.put('/:id/nodes/:nodeId', (req: Request, res: Response) => {
  const node = networkService.updateNode(req.params.id, req.params.nodeId, req.body);
  if (!node) throw new NotFoundError('Node not found');
  res.json(node);
});

router.delete('/:id/nodes/:nodeId', (req: Request, res: Response) => {
  if (!networkService.deleteNode(req.params.id, req.params.nodeId)) throw new NotFoundError('Node not found');
  res.json({ deleted: true });
});

router.post('/:id/edges', (req: Request, res: Response) => {
  const edge = networkService.addEdge(req.params.id, req.body);
  if (!edge) throw new NotFoundError('Topology not found');
  res.status(201).json(edge);
});

router.put('/:id/edges/:edgeId', (req: Request, res: Response) => {
  const edge = networkService.updateEdge(req.params.id, req.params.edgeId, req.body);
  if (!edge) throw new NotFoundError('Edge not found');
  res.json(edge);
});

router.delete('/:id/edges/:edgeId', (req: Request, res: Response) => {
  if (!networkService.deleteEdge(req.params.id, req.params.edgeId)) throw new NotFoundError('Edge not found');
  res.json({ deleted: true });
});

export default router;
