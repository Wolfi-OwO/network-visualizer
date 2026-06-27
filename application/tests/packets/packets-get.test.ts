/// <reference types="mocha" />
import { app, request, assert } from './common.ts'

describe('packets: GET', () => {
  it('collection with _links', async () => {
    const res = await request(app).get('/api/packets')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.items))
    assert.ok(res.body._links.self)
  })

  it('non-numeric id → 400', async () => {
    assert.equal((await request(app).get('/api/packets/abc')).status, 400)
  })

  it('missing id → 404', async () => {
    assert.equal((await request(app).get('/api/packets/999999')).status, 404)
  })
})
