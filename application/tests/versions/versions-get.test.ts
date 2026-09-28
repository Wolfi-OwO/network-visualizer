/// <reference types="mocha" />
import { app, request, assert, createTopology, addNode } from './common.ts';
import { TopologyVersionModel } from '../../src/db/models/topology-version.model.js';

describe('versions: GET', () => {
  it('lists versions and fetches a single snapshot', async () => {
    const id = await createTopology('VersionedG');
    await addNode(id, 'pc', 'A');
    const v1 = await request(app).post(`/api/networks/${id}/versions`).send({ label: 'one' });

    const list = await request(app).get(`/api/networks/${id}/versions`);
    assert.equal(list.status, 200);
    assert.ok(list.body.count >= 1);

    const got = await request(app).get(`/api/networks/${id}/versions/${v1.body.id}`);
    assert.equal(got.status, 200);
    assert.equal(got.body.nodes.length, 1);
    assert.ok(got.body._links.self);
    assert.ok(got.body._links.restore);
    assert.ok(got.body._links.collection);

    assert.equal((await request(app).get(`/api/networks/${id}/versions/nope`)).status, 404);
  });

  // H1: restoreVersion writes a stored snapshot's nodes/edges straight into the
  // live topology via networkService.updateTopology — it must go through the
  // same `_links` stripping as every other write, even for a snapshot saved
  // (here, test-constructed) before that guard existed.
  it('strips _links on restore, even from a snapshot that already had them', async () => {
    const id = await createTopology('RestoreG');
    await addNode(id, 'pc', 'A');

    const tainted = await TopologyVersionModel.create({
      id: 'tainted-version',
      topologyId: id,
      ownerId: 'local',
      version: 999,
      label: 'tainted',
      name: 'RestoreG',
      nodes: [
        {
          id: 'n1',
          type: 'pc',
          label: 'A',
          position: { x: 0, y: 0 },
          config: {},
          _links: { self: { href: '/api/networks/x/nodes/n1' } },
        },
      ],
      edges: [],
      createdAt: Date.now(),
    });

    const restored = await request(app).post(`/api/networks/${id}/versions/${tainted.id}/restore`);
    assert.equal(restored.status, 200);
    assert.equal(restored.body.nodes[0]._links, undefined);

    const live = await request(app).get(`/api/networks/${id}`);
    assert.equal(live.status, 200);
    assert.equal(live.body.nodes[0]._links, undefined);
  });
});
