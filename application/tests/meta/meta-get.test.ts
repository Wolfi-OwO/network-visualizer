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
    assert.ok(res.body._links.users);
    assert.ok(res.body._links.me);
    assert.ok(res.body._links.providers);
  });

  it('GET /api/unknown -> 404', async () => {
    assert.equal((await request(app).get('/api/unknown-route')).status, 404);
  });

  it('HEAD /api -> 200 empty body', async () => {
    const res = await request(app).head('/api');
    assert.equal(res.status, 200);
    assert.equal(res.text, undefined);
  });

  // Real per-route OPTIONS discovery — cors() used to swallow every OPTIONS
  // request with a blanket 204 and no Allow header, on every path including
  // ones that don't exist (preflightContinue fixes this, see app.ts).
  it('OPTIONS /api/packets -> 200 with Allow: GET, HEAD, DELETE', async () => {
    const res = await request(app).options('/api/packets');
    assert.equal(res.status, 200);
    for (const method of ['GET', 'HEAD', 'DELETE']) {
      assert.ok(res.headers.allow?.includes(method), `Allow should include ${method}`);
    }
  });

  it('OPTIONS /api/capture -> 200 with Allow: GET, HEAD, PATCH', async () => {
    const res = await request(app).options('/api/capture');
    assert.equal(res.status, 200);
    for (const method of ['GET', 'HEAD', 'PATCH']) {
      assert.ok(res.headers.allow?.includes(method), `Allow should include ${method}`);
    }
  });

  it('OPTIONS /api/unknown-route -> 404', async () => {
    assert.equal((await request(app).options('/api/unknown-route')).status, 404);
  });

  it('CORS: allowed dev origin still gets Access-Control-Allow-Origin', async () => {
    const res = await request(app).get('/api').set('Origin', 'http://localhost:5173');
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
  });

  // H4: regression coverage only — this behavior already works, this just
  // stops it from silently regressing.
  it('CORS: hostile origin gets no Access-Control-Allow-Origin header', async () => {
    const res = await request(app).get('/api').set('Origin', 'https://evil.example');
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });
});
