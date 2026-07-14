/// <reference types="mocha" />
import { app, request, assert, createTopology, addNode } from './common.ts';

describe('networks: POST', () => {
  it('create -> 201 + Location + _links', async () => {
    const res = await request(app)
      .post('/api/networks')
      .send({ name: 'Test Net', description: 'd' });
    assert.equal(res.status, 201);
    assert.ok(res.headers.location);
    assert.equal(res.body.name, 'Test Net');
    assert.ok(res.body._links.self);
  });

  it('without a name -> 400', async () => {
    assert.equal((await request(app).post('/api/networks').send({})).status, 400);
  });

  it('adds nodes and an edge (201)', async () => {
    const id = await createTopology('WithNodes');
    const a = await addNode(id, 'pc', 'A');
    const b = await addNode(id, 'server', 'B');
    const edge = await request(app)
      .post(`/api/networks/${id}/edges`)
      .send({ source: a, target: b, config: {} });
    assert.equal(edge.status, 201);
    assert.ok(edge.headers.location);
  });

  it('rejects an invalid node body (400)', async () => {
    const id = await createTopology('BadNode');
    assert.equal(
      (await request(app).post(`/api/networks/${id}/nodes`).send({ label: 'no type' })).status,
      400,
    );
    assert.equal(
      (await request(app).post(`/api/networks/${id}/nodes`).send({ type: 'pc' })).status,
      400,
    );
  });

  it('rejects an invalid edge body (400)', async () => {
    const id = await createTopology('BadEdge');
    assert.equal(
      (await request(app).post(`/api/networks/${id}/edges`).send({ source: 'x' })).status,
      400,
    );
  });
});
