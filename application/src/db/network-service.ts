import { v4 as uuidv4 } from 'uuid';
import { TopologyModel } from './models/topology.model.js';
import { buildDemoTopology } from './seed.js';
import type { NetworkTopology, NetworkNode, NetworkEdge } from '../types/index.js';

// Every operation is scoped to an owner (the user id, or 'local' for the
// anonymous workspace) so each account's topologies are stored independently.

type TopologyDoc = Awaited<ReturnType<typeof TopologyModel.findOne>>;

function toTopology(doc: NonNullable<TopologyDoc>): NetworkTopology {
  return doc.toJSON() as unknown as NetworkTopology;
}

// ── Topology collection ───────────────────────────────────────────────────────
export async function getOrCreateDefault(ownerId: string): Promise<NetworkTopology> {
  const existing = await TopologyModel.findOne({ ownerId, isDefault: true });
  if (existing) return toTopology(existing);
  const created = await TopologyModel.create({ ...buildDemoTopology(), ownerId, isDefault: true });
  return toTopology(created);
}

export async function getAllTopologies(ownerId: string): Promise<NetworkTopology[]> {
  const docs = await TopologyModel.find({ ownerId }).sort({ createdAt: 1 });
  return docs.map(toTopology);
}

export async function getTopology(id: string, ownerId: string): Promise<NetworkTopology | null> {
  const doc = await TopologyModel.findOne({ id, ownerId });
  return doc ? toTopology(doc) : null;
}

export async function createTopology(
  name: string,
  description: string | undefined,
  ownerId: string,
): Promise<NetworkTopology> {
  const now = Date.now();
  const doc = await TopologyModel.create({
    id: uuidv4(),
    ownerId,
    name,
    description,
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
  });
  return toTopology(doc);
}

export async function updateTopology(
  id: string,
  updates: Partial<NetworkTopology>,
  ownerId: string,
): Promise<NetworkTopology | null> {
  const doc = await TopologyModel.findOne({ id, ownerId });
  if (!doc) return null;
  if (updates.name !== undefined) doc.name = updates.name;
  if (updates.description !== undefined) doc.description = updates.description;
  if (updates.nodes !== undefined) {
    doc.nodes = updates.nodes;
    doc.markModified('nodes');
  }
  if (updates.edges !== undefined) {
    doc.edges = updates.edges;
    doc.markModified('edges');
  }
  doc.updatedAt = Date.now();
  await doc.save();
  return toTopology(doc);
}

export async function deleteTopology(id: string, ownerId: string): Promise<boolean> {
  const res = await TopologyModel.deleteOne({ id, ownerId });
  return res.deletedCount > 0;
}

// ── Nodes ─────────────────────────────────────────────────────────────────────
export async function addNode(
  topologyId: string,
  node: Omit<NetworkNode, 'id'>,
  ownerId: string,
): Promise<NetworkNode | null> {
  const doc = await TopologyModel.findOne({ id: topologyId, ownerId });
  if (!doc) return null;
  const newNode: NetworkNode = { ...node, id: uuidv4() };
  (doc.nodes as NetworkNode[]).push(newNode);
  doc.markModified('nodes');
  doc.updatedAt = Date.now();
  await doc.save();
  return newNode;
}

export async function updateNode(
  topologyId: string,
  nodeId: string,
  updates: Partial<NetworkNode>,
  ownerId: string,
): Promise<NetworkNode | null> {
  const doc = await TopologyModel.findOne({ id: topologyId, ownerId });
  if (!doc) return null;
  const nodes = doc.nodes as NetworkNode[];
  const idx = nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return null;
  nodes[idx] = { ...nodes[idx], ...updates, id: nodeId };
  doc.markModified('nodes');
  doc.updatedAt = Date.now();
  await doc.save();
  return nodes[idx];
}

export async function deleteNode(
  topologyId: string,
  nodeId: string,
  ownerId: string,
): Promise<boolean> {
  const doc = await TopologyModel.findOne({ id: topologyId, ownerId });
  if (!doc) return false;
  const nodes = doc.nodes as NetworkNode[];
  const edges = doc.edges as NetworkEdge[];
  const before = nodes.length;
  doc.nodes = nodes.filter((n) => n.id !== nodeId);
  doc.edges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
  doc.markModified('nodes');
  doc.markModified('edges');
  doc.updatedAt = Date.now();
  await doc.save();
  return (doc.nodes as NetworkNode[]).length < before;
}

// ── Edges ─────────────────────────────────────────────────────────────────────
export async function addEdge(
  topologyId: string,
  edge: Omit<NetworkEdge, 'id'>,
  ownerId: string,
): Promise<NetworkEdge | null> {
  const doc = await TopologyModel.findOne({ id: topologyId, ownerId });
  if (!doc) return null;
  const newEdge: NetworkEdge = { ...edge, id: uuidv4() };
  (doc.edges as NetworkEdge[]).push(newEdge);
  doc.markModified('edges');
  doc.updatedAt = Date.now();
  await doc.save();
  return newEdge;
}

export async function updateEdge(
  topologyId: string,
  edgeId: string,
  updates: Partial<NetworkEdge>,
  ownerId: string,
): Promise<NetworkEdge | null> {
  const doc = await TopologyModel.findOne({ id: topologyId, ownerId });
  if (!doc) return null;
  const edges = doc.edges as NetworkEdge[];
  const idx = edges.findIndex((e) => e.id === edgeId);
  if (idx === -1) return null;
  edges[idx] = { ...edges[idx], ...updates, id: edgeId };
  doc.markModified('edges');
  doc.updatedAt = Date.now();
  await doc.save();
  return edges[idx];
}

export async function deleteEdge(
  topologyId: string,
  edgeId: string,
  ownerId: string,
): Promise<boolean> {
  const doc = await TopologyModel.findOne({ id: topologyId, ownerId });
  if (!doc) return false;
  const edges = doc.edges as NetworkEdge[];
  const before = edges.length;
  doc.edges = edges.filter((e) => e.id !== edgeId);
  doc.markModified('edges');
  doc.updatedAt = Date.now();
  await doc.save();
  return (doc.edges as NetworkEdge[]).length < before;
}
