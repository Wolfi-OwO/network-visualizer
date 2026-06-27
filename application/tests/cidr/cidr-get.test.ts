/// <reference types="mocha" />
import { app, request, assert } from './common.ts'

describe('cidr: GET', () => {
  it('root lists links', async () => {
    const res = await request(app).get('/api/cidr')
    assert.equal(res.status, 200)
    assert.ok(res.body._links.calculations)
  })

  it('validations report valid/invalid IPs', async () => {
    const ok = await request(app).get('/api/cidr/validations/10.0.0.1')
    assert.equal(ok.status, 200)
    assert.equal(ok.body.valid, true)
    const bad = await request(app).get('/api/cidr/validations/999.0.0.1')
    assert.equal(bad.body.valid, false)
  })
})
