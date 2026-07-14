/// <reference types="mocha" />
import { app, request, assert } from './common.ts';

describe('cidr: POST', () => {
  it('calculations -> 201 result', async () => {
    const res = await request(app).post('/api/cidr/calculations').send({ input: '10.0.0.0/24' });
    assert.equal(res.status, 201);
    assert.equal(res.body.networkAddress, '10.0.0.0');
    assert.ok(res.body._links.self);
  });

  it('calculations without input -> 400', async () => {
    assert.equal((await request(app).post('/api/cidr/calculations').send({})).status, 400);
  });

  it('subnets -> 201 items', async () => {
    const res = await request(app)
      .post('/api/cidr/subnets')
      .send({ network: '10.0.0.0/24', count: 4 });
    assert.equal(res.status, 201);
    assert.ok(res.body.count >= 1);
    assert.ok(Array.isArray(res.body.items));
  });

  it('supernets -> 201', async () => {
    const res = await request(app)
      .post('/api/cidr/supernets')
      .send({ networks: ['192.168.0.0/24', '192.168.1.0/24'] });
    assert.equal(res.status, 201);
    assert.ok(res.body.networkAddress);
  });
});
