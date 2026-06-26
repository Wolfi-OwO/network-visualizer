import app from './src/app.js';
import { config } from './src/config/index.js';
import { logger } from './src/lib/logger.js';
import { setupDBConnection } from './src/db/connection.js';
import { setupHealthChecks } from './src/lib/health-checks.js';

await setupDBConnection(config.mongoUri, config.dbRecreate);

const server = app.listen(config.port, config.host, () => {
  logger.info(`NetViz backend running on http://${config.host}:${config.port} (${config.nodeEnv})`);
});

// Health probes (/api/ready, /api/live) + graceful shutdown
setupHealthChecks(server);
