import { setDefaultResultOrder } from 'node:dns';
import app from './src/app.js';
import { config, validateConfig } from './src/config/index.js';
import { logger } from './src/lib/logger.js';
import { setupDBConnection } from './src/db/connection.js';
import { setupHealthChecks } from './src/lib/health-checks.js';

// Refuse to start with insecure config in production (default JWT secret, etc.).
validateConfig();

// Prefer IPv4 for outbound lookups — broken/absent IPv6 in containers is a common
// cause of "fetch failed" when calling OAuth endpoints (e.g. login.microsoftonline.com).
setDefaultResultOrder('ipv4first');

await setupDBConnection(config.mongoUri, config.dbRecreate);

const server = app.listen(config.port, config.host, () => {
  logger.info(`NetViz backend running on http://${config.host}:${config.port} (${config.nodeEnv})`);
});

// Health probes (/api/ready, /api/live) + graceful shutdown
setupHealthChecks(server);
