/// <reference types="mocha" />
import { app, request, assert, createTopology } from './common.ts'

describe('validation: GET', () => {
  it('default topology is clean', async () => {
    const res = await request(app).get('/api/networks/default/validation')
    assert.equal(res.status, 200)
    assert.equal(res.body.ok, true)
    assert.equal(res.body.counts.error, 0)
    assert.ok(res.body._links.self)
  })

  it('flags a duplicate IP as an error', async () => {
    const id = await createTopology('Bad Net')
    const iface = { name: 'eth0', ipAddress: '10.9.9.9', subnetMask: '255.255.255.0', status: 'up' }
    await request(app).post(`/api/networks/${id}/nodes`).send({ type: 'pc', label: 'A', position: { x: 0, y: 0 }, config: { interfaces: [iface] } })
    await request(app).post(`/api/networks/${id}/nodes`).send({ type: 'pc', label: 'B', position: { x: 1, y: 1 }, config: { interfaces: [iface] } })
    const res = await request(app).get(`/api/networks/${id}/validation`)
    assert.equal(res.status, 200)
    assert.equal(res.body.ok, false)
    assert.ok(res.body.findings.some((f: { category: string }) => f.category === 'duplicate-ip'))
  })
})
