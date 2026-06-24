import express from 'express';
import cors from 'cors';
import packetsRouter from './routes/packets';
import cidrRouter from './routes/cidr';
import networkRouter from './routes/network';
import packetSendRouter from './routes/packetSend';

const app = express();

// Restrict CORS to local development origins (and same-origin / tooling requests
// that send no Origin header). Avoids the previous wide-open `origin: '*'`.
const ALLOWED_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGIN.test(origin)),
}));
app.use(express.json({ limit: '8mb' })); // topologies can be large

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/packets', packetsRouter);
app.use('/api/cidr', cidrRouter);
app.use('/api/network', networkRouter);
app.use('/api/send', packetSendRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

export default app;
