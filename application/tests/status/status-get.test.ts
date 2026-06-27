/// <reference types="mocha" />
import { app, request, assert } from './common.ts'
import { recordSample } from '../../src/services/status-service.js'

describe('status: GET', () => {
  it('returns a public status report with components + uptime', async () => {
    await recordSample()
    await recordSample()
    const res = await request(app).get('/api/status')
    assert.equal(res.status, 200)
    assert.ok(['operational', 'degraded', 'down'].includes(res.body.status))
    assert.ok(Array.isArray(res.body.components))
    const db = res.body.components.find((c: { key: string }) => c.key === 'database')
    assert.ok(db && db.uptime)
    assert.ok(Array.isArray(res.body.history) && res.body.history.length >= 1)
    assert.equal(typeof res.body.currentUptimeSeconds, 'number')
    assert.ok(res.body._links.self)
  })
})
