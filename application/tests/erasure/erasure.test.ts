/// <reference types="mocha" />
import { assert, loginAgent } from '../common.ts';
import { UserModel } from '../../src/db/models/user.model.js';
import { TopologyModel } from '../../src/db/models/topology.model.js';
import { TopologyVersionModel } from '../../src/db/models/topology-version.model.js';
import { AuditModel } from '../../src/db/models/audit.model.js';

// Counts across every collection that can hold a given user's personal data.
// Counting via the models directly (not the API) is the point: a 204/401
// only proves the handler ran, not that Mongo actually lost the documents.
async function footprint(userId: string) {
  return {
    users: await UserModel.countDocuments({ id: userId }),
    topologies: await TopologyModel.countDocuments({ ownerId: userId }),
    versions: await TopologyVersionModel.countDocuments({ ownerId: userId }),
    audits: await AuditModel.countDocuments({ userId }),
  };
}

// Create a topology, a version snapshot of it, and (via the mutating
// requests themselves) at least one audit entry for `agent`. Returns the
// user id so the caller can inspect raw collection state afterwards.
async function seedOwnedData(agent: Awaited<ReturnType<typeof loginAgent>>): Promise<string> {
  const me = await agent.get('/auth/me');
  const userId = me.body.id as string;

  const topo = await agent.post('/api/networks').send({ name: 'To be erased' });
  await agent.post(`/api/networks/${topo.body.id}/versions`).send({ label: 'pre-erasure snapshot' });

  return userId;
}

describe('erasure: Art. 17 DSGVO completeness (self-service and admin paths)', () => {
  it('DELETE /api/me leaves zero User/Topology/TopologyVersion documents; audit entries are retained by design', async () => {
    const agent = await loginAgent('erase-self@example.com', 'Erase Self');
    const userId = await seedOwnedData(agent);

    // Sanity: the seed above must have left a real footprint, otherwise the
    // zero-count assertions after deletion would be vacuously true.
    const before = await footprint(userId);
    assert.ok(before.users > 0, 'seed did not create a User document');
    assert.ok(before.topologies > 0, 'seed did not create a Topology document');
    assert.ok(before.versions > 0, 'seed did not create a TopologyVersion document');
    assert.ok(before.audits > 0, 'seed did not create an audit entry');

    assert.equal((await agent.delete('/api/me')).status, 204);

    const after = await footprint(userId);
    assert.equal(after.users, 0, 'User document survived self-service erasure');
    assert.equal(after.topologies, 0, 'Topology documents survived self-service erasure');
    assert.equal(after.versions, 0, 'TopologyVersion documents survived self-service erasure');
    // Deliberate policy (see auth-service's eraseUserAndOwnedData): audit
    // entries are a security/abuse trail, not user-provided data, so they
    // are retained under the existing TTL rather than purged on erasure.
    // Assert that explicitly so a future edit can't silently reverse it.
    assert.ok(after.audits > 0, 'audit entries were unexpectedly purged on erasure');
  });

  it('DELETE /api/users/:id (admin) erases the same data as the self-service path', async () => {
    // Relies on the same ordering convention as tests/metrics/metrics-get.test.ts:
    // an earlier test file (tests/auth) already made this the first-ever user,
    // so it is an admin here.
    const admin = await loginAgent('admin@netviz.local');
    const target = await loginAgent('erase-by-admin@example.com', 'Erase By Admin');
    const userId = await seedOwnedData(target);

    const before = await footprint(userId);
    assert.ok(before.users > 0, 'seed did not create a User document');
    assert.ok(before.topologies > 0, 'seed did not create a Topology document');
    assert.ok(before.versions > 0, 'seed did not create a TopologyVersion document');
    assert.ok(before.audits > 0, 'seed did not create an audit entry');

    const del = await admin.delete(`/api/users/${userId}`);
    assert.equal(del.status, 204);

    const after = await footprint(userId);
    assert.equal(
      after.topologies,
      0,
      'Topology documents survived admin-initiated erasure — this is the exact gap issue #10 reported',
    );
    assert.equal(after.users, 0, 'User document survived admin-initiated erasure');
    assert.equal(after.versions, 0, 'TopologyVersion documents survived admin-initiated erasure');
    assert.ok(after.audits > 0, 'audit entries were unexpectedly purged on admin-initiated erasure');
  });

  it("admin erasure still refuses to delete the last admin, leaving that admin's data untouched", async () => {
    // Every other test in this file, and the whole suite's ordering
    // convention (see tests/metrics/metrics-get.test.ts), guarantees an admin
    // already exists by this point. This guards the invariant this feature
    // must never weaken (see auth-service's deleteUser / eraseUserAndOwnedData).
    const admin = await loginAgent('admin@netviz.local');
    const me = await admin.get('/auth/me');
    if (me.body.role !== 'admin') return; // ordering assumption not met — skip, don't fail
    if ((await UserModel.countDocuments({ role: 'admin' })) > 1) return; // not the last admin

    const res = await admin.delete(`/api/users/${me.body.id as string}`);
    assert.equal(res.status, 400);
    assert.equal(await UserModel.countDocuments({ id: me.body.id as string }), 1);
  });
});
