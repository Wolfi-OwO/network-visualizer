/// <reference types="mocha" />
import { app, request, assert } from './common.ts';

describe('auth: POST (sessions, RBAC, isolation, audit)', () => {
  it('dev-login starts a session; first user is admin; logout clears it', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/auth/dev-login')
      .send({ email: 'admin@netviz.local', name: 'Admin' });
    assert.equal(login.status, 200);
    assert.equal(login.body.email, 'admin@netviz.local');
    const me = await agent.get('/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'admin'); // first registered user
    const audit = await agent.get('/api/audit'); // admin can read the audit log
    assert.equal(audit.status, 200);
    assert.ok(Array.isArray(audit.body.items));
    assert.equal((await agent.post('/auth/logout')).status, 200);
    assert.equal((await agent.get('/auth/me')).status, 401);
  });

  it("each account's topologies are stored independently", async () => {
    const alice = request.agent(app);
    await alice.post('/auth/dev-login').send({ email: 'alice@example.com' });
    const bob = request.agent(app);
    await bob.post('/auth/dev-login').send({ email: 'bob@example.com' });

    const created = await alice.post('/api/networks').send({ name: 'Alice Net' });
    assert.equal(created.status, 201);
    const id = created.body.id;

    assert.equal((await alice.get(`/api/networks/${id}`)).status, 200);
    assert.equal((await bob.get(`/api/networks/${id}`)).status, 404);
    const bobList = await bob.get('/api/networks');
    assert.ok(!bobList.body.items.some((t: { id: string }) => t.id === id));
    assert.equal((await bob.get('/api/audit')).status, 403); // editor ≠ admin
  });

  it('accepts a Bearer token as well as a cookie', async () => {
    const agent = request.agent(app);
    const login = await agent.post('/auth/dev-login').send({ email: 'bearer@x.io' });
    const cookie = login.headers['set-cookie'][0] as string;
    const token = cookie.split(';')[0].split('=')[1];
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.email, 'bearer@x.io');
  });

  it('dev-login requires an email', async () => {
    assert.equal((await request(app).post('/auth/dev-login').send({})).status, 400);
  });
});
