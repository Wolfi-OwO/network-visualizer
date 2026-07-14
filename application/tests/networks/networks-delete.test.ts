/// <reference types="mocha" />
import { app, request, assert, createTopology, addNode } from './common.ts';

describe('networks: DELETE', () => {
  it('deletes edge, node and topology (204) then 404', async () => {
    const id = await createTopology('ToDelete');
    const a = await addNode(id, 'pc', 'A');
    const b = await addNode(id, 'server', 'B');
    const edge = await request(app)
      .post(`/api/networks/${id}/edges`)
      .send({ source: a, target: b, config: {} });
    assert.equal(
      (await request(app).delete(`/api/networks/${id}/edges/${edge.body.id}`)).status,
      204,
    );
    assert.equal((await request(app).delete(`/api/networks/${id}/nodes/${a}`)).status, 204);
    assert.equal((await request(app).delete(`/api/networks/${id}`)).status, 204);
    assert.equal((await request(app).get(`/api/networks/${id}`)).status, 404);
  });

  it('deleting a missing topology -> 404', async () => {
    assert.equal((await request(app).delete('/api/networks/ghost')).status, 404);
  });
});
