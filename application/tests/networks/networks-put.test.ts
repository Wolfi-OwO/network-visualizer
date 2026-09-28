/// <reference types="mocha" />
import { app, request, assert, createTopology, addNode } from './common.ts';

describe('networks: PUT', () => {
  it('updates a topology', async () => {
    const id = await createTopology('ToUpdate');
    const res = await request(app).put(`/api/networks/${id}`).send({ description: 'updated' });
    assert.equal(res.status, 200);
    assert.equal(res.body.description, 'updated');
  });

  it('updates a node and an edge', async () => {
    const id = await createTopology('NodeEdge');
    const a = await addNode(id, 'pc', 'A');
    const b = await addNode(id, 'server', 'B');
    const un = await request(app).put(`/api/networks/${id}/nodes/${a}`).send({ label: 'A2' });
    assert.equal(un.status, 200);
    assert.equal(un.body.label, 'A2');
    const edge = await request(app)
      .post(`/api/networks/${id}/edges`)
      .send({ source: a, target: b, config: {} });
    const ue = await request(app)
      .put(`/api/networks/${id}/edges/${edge.body.id}`)
      .send({ label: 'L' });
    assert.equal(ue.status, 200);
    assert.equal(ue.body.label, 'L');
  });

  it('strips _links from nodes/edges before saving (round-trip)', async () => {
    const id = await createTopology('StripLinks');
    const a = await addNode(id, 'pc', 'A');
    const b = await addNode(id, 'server', 'B');
    const fetched = await request(app).get(`/api/networks/${id}`);
    const nodeWithLinks = {
      ...fetched.body.nodes.find((n: { id: string }) => n.id === a),
      _links: { self: { href: '/api/networks/x/nodes/y' } },
    };
    const otherNode = fetched.body.nodes.find((n: { id: string }) => n.id === b);

    const put = await request(app)
      .put(`/api/networks/${id}`)
      .send({ nodes: [nodeWithLinks, otherNode] });
    assert.equal(put.status, 200);
    assert.ok(!('_links' in put.body.nodes[0]), 'PUT response should not carry _links on nodes');

    const got = await request(app).get(`/api/networks/${id}`);
    assert.equal(got.status, 200);
    for (const node of got.body.nodes) {
      assert.ok(!('_links' in node), `stored/returned node ${node.id} should have no _links`);
    }
  });

  it('rejects an invalid topology patch (400)', async () => {
    const id = await createTopology('BadPatch');
    const res = await request(app)
      .put(`/api/networks/${id}`)
      .send({ nodes: [{ id: 'x' }] });
    assert.equal(res.status, 400);
  });

  // H2: updateNode/updateEdge previously merged whatever shape a caller sent
  // straight into the stored document with no validation.
  it('rejects a node update with a malformed position (400)', async () => {
    const id = await createTopology('BadNodePosition');
    const a = await addNode(id, 'pc', 'A');
    const res = await request(app)
      .put(`/api/networks/${id}/nodes/${a}`)
      .send({ position: { x: 'not-a-number', y: 0 } });
    assert.equal(res.status, 400);
  });

  it('rejects a node update with a non-object config (400)', async () => {
    const id = await createTopology('BadNodeConfig');
    const a = await addNode(id, 'pc', 'A');
    const res = await request(app)
      .put(`/api/networks/${id}/nodes/${a}`)
      .send({ config: ['not', 'an', 'object'] });
    assert.equal(res.status, 400);
  });

  it('rejects an edge update with a non-string source/target (400)', async () => {
    const id = await createTopology('BadEdgeEndpoints');
    const a = await addNode(id, 'pc', 'A');
    const b = await addNode(id, 'server', 'B');
    const edge = await request(app)
      .post(`/api/networks/${id}/edges`)
      .send({ source: a, target: b, config: {} });
    const res = await request(app)
      .put(`/api/networks/${id}/edges/${edge.body.id}`)
      .send({ source: 123 });
    assert.equal(res.status, 400);
  });
});
