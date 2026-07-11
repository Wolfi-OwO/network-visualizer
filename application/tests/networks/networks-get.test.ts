/// <reference types="mocha" />
import { app, request, assert } from './common.ts'

describe('networks: GET', () => {
  it('collection with _links', async () => {
    const res = await request(app).get('/api/networks')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.items))
    assert.ok(res.body.count >= 1)
    assert.ok(res.body._links.self)
  })

  it('default topology with _links', async () => {
    const res = await request(app).get('/api/networks/default')
    assert.equal(res.status, 200)
    assert.ok(res.body.id)
    assert.ok(Array.isArray(res.body.nodes))
    assert.ok(res.body._links.self)
    assert.ok(res.body._links.traces)
  })

  it('missing topology -> 404', async () => {
    assert.equal((await request(app).get('/api/networks/does-not-exist')).status, 404)
  })
})
