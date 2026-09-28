/// <reference types="mocha" />
import { app, request, assert, loginAgent } from './common.ts';

describe('auth: GET', () => {
  it('GET /auth/providers lists options', async () => {
    const res = await request(app).get('/auth/providers');
    assert.equal(res.status, 200);
    assert.equal(res.body.devLogin, true);
    assert.ok(Array.isArray(res.body.providers));
    assert.ok(res.body._links.self);
  });

  it('GET /auth/me without a session -> 401', async () => {
    assert.equal((await request(app).get('/auth/me')).status, 401);
  });

  it('GET /auth/me with a session carries _links', async () => {
    // Uses the same email as auth-post.test.ts's "first user is admin" test
    // and tests/metrics + tests/erasure's admin logins — findOrCreateUser is
    // idempotent per email, so this doesn't create a second "first" user and
    // doesn't disturb the suite's documented first-user-becomes-admin ordering.
    const agent = await loginAgent('admin@netviz.local');
    const res = await agent.get('/auth/me');
    assert.equal(res.status, 200);
    assert.ok(res.body._links.self);
    assert.ok(res.body._links.logout);
    assert.ok(res.body._links.export);
  });

  it('OAuth start endpoints 400 when the provider is not configured', async () => {
    assert.equal((await request(app).get('/auth/google')).status, 400);
    assert.equal((await request(app).get('/auth/microsoft')).status, 400);
  });

  it('OAuth callbacks redirect to /login on error', async () => {
    const r = await request(app).get('/auth/google/callback?error=access_denied');
    assert.equal(r.status, 302);
    assert.match(r.headers.location, /\/login\?error=/);
    assert.equal((await request(app).get('/auth/microsoft/callback')).status, 302);
  });
});
