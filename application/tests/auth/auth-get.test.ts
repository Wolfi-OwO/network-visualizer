/// <reference types="mocha" />
import { app, request, assert } from './common.ts'

describe('auth: GET', () => {
  it('GET /auth/providers lists options', async () => {
    const res = await request(app).get('/auth/providers')
    assert.equal(res.status, 200)
    assert.equal(res.body.devLogin, true)
    assert.ok(Array.isArray(res.body.providers))
  })

  it('GET /auth/me without a session → 401', async () => {
    assert.equal((await request(app).get('/auth/me')).status, 401)
  })

  it('OAuth start endpoints 400 when the provider is not configured', async () => {
    assert.equal((await request(app).get('/auth/google')).status, 400)
    assert.equal((await request(app).get('/auth/microsoft')).status, 400)
  })

  it('OAuth callbacks redirect to /login on error', async () => {
    const r = await request(app).get('/auth/google/callback?error=access_denied')
    assert.equal(r.status, 302)
    assert.match(r.headers.location, /\/login\?error=/)
    assert.equal((await request(app).get('/auth/microsoft/callback')).status, 302)
  })
})
