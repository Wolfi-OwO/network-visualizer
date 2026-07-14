/// <reference types="mocha" />
import { app, request, assert } from './common.ts';

describe('capture: GET', () => {
  it('returns state + stats + _links', async () => {
    const res = await request(app).get('/api/capture');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.capturing, 'boolean');
    assert.ok(res.body.stats);
    assert.ok(res.body._links.self);
  });
});
