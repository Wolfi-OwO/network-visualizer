import mongoose from 'mongoose'
import { logger } from '../lib/logger.js'

const dbConnectTimeout = 3000

/** Open the shared Mongoose connection (optionally dropping the DB first). */
export async function setupDBConnection(connectionString: string, recreateDatabase = false): Promise<void> {
  try {
    logger.info(`DB - Setting up connection using ${connectionString}`)

    if (recreateDatabase) {
      logger.info('DB - Start dropping current database')
      await dropCurrentDatabase(connectionString)
      logger.info('DB - Current database dropped !!')
    }

    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: dbConnectTimeout,
    })

    logger.info(`DB - Connection to ${connectionString} established.`)
  } catch (err) {
    logger.error('DB - Unable to setup connection... ', err)
    process.exit(1)
  }
}

/** Drop the database the connection string points at. */
export async function dropCurrentDatabase(connectionString: string): Promise<void> {
  const connection = await mongoose
    .createConnection(connectionString, { serverSelectionTimeoutMS: dbConnectTimeout })
    .asPromise()
  await connection.dropDatabase()
  await connection.close()
}

/** Close the shared connection (used by tests / graceful shutdown). */
export async function closeDBConnection(): Promise<void> {
  await mongoose.disconnect()
}
