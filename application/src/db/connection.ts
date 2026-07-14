import mongoose from 'mongoose';
import { logger } from '../lib/logger.js';

const dbConnectTimeout = 3000;

/** Open the shared Mongoose connection (optionally dropping the DB first). */
export async function setupDBConnection(
  connectionString: string,
  recreateDatabase = false,
  dbName?: string,
): Promise<void> {
  try {
    logger.info(`DB - Setting up connection${dbName ? ` to database '${dbName}'` : ''}`);

    if (recreateDatabase) {
      logger.info('DB - Start dropping current database');
      await dropCurrentDatabase(connectionString, dbName);
      logger.info('DB - Current database dropped !!');
    }

    await mongoose.connect(connectionString, {
      serverSelectionTimeoutMS: dbConnectTimeout,
      ...(dbName ? { dbName } : {}),
    });

    logger.info('DB - Connection established.');
  } catch (err) {
    logger.error('DB - Unable to setup connection... ', err);
    process.exit(1);
  }
}

/**
 * Drop the database the connection points at. `dbName` overrides the database
 * embedded in the connection string and MUST be honoured here: a preview shares
 * production's connection string, so ignoring it would drop production's data.
 */
export async function dropCurrentDatabase(
  connectionString: string,
  dbName?: string,
): Promise<void> {
  const connection = await mongoose
    .createConnection(connectionString, {
      serverSelectionTimeoutMS: dbConnectTimeout,
      ...(dbName ? { dbName } : {}),
    })
    .asPromise();
  await connection.dropDatabase();
  await connection.close();
}

/** Close the shared connection (used by tests / graceful shutdown). */
export async function closeDBConnection(): Promise<void> {
  await mongoose.disconnect();
}
