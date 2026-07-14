/// <reference types="mocha" />
import { app, request, assert } from './common.ts';

describe('control-plane: GET', () => {
  it('switch returns a MAC table + STP', async () => {
    const res = await request(app).get('/api/networks/default/nodes/switch-1/control-plane');
    assert.equal(res.status, 200);
    assert.equal(res.body.type, 'switch');
    assert.ok(Array.isArray(res.body.macTable));
    assert.ok(res.body.macTable.length >= 1);
    assert.ok(res.body.stp);
    assert.ok(res.body._links.self);
  });

  it('firewall returns ACL hits + NAT + OSPF', async () => {
    const res = await request(app).get('/api/networks/default/nodes/fw-1/control-plane');
    assert.equal(res.status, 200);
    assert.ok(res.body.acl.length >= 1);
    assert.equal(typeof res.body.acl[0].hits, 'number');
    assert.ok(res.body.nat.length >= 1);
    assert.ok(Array.isArray(res.body.ospfNeighbors));
  });

  it('host returns an ARP table', async () => {
    const res = await request(app).get('/api/networks/default/nodes/pc-1/control-plane');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.arp));
  });

  it('unknown node -> 404', async () => {
    assert.equal(
      (await request(app).get('/api/networks/default/nodes/nope/control-plane')).status,
      404,
    );
  });
});
