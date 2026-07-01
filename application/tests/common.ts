/// <reference types="mocha" />
// Global, reusable test helpers — imported (via each area's common.ts) everywhere.
import assert from 'node:assert/strict'
import request from 'supertest'
import app from '../src/app.js'

export { assert, request, app }

/** Sign in via the local dev login; returns an agent carrying the session cookie. */
export async function loginAgent(email: string, name?: string) {
  const agent = request.agent(app)
  await agent.post('/auth/dev-login').send({ email, name })
  return agent
}

/** Create a fresh topology in the anonymous local workspace; returns its id. */
export async function createTopology(name = 'Test Net'): Promise<string> {
  const res = await request(app).post('/api/networks').send({ name })
  return res.body.id as string
}

/** Add a node to a topology; returns the created node id. */
export async function addNode(topologyId: string, type = 'pc', label = 'N'): Promise<string> {
  const res = await request(app)
    .post(`/api/networks/${topologyId}/nodes`)
    .send({ type, label, position: { x: 0, y: 0 }, config: {} })
  return res.body.id as string
}
