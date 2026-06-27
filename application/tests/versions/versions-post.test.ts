/// <reference types="mocha" />
import { app, request, assert, createTopology, addNode } from './common.ts'

describe('versions: POST', () => {
  it('snapshots and restores a topology', async () => {
    const id = await createTopology('Versioned')
    await addNode(id, 'pc', 'A')
    const v1 = await request(app).post(`/api/networks/${id}/versions`).send({ label: 'one node' })
    assert.equal(v1.status, 201)
    assert.equal(v1.body.version, 1)
    assert.equal(v1.body.nodeCount, 1)

    await addNode(id, 'server', 'B')
    const v2 = await request(app).post(`/api/networks/${id}/versions`).send({})
    assert.equal(v2.body.version, 2)
    assert.equal(v2.body.nodeCount, 2)

    const restored = await request(app).post(`/api/networks/${id}/versions/${v1.body.id}/restore`)
    assert.equal(restored.status, 200)
    assert.equal(restored.body.nodes.length, 1)

    assert.equal((await request(app).post(`/api/networks/${id}/versions/nope/restore`)).status, 404)
  })
})
