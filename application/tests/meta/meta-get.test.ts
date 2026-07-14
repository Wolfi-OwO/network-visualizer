/// <reference types="mocha" />
import { app, request, assert } from './common.ts';

describe('meta: GET', () => {
  it('GET /health -> 200 ok', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /api -> hypermedia root', async () => {
    const res = await request(app).get('/api');
    assert.equal(res.status, 200);
    assert.ok(res.body._links.networks);
    assert.ok(res.body._links.capture);
  });

  it('GET /api/unknown -> 404', async () => {
    assert.equal((await request(app).get('/api/unknown-route')).status, 404);
  });
});
