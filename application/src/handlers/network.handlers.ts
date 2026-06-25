import { Request, Response } from 'express'
import * as networkService from '../db/networkService.js'
import { BadRequestError, NotFoundError } from '../lib/errors.js'

// ── Lightweight schema validation for incoming topology data ──────────────────
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
function validNodes(v: unknown): boolean {
  return Array.isArray(v) && v.every((n) =>
    isObj(n) && typeof n.id === 'string' && typeof n.type === 'string'
    && isObj(n.position) && typeof n.position.x === 'number' && typeof n.position.y === 'number'
    && isObj(n.config))
}
function validEdges(v: unknown): boolean {
  return Array.isArray(v) && v.every((e) =>
    isObj(e) && typeof e.id === 'string' && typeof e.source === 'string' && typeof e.target === 'string')
}
function assertValidTopologyPatch(body: unknown): void {
  if (!isObj(body)) throw new BadRequestError('Body must be an object')
  if ('nodes' in body && !validNodes(body.nodes)) throw new BadRequestError('Invalid nodes: each needs id, type, position {x,y}, config')
  if ('edges' in body && !validEdges(body.edges)) throw new BadRequestError('Invalid edges: each needs id, source, target')
}

// ── Topology collection ───────────────────────────────────────────────────────
export async function listTopologies(_req: Request, res: Response): Promise<void> {
  if ((await networkService.getAllTopologies()).length === 0) await networkService.getOrCreateDefault()
  res.json(await networkService.getAllTopologies())
}

export async function getDefaultTopology(_req: Request, res: Response): Promise<void> {
  res.json(await networkService.getOrCreateDefault())
}

export async function createTopology(req: Request, res: Response): Promise<void> {
  const { name, description } = req.body
  if (!name) throw new BadRequestError('name is required')
  res.status(201).json(await networkService.createTopology(name, description))
}

export async function getTopologyById(req: Request, res: Response): Promise<void> {
  const topology = await networkService.getTopology(req.params.id)
  if (!topology) throw new NotFoundError('Topology not found')
  res.json(topology)
}

export async function updateTopology(req: Request, res: Response): Promise<void> {
  assertValidTopologyPatch(req.body)
  const topology = await networkService.updateTopology(req.params.id, req.body)
  if (!topology) throw new NotFoundError('Topology not found')
  res.json(topology)
}

export async function deleteTopology(req: Request, res: Response): Promise<void> {
  if (!(await networkService.deleteTopology(req.params.id))) throw new NotFoundError('Topology not found')
  res.json({ deleted: true })
}

// ── Nodes ─────────────────────────────────────────────────────────────────────
export async function addNode(req: Request, res: Response): Promise<void> {
  const node = await networkService.addNode(req.params.id, req.body)
  if (!node) throw new NotFoundError('Topology not found')
  res.status(201).json(node)
}

export async function updateNode(req: Request, res: Response): Promise<void> {
  const node = await networkService.updateNode(req.params.id, req.params.nodeId, req.body)
  if (!node) throw new NotFoundError('Node not found')
  res.json(node)
}

export async function deleteNode(req: Request, res: Response): Promise<void> {
  if (!(await networkService.deleteNode(req.params.id, req.params.nodeId))) throw new NotFoundError('Node not found')
  res.json({ deleted: true })
}

// ── Edges ─────────────────────────────────────────────────────────────────────
export async function addEdge(req: Request, res: Response): Promise<void> {
  const edge = await networkService.addEdge(req.params.id, req.body)
  if (!edge) throw new NotFoundError('Topology not found')
  res.status(201).json(edge)
}

export async function updateEdge(req: Request, res: Response): Promise<void> {
  const edge = await networkService.updateEdge(req.params.id, req.params.edgeId, req.body)
  if (!edge) throw new NotFoundError('Edge not found')
  res.json(edge)
}

export async function deleteEdge(req: Request, res: Response): Promise<void> {
  if (!(await networkService.deleteEdge(req.params.id, req.params.edgeId))) throw new NotFoundError('Edge not found')
  res.json({ deleted: true })
}
