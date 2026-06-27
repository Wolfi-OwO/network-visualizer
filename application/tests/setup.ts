/// <reference types="mocha" />
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { fillDemoData } from '../src/db/seed.js'

// Global test bootstrap (mocha root hooks): connect to the configured MongoDB
// (MONGODB_CONNECTION_STRING) if reachable, otherwise spin up an in-memory one.
let mem: MongoMemoryServer | undefined

before(async function () {
  this.timeout(60000)
  const explicit = process.env.MONGODB_CONNECTION_STRING
  if (explicit) {
    try {
      await mongoose.connect(explicit, { serverSelectionTimeoutMS: 1500 })
    } catch {
      await mongoose.disconnect().catch(() => {})
    }
  }
  if (mongoose.connection.readyState !== 1) {
    mem = await MongoMemoryServer.create()
    await mongoose.connect(mem.getUri())
  }
  await mongoose.connection.dropDatabase()
  await fillDemoData()
})

after(async function () {
  await mongoose.disconnect().catch(() => {})
  if (mem) await mem.stop()
})
