import { Request, Response } from 'express'
import * as networkService from '../db/network-service.js'
import { validateTopology } from '../services/validation-service.js'
import { controlPlaneForNode } from '../services/control-plane-service.js'
import { deviceRunningConfig, topologyConfigBundle } from '../services/config-export-service.js'
import * as versionService from '../services/version-service.js'
import { BadRequestError, NotFoundError } from '../lib/errors.js'
import { withLinks, topologyLinks, networksCollectionLinks } from '../lib/hateoas.js'
import { ownerOf } from '../middlewares/auth.js'
import type { NetworkTopology } from '../types/index.js'

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
function assertValidNodeBody(body: unknown): void {
  if (!isObj(body)) throw new BadRequestError('Body must be an object')
  if (typeof body.type !== 'string' || !body.type) throw new BadRequestError('node.type is required')
  if (!isObj(body.position) || typeof body.position.x !== 'number' || typeof body.position.y !== 'number') {
    throw new BadRequestError('node.position {x, y} (numbers) is required')
  }
  if (body.config !== undefined && !isObj(body.config)) throw new BadRequestError('node.config must be an object')
}
function assertValidEdgeBody(body: unknown): void {
  if (!isObj(body)) throw new BadRequestError('Body must be an object')
  if (typeof body.source !== 'string' || !body.source || typeof body.target !== 'string' || !body.target) {
    throw new BadRequestError('edge.source and edge.target are required')
  }
}

// Resolve a topology by id, treating "default" as the owner's default workspace.
async function resolve(id: string, owner: string): Promise<NetworkTopology | null> {
  return id === 'default' ? networkService.getOrCreateDefault(owner) : networkService.getTopology(id, owner)
}

// ── Topology collection ───────────────────────────────────────────────────────
export async function listTopologies(req: Request, res: Response): Promise<void> {
  const owner = ownerOf(req)
  if ((await networkService.getAllTopologies(owner)).length === 0) await networkService.getOrCreateDefault(owner)
  const items = (await networkService.getAllTopologies(owner)).map((t) => withLinks(t, topologyLinks(t.id)))
  res.json({ _links: networksCollectionLinks(), count: items.length, items })
}

export async function getDefaultTopology(req: Request, res: Response): Promise<void> {
  const topology = await networkService.getOrCreateDefault(ownerOf(req))
  res.json(withLinks(topology, topologyLinks(topology.id)))
}

export async function createTopology(req: Request, res: Response): Promise<void> {
  const { name, description } = req.body
  if (!name) throw new BadRequestError('name is required')
  const topology = await networkService.createTopology(name, description, ownerOf(req))
  res.status(201).location(`/api/networks/${topology.id}`).json(withLinks(topology, topologyLinks(topology.id)))
}

export async function getTopologyById(req: Request, res: Response): Promise<void> {
  const topology = await networkService.getTopology(req.params.id, ownerOf(req))
  if (!topology) throw new NotFoundError('Topology not found')
  res.json(withLinks(topology, topologyLinks(topology.id)))
}

// GET /api/networks/:id/validation — design-validation report (:id may be "default")
export async function getValidation(req: Request, res: Response): Promise<void> {
  const topology = await resolve(req.params.id, ownerOf(req))
  if (!topology) throw new NotFoundError('Topology not found')
  const report = validateTopology(topology)
  res.json(withLinks(report as object, {
    self: { href: `/api/networks/${topology.id}/validation` },
    topology: { href: `/api/networks/${topology.id}` },
  }))
}

// GET /api/networks/:id/nodes/:nodeId/control-plane — operational state tables.
export async function getControlPlane(req: Request, res: Response): Promise<void> {
  const { id, nodeId } = req.params
  const topology = await resolve(id, ownerOf(req))
  if (!topology) throw new NotFoundError('Topology not found')
  const report = controlPlaneForNode(topology, nodeId)
  if (!report) throw new NotFoundError('Node not found')
  res.json(withLinks(report as object, {
    self: { href: `/api/networks/${topology.id}/nodes/${nodeId}/control-plane` },
    node: { href: `/api/networks/${topology.id}/nodes/${nodeId}` },
    topology: { href: `/api/networks/${topology.id}` },
  }))
}

// GET /api/networks/:id/config — Cisco-style running-config for every device.
export async function getTopologyConfig(req: Request, res: Response): Promise<void> {
  const topology = await resolve(req.params.id, ownerOf(req))
  if (!topology) throw new NotFoundError('Topology not found')
  res.type('text/plain').send(topologyConfigBundle(topology))
}

// GET /api/networks/:id/nodes/:nodeId/config — running-config for one device.
export async function getDeviceConfig(req: Request, res: Response): Promise<void> {
  const { id, nodeId } = req.params
  const topology = await resolve(id, ownerOf(req))
  if (!topology) throw new NotFoundError('Topology not found')
  const node = topology.nodes.find((n) => n.id === nodeId)
  if (!node) throw new NotFoundError('Node not found')
  res.type('text/plain').send(deviceRunningConfig(topology, node))
}

export async function updateTopology(req: Request, res: Response): Promise<void> {
  assertValidTopologyPatch(req.body)
  const topology = await networkService.updateTopology(req.params.id, req.body, ownerOf(req))
  if (!topology) throw new NotFoundError('Topology not found')
  res.json(withLinks(topology, topologyLinks(topology.id)))
}

export async function deleteTopology(req: Request, res: Response): Promise<void> {
  if (!(await networkService.deleteTopology(req.params.id, ownerOf(req)))) throw new NotFoundError('Topology not found')
  res.status(204).end()
}

// ── Versions (snapshot history) ───────────────────────────────────────────────
export async function listVersions(req: Request, res: Response): Promise<void> {
  const owner = ownerOf(req)
  const topology = await resolve(req.params.id, owner)
  if (!topology) throw new NotFoundError('Topology not found')
  const items = await versionService.listVersions(topology.id, owner)
  res.json({ _links: { self: { href: `/api/networks/${topology.id}/versions` } }, count: items.length, items })
}

export async function createVersion(req: Request, res: Response): Promise<void> {
  const owner = ownerOf(req)
  const topology = await resolve(req.params.id, owner)
  if (!topology) throw new NotFoundError('Topology not found')
  const version = await versionService.createVersion(topology.id, owner, req.body?.label)
  if (!version) throw new NotFoundError('Topology not found')
  res.status(201).json(withLinks(version as object, {
    self: { href: `/api/networks/${topology.id}/versions/${version.id}` },
    collection: { href: `/api/networks/${topology.id}/versions` },
  }))
}

export async function getVersion(req: Request, res: Response): Promise<void> {
  const owner = ownerOf(req)
  const topology = await resolve(req.params.id, owner)
  if (!topology) throw new NotFoundError('Topology not found')
  const snapshot = await versionService.getVersion(topology.id, req.params.versionId, owner)
  if (!snapshot) throw new NotFoundError('Version not found')
  res.json(snapshot)
}

export async function restoreVersion(req: Request, res: Response): Promise<void> {
  const owner = ownerOf(req)
  const topology = await resolve(req.params.id, owner)
  if (!topology) throw new NotFoundError('Topology not found')
  const restored = await versionService.restoreVersion(topology.id, req.params.versionId, owner)
  if (!restored) throw new NotFoundError('Version not found')
  res.json(withLinks(restored, topologyLinks(restored.id)))
}

// ── Nodes ─────────────────────────────────────────────────────────────────────
export async function addNode(req: Request, res: Response): Promise<void> {
  assertValidNodeBody(req.body)
  const body = { ...req.body, config: req.body.config ?? {} }
  const node = await networkService.addNode(req.params.id, body, ownerOf(req))
  if (!node) throw new NotFoundError('Topology not found')
  res.status(201).location(`/api/networks/${req.params.id}/nodes/${node.id}`).json(node)
}

export async function updateNode(req: Request, res: Response): Promise<void> {
  const node = await networkService.updateNode(req.params.id, req.params.nodeId, req.body, ownerOf(req))
  if (!node) throw new NotFoundError('Node not found')
  res.json(node)
}

export async function deleteNode(req: Request, res: Response): Promise<void> {
  if (!(await networkService.deleteNode(req.params.id, req.params.nodeId, ownerOf(req)))) throw new NotFoundError('Node not found')
  res.status(204).end()
}

// ── Edges ─────────────────────────────────────────────────────────────────────
export async function addEdge(req: Request, res: Response): Promise<void> {
  assertValidEdgeBody(req.body)
  const body = { ...req.body, config: req.body.config ?? {} }
  const edge = await networkService.addEdge(req.params.id, body, ownerOf(req))
  if (!edge) throw new NotFoundError('Topology not found')
  res.status(201).location(`/api/networks/${req.params.id}/edges/${edge.id}`).json(edge)
}

export async function updateEdge(req: Request, res: Response): Promise<void> {
  const edge = await networkService.updateEdge(req.params.id, req.params.edgeId, req.body, ownerOf(req))
  if (!edge) throw new NotFoundError('Edge not found')
  res.json(edge)
}

export async function deleteEdge(req: Request, res: Response): Promise<void> {
  if (!(await networkService.deleteEdge(req.params.id, req.params.edgeId, ownerOf(req)))) throw new NotFoundError('Edge not found')
  res.status(204).end()
}
