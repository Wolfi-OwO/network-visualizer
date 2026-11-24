import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'node:path';
import { config, isOriginAllowed } from './config/index.js';
import { requestLogger } from './middlewares/request-logger.js';
import { notFound, errorHandler } from './middlewares/error-handler.js';
import { authenticate, requireWrite, requireAuth } from './middlewares/auth.js';
import { audit } from './middlewares/audit.js';
import { apiLimiter, authLimiter } from './middlewares/rate-limit.js';
import { countRequest } from './services/metrics-service.js';
import { apiRootLinks } from './lib/hateoas.js';
import { appInfo } from './lib/app-info.js';
import authRouter from './routes/auth.routes.js';
import auditRouter from './routes/audit.routes.js';
import metricsRouter from './routes/metrics.routes.js';
import usersRouter from './routes/users.routes.js';
import meRouter from './routes/me.routes.js';
import networksRouter from './routes/networks.routes.js';
import { readFile } from 'node:fs/promises';
import { renderIndex } from './seo/render.js';
import cidrRouter from './routes/cidr.routes.js';
import packetsRouter from './routes/packets.routes.js';
import captureRouter from './routes/capture.routes.js';

// The built SPA is served from <cwd>/client/dist. In dev the cwd is the
// `application/` package; in the Docker image it is /app (where the CI-built
// client/dist artifact is copied to). Same resolution in both cases.
const clientDist = path.join(process.cwd(), 'client', 'dist');

// Vite puts a content hash in every file name under assets/, so a changed file is always a new URL and may be kept for
// a year. Everything else (index.html, the icon) keeps its name across releases, so it is revalidated with its ETag:
// "no-cache" still stores the file, and an unchanged one costs a 304 with no body, while a deploy shows at once.
const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';
const assetsDir = path.join(clientDist, 'assets') + path.sep;

const app = express();

// Trust one reverse-proxy hop so req.secure / req.protocol reflect the original
// HTTPS request (controls the cookie Secure flag) without over-trusting
// X-Forwarded-For (which would let clients spoof their IP past rate limiting).
app.set('trust proxy', 1);

// Security headers. CSP is left off so the bundled SPA (inline React styles) is
// not broken; tighten it per deployment if you serve from a fixed origin.
//
// Content-Security-Policy, Strict-Transport-Security, Referrer-Policy,
// X-Frame-Options and X-Content-Type-Options are also disabled here because
// Caddy (the only reverse proxy in front of this app, application/../Caddyfile
// on the VPS) already sets each of them per-site, tuned for this domain's
// asset origins (Google Fonts, avatar CDNs). Measured with `curl -sI` against
// the live netviz site: every one of those five came back TWICE, Caddy's
// value and helmet's default, and a browser resolves two conflicting headers
// to whichever is more restrictive silently — not a loud failure, just a
// policy nobody asked for. One owner (the edge) avoids that. Helmet still
// sets everything it doesn't overlap with Caddy on (COOP, CORP,
// Origin-Agent-Cluster, X-DNS-Prefetch-Control, X-Download-Options,
// X-Permitted-Cross-Domain-Policies, X-XSS-Protection) as defense in depth.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: false,
    referrerPolicy: false,
    xFrameOptions: false,
    xContentTypeOptions: false,
  }),
);

app.use(
  express.static(clientDist, {
    // "/" must reach the page route below, which fills in the head; the bare file would skip it.
    index: false,
    setHeaders: (res, filePath) => {
      res.setHeader('Cache-Control', filePath.startsWith(assetsDir) ? IMMUTABLE : REVALIDATE);
    },
  }),
);

// Restrict CORS to local development origins (and same-origin / tooling requests
// that send no Origin header). `credentials` lets the session cookie flow.
//
// `preflightContinue: true` is required: without it, cors() answers every
// OPTIONS request itself with a blanket 204 that carries no `Allow` header —
// measured directly against this app, it did that for EVERY path, including
// ones that don't exist, so OPTIONS could never be used to discover what a
// route actually supports. With `preflightContinue`, cors still sets the
// Access-Control-* headers but hands the request to Express's own router,
// which answers OPTIONS per-route (a real `Allow` header, or a genuine 404
// for an unknown path).
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || isOriginAllowed(origin)),
    credentials: true,
    preflightContinue: true,
  }),
);

app.use(express.json({ limit: config.jsonBodyLimit })); // topologies can be large
app.use(cookieParser());
app.use(authenticate); // populates req.user from the session cookie, if any
app.use(requestLogger);
app.use(audit); // record mutating actions by signed-in users

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Who is running: the same answer, at the same path, in every app of the stack.
app.get('/api/info', (_req, res) => {
  res.json(appInfo());
});

// API entry point — hypermedia root (RMM level 3 discoverability)
app.get('/api', (_req, res) => {
  res.json({ name: 'NetViz API', version: 1, _links: apiRootLinks() });
});

// When REQUIRE_AUTH is on, the anonymous local workspace is disabled and every
// topology request must be authenticated.
const networkGuards = config.requireAuth ? [requireAuth, requireWrite] : [requireWrite];

app.use('/auth', authLimiter, authRouter);
app.use('/api', apiLimiter, countRequest);
app.use('/api/audit', auditRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/users', usersRouter); // admin-only account & role management
app.use('/api/me', meRouter); // self-service GDPR export/delete
app.use('/api/networks', ...networkGuards, networksRouter); // per-user, viewers read-only
app.use('/api/cidr', cidrRouter);
app.use('/api/packets', packetsRouter);
app.use('/api/capture', captureRouter);

app.get(/^(?!\/api|\/auth).*/, async (req, res, next) => {
  try {
    const html = renderIndex(await readFile(path.join(clientDist, 'index.html'), 'utf8'), req.path);
    res.set('Cache-Control', REVALIDATE).type('html').send(html);
  } catch (error) {
    // No built client (tests, API-only runs) or an unreadable file: the 404 handler answers, as before.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return next();
    next(error);
  }
});

app.use(notFound);
app.use(errorHandler);

export default app;
