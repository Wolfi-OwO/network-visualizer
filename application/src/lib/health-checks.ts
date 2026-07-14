import type { Server } from 'node:http';
import mongoose from 'mongoose';
import { createTerminus } from '@godaddy/terminus';
import { logger } from './logger.js';

// Based on https://github.com/godaddy/terminus/blob/main/example/mongoose/express.js

// Readiness — is the app able to serve traffic (DB connected)?
function onReadinessCheck(): Promise<void> {
  // https://mongoosejs.com/docs/api.html#connection_Connection-readyState
  const { readyState } = mongoose.connection;

  // disconnected / disconnecting
  if (readyState === 0 || readyState === 3) {
    return Promise.reject(new Error('Mongoose has disconnected'));
  }
  // connecting
  if (readyState === 2) {
    return Promise.reject(new Error('Mongoose is connecting'));
  }
  // connected
  return Promise.resolve();
}

// Liveness — is the process up at all?
function onLivenessCheck(): Promise<void> {
  return Promise.resolve();
}

// Graceful shutdown: close the DB connection.
function onSignal(): Promise<void> {
  logger.info('Backend - Starting shutdown');
  return mongoose.connection.close(false).then(() => {
    logger.info('DB - Connection closed');
    logger.info('Backend - Finished shutdown');
  });
}

/** Attach Kubernetes-style health probes + graceful shutdown to the HTTP server. */
export function setupHealthChecks(server: Server): void {
  createTerminus(server, {
    signal: 'SIGINT',
    healthChecks: {
      '/api/ready': onReadinessCheck,
      '/api/live': onLivenessCheck,
    },
    beforeShutdown: () => {
      logger.info('Backend - Stopping with grace period of 5 secs');
      return new Promise((resolve) => setTimeout(resolve, 5000));
    },
    onSignal,
  });
}
