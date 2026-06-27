/// <reference types="mocha" />
import { app, request, assert, loginAgent } from './common.ts'

describe('metrics: GET', () => {
  it('requires authentication (401 anonymous)', async () => {
    assert.equal((await request(app).get('/api/metrics')).status, 401)
  })

  it('returns runtime metrics for an admin', async () => {
    const admin = await loginAgent('admin@netviz.local')   // first user → admin
    const res = await admin.get('/api/metrics')
    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'ok')
    assert.equal(typeof res.body.requests, 'number')
    assert.ok(res.body.database)
    assert.ok(res.body.capture)
    assert.ok(res.body._links.self)
  })

  it('forbids non-admins (403)', async () => {
    const editor = await loginAgent('metrics-editor@example.com')
    assert.equal((await editor.get('/api/metrics')).status, 403)
  })
})
