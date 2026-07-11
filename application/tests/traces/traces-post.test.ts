/// <reference types="mocha" />
import { app, request, assert } from './common.ts'

describe('traces: POST', () => {
  it('POST /api/networks/default/traces -> 201 with hops', async () => {
    const res = await request(app)
      .post('/api/networks/default/traces')
      .send({ srcNodeId: 'pc-1', dstNodeId: 'server-1', protocol: 'tcp', dstPort: 443 })
    assert.equal(res.status, 201)
    assert.ok(Array.isArray(res.body.hops))
    assert.ok(res.body._links.self)
  })

  it('without required fields -> 400', async () => {
    assert.equal((await request(app).post('/api/networks/default/traces').send({})).status, 400)
  })
})
