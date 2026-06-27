import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { config, isOriginAllowed } from './config/index.js';
import { requestLogger } from './middlewares/request-logger.js';
import { notFound, errorHandler } from './middlewares/error-handler.js';
import { authenticate, requireWrite } from './middlewares/auth.js';
import { audit } from './middlewares/audit.js';
import { apiRootLinks } from './lib/hateoas.js';
import authRouter from './routes/auth.routes.js';
import auditRouter from './routes/audit.routes.js';
import networksRouter from './routes/networks.routes.js';
import cidrRouter from './routes/cidr.routes.js';
import packetsRouter from './routes/packets.routes.js';
import captureRouter from './routes/capture.routes.js';

// The built SPA is served from <cwd>/client/dist. In dev the cwd is the
// `application/` package; in the Docker image it is /app (where the CI-built
// client/dist artifact is copied to). Same resolution in both cases.
const clientDist = path.join(process.cwd(), 'client', 'dist');

const app = express();

// Behind a TLS-terminating reverse proxy, trust X-Forwarded-* so req.secure /
// req.protocol reflect the original HTTPS request (controls the cookie Secure flag).
app.set('trust proxy', true);

app.use(express.static(clientDist))

// Restrict CORS to local development origins (and same-origin / tooling requests
// that send no Origin header). `credentials` lets the session cookie flow.
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || isOriginAllowed(origin)),
  credentials: true,
}));

app.use(express.json({ limit: config.jsonBodyLimit })); // topologies can be large
app.use(cookieParser());
app.use(authenticate);     // populates req.user from the session cookie, if any
app.use(requestLogger);
app.use(audit);            // record mutating actions by signed-in users

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// API entry point — hypermedia root (RMM level 3 discoverability)
app.get('/api', (_req, res) => {
  res.json({ name: 'NetViz API', version: 1, _links: apiRootLinks() });
});

app.use('/api/auth', authRouter);
app.use('/api/audit', auditRouter);
app.use('/api/networks', requireWrite, networksRouter);   // per-user, viewers read-only
app.use('/api/cidr', cidrRouter);
app.use('/api/packets', packetsRouter);
app.use('/api/capture', captureRouter);

app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
});

app.use(notFound);
app.use(errorHandler);

export default app;
