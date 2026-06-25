import express from 'express';
import cors from 'cors';
import { config, isOriginAllowed } from './config/index.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import packetsRouter from './api/packets.js';
import cidrRouter from './api/cidr.js';
import networkRouter from './api/network.js';
import packetSendRouter from './api/packetSend.js';
import path from 'node:path';
const __dirname = import.meta.dirname;

const app = express();

app.use(express.static(path.join(__dirname, '..', 'client', 'dist')))

// Restrict CORS to local development origins (and same-origin / tooling requests
// that send no Origin header). Avoids a wide-open `origin: '*'`.
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || isOriginAllowed(origin)),
}));

app.use(express.json({ limit: config.jsonBodyLimit })); // topologies can be large
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use('/api/packets', packetsRouter);
app.use('/api/cidr', cidrRouter);
app.use('/api/network', networkRouter);
app.use('/api/send', packetSendRouter);

app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

export default app;
