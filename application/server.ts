import app from './src/app.js';
import { config } from './src/config/index.js';
import { logger } from './src/lib/logger.js';

app.listen(config.port, config.host, () => {
  logger.info(`NetViz backend running on http://${config.host}:${config.port} (${config.nodeEnv})`);
});
