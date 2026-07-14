import { v4 as uuidv4 } from 'uuid';
import { TopologyVersionModel } from '../db/models/topology-version.model.js';
import * as networkService from '../db/network-service.js';
import type { NetworkTopology } from '../types/index.js';

export interface VersionSummary {
  id: string;
  version: number;
  label?: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  createdAt: number;
}

// Snapshot the current state of a topology as a new version.
export async function createVersion(
  topologyId: string,
  ownerId: string,
  label?: string,
): Promise<VersionSummary | null> {
  const topo = await networkService.getTopology(topologyId, ownerId);
  if (!topo) return null;
  const last = await TopologyVersionModel.findOne({ topologyId, ownerId }).sort({ version: -1 });
  const version = (last?.version ?? 0) + 1;
  const doc = await TopologyVersionModel.create({
    id: uuidv4(),
    topologyId,
    ownerId,
    version,
    label,
    name: topo.name,
    nodes: topo.nodes,
    edges: topo.edges,
    createdAt: Date.now(),
  });
  return summarize(doc);
}

export async function listVersions(topologyId: string, ownerId: string): Promise<VersionSummary[]> {
  const docs = await TopologyVersionModel.find({ topologyId, ownerId }).sort({ version: -1 });
  return docs.map(summarize);
}

export async function getVersion(
  topologyId: string,
  versionId: string,
  ownerId: string,
): Promise<NetworkTopology | null> {
  const doc = await TopologyVersionModel.findOne({ id: versionId, topologyId, ownerId });
  if (!doc) return null;
  return doc.toJSON() as unknown as NetworkTopology;
}

// Restore a snapshot back into the live topology (snapshots current state first).
export async function restoreVersion(
  topologyId: string,
  versionId: string,
  ownerId: string,
): Promise<NetworkTopology | null> {
  const doc = await TopologyVersionModel.findOne({ id: versionId, topologyId, ownerId });
  if (!doc) return null;
  await createVersion(topologyId, ownerId, 'auto-snapshot before restore');
  return networkService.updateTopology(
    topologyId,
    {
      name: doc.name,
      nodes: doc.nodes as NetworkTopology['nodes'],
      edges: doc.edges as NetworkTopology['edges'],
    },
    ownerId,
  );
}

function summarize(doc: InstanceType<typeof TopologyVersionModel>): VersionSummary {
  return {
    id: doc.id,
    version: doc.version,
    label: doc.label ?? undefined,
    name: doc.name,
    nodeCount: (doc.nodes as unknown[]).length,
    edgeCount: (doc.edges as unknown[]).length,
    createdAt: doc.createdAt,
  };
}
