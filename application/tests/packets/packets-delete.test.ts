/// <reference types="mocha" />
import { app, request, assert } from './common.ts';

describe('packets: DELETE', () => {
  it('clears the capture buffer (204)', async () => {
    assert.equal((await request(app).delete('/api/packets')).status, 204);
  });
});
