// Standalone seeding command — run with `npm run fill-demo-data`.
// Connects, inserts the demo topology if missing, then disconnects.
import { config } from '../config/index.js'
import { logger } from '../lib/logger.js'
import { setupDBConnection, closeDBConnection } from './connection.js'
import { fillDemoData } from './seed.js'

await setupDBConnection(config.mongoUri, config.dbRecreate, config.mongoDbName)
await fillDemoData()
await closeDBConnection()
logger.info('DB - fill-demo-data finished')
process.exit(0)
