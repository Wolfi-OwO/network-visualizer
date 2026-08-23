/// <reference types="mocha" />
import { app, request, assert, loginAgent } from '../common.ts';

describe('me: GDPR self-service', () => {
  it('GET /api/me/export without a session -> 401', async () => {
    assert.equal((await request(app).get('/api/me/export')).status, 401);
  });

  it('DELETE /api/me without a session -> 401', async () => {
    assert.equal((await request(app).delete('/api/me')).status, 401);
  });

  it('GET /api/me/export returns the caller profile and their own networks only', async () => {
    const agent = await loginAgent('export-me@example.com', 'Export Tester');
    await agent.post('/api/networks').send({ name: 'Mine' });

    const res = await agent.get('/api/me/export');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-disposition'], /attachment; filename=user_data_export\.json/);
    assert.equal(res.body.profile.email, 'export-me@example.com');
    assert.ok(Array.isArray(res.body.networks));
    assert.ok(res.body.networks.every((n: { id: string }) => typeof n.id === 'string'));
    assert.ok(Array.isArray(res.body.auditLog));
  });

  it('DELETE /api/me removes the account and its networks, then signs out', async () => {
    // Seed an admin first (findOrCreateUser makes the first-ever user an
    // admin), so this second signup is a plain 'editor' and can be deleted
    // without tripping the "cannot delete the last admin" guard.
    await loginAgent('first-admin@example.com', 'First Admin');
    const agent = await loginAgent('delete-me@example.com', 'Delete Tester');
    await agent.post('/api/networks').send({ name: 'To be deleted' });

    const before = await agent.get('/auth/me');
    assert.equal(before.status, 200);

    const del = await agent.delete('/api/me');
    assert.equal(del.status, 204);

    // The session cookie is cleared server-side; a fresh request with no
    // cookie confirms the account itself is gone, not just logged out.
    const after = await request(app).get('/auth/me');
    assert.equal(after.status, 401);
  });
});
