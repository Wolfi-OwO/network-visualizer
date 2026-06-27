/// <reference types="mocha" />
import { app, request, assert, createTopology, addNode } from './common.ts'

describe('networks: PUT', () => {
  it('updates a topology', async () => {
    const id = await createTopology('ToUpdate')
    const res = await request(app).put(`/api/networks/${id}`).send({ description: 'updated' })
    assert.equal(res.status, 200)
    assert.equal(res.body.description, 'updated')
  })

  it('updates a node and an edge', async () => {
    const id = await createTopology('NodeEdge')
    const a = await addNode(id, 'pc', 'A')
    const b = await addNode(id, 'server', 'B')
    const un = await request(app).put(`/api/networks/${id}/nodes/${a}`).send({ label: 'A2' })
    assert.equal(un.status, 200)
    assert.equal(un.body.label, 'A2')
    const edge = await request(app).post(`/api/networks/${id}/edges`).send({ source: a, target: b, config: {} })
    const ue = await request(app).put(`/api/networks/${id}/edges/${edge.body.id}`).send({ label: 'L' })
    assert.equal(ue.status, 200)
    assert.equal(ue.body.label, 'L')
  })

  it('rejects an invalid topology patch (400)', async () => {
    const id = await createTopology('BadPatch')
    const res = await request(app).put(`/api/networks/${id}`).send({ nodes: [{ id: 'x' }] })
    assert.equal(res.status, 400)
  })
})
