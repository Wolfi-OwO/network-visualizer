/// <reference types="mocha" />
import { app, request, assert } from './common.ts'

describe('config: GET', () => {
  it('device running-config is Cisco-style text', async () => {
    const res = await request(app).get('/api/networks/default/nodes/fw-1/config')
    assert.equal(res.status, 200)
    assert.match(res.headers['content-type'], /text\/plain/)
    assert.match(res.text, /hostname /)
    assert.match(res.text, /ip access-list extended/)
    assert.match(res.text, /\nend\n?$/)
  })

  it('topology bundle covers every device', async () => {
    const res = await request(app).get('/api/networks/default/config')
    assert.equal(res.status, 200)
    assert.match(res.text, /configuration archive/)
    assert.ok((res.text.match(/hostname /g) ?? []).length >= 5)
  })

  it('missing node config → 404', async () => {
    assert.equal((await request(app).get('/api/networks/default/nodes/ghost/config')).status, 404)
  })
})
