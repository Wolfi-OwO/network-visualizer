/// <reference types="mocha" />
import { app, request, assert, createTopology, addNode } from './common.ts';

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

    assert.equal((await request(app).get(`/api/networks/${id}/versions/nope`)).status, 404);
  });
});
