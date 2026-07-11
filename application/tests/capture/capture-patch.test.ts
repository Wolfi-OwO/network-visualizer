/// <reference types="mocha" />
import { app, request, assert } from './common.ts'

describe('capture: PATCH', () => {
  it('toggles capturing on and off', async () => {
    const on = await request(app).patch('/api/capture').send({ capturing: true })
    assert.equal(on.status, 200)
    assert.equal(on.body.capturing, true)
    const off = await request(app).patch('/api/capture').send({ capturing: false })
    assert.equal(off.body.capturing, false)
  })

  it('without a boolean body -> 400', async () => {
    assert.equal((await request(app).patch('/api/capture').send({})).status, 400)
  })
})
