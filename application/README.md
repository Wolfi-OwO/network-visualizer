# NetViz — Backend

Express + TypeScript API that powers the NetViz frontend: live packet simulation
(Server-Sent Events), the packet-trace engine, CIDR math, MongoDB-backed
topologies, OAuth sign-in with role-based access control, and an admin surface
(users, metrics, audit log). In production it also serves the built
SPA from `client/dist` on the same origin.

## Layout

```text
src/
├─ routes/         # express.Router definitions (path → handler)
│  ├─ auth.routes.ts        # /auth           — OAuth (Google/Microsoft), dev login, session, logout
│  ├─ users.routes.ts       # /api/users      — account & role management (admin)
│  ├─ networks.routes.ts    # /api/networks   — topology CRUD, versions, validation, export
│  ├─ packets.routes.ts     # /api/packets    — live capture stream (SSE) + stats
│  ├─ capture.routes.ts     # /api/capture    — capture state & protocol toggles
│  ├─ cidr.routes.ts        # /api/cidr       — subnet / supernet calculations
│  ├─ audit.routes.ts       # /api/audit      — audit log (admin)
│  └─ metrics.routes.ts     # /api/metrics    — system metrics (admin)
├─ handlers/       # request handlers (controllers) per route
├─ services/       # business logic: packet-simulator, packet-sender (routing/firewall/
│                  #   NAT/VLAN), cidr, auth, metrics, versions, validation, export
├─ db/             # MongoDB: connection, models/, network repository, demo seed
├─ middlewares/    # auth (sessions + roles), audit, rate-limit, request-logger, error-handler
├─ lib/            # logger, HTTP error classes, hateoas links, jwt, health-checks
├─ config/         # environment-driven configuration (single source of process.env)
├─ types/          # shared domain types (packet, network, cidr)
└─ app.ts          # express app assembly (helmet, CORS, routes, SPA serving + fallback)
server.ts          # entrypoint: config validation, DB connect + seed, health probes
tests/             # Mocha + Supertest + c8 (in-memory MongoDB), ≥90% line coverage
```

## Scripts

| Script              | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Hot-reload dev server (nodemon + ts-node)          |
| `npm run build`     | Compile to `dist/`                                 |
| `npm start`         | Run the compiled server (`node dist/server.js`)    |
| `npm run lint`      | Run ESLint                                         |
| `npm run typecheck` | Type-check without emitting                        |
| `npm test`          | Mocha + c8 (in-memory MongoDB, ≥90% line coverage) |
| `npm run test-ci`   | Same, with cobertura + JUnit reports for CI        |

## Configuration

Every tunable lives in [`src/config/index.ts`](src/config/index.ts) and is
documented in [`.env.example`](.env.example) — copy it to `.env` and adjust.
Highlights:

| Variable                    | Default                            | Purpose                                            |
| --------------------------- | ---------------------------------- | -------------------------------------------------- |
| `HOST` / `PORT`             | `0.0.0.0` / `8080`                 | Bind address and port                              |
| `MONGODB_CONNECTION_STRING` | `mongodb://localhost:27017/netviz` | MongoDB connection string                          |
| `JWT_SECRET` / `JWT_TTL`    | — / `7d`                           | Session signing secret (validated in prod) and TTL |
| `ALLOW_DEV_LOGIN`           | `true` outside production          | Password-less local login                          |
| `REQUIRE_AUTH`              | `false`                            | Disable the anonymous shared workspace             |
| `CORS_ORIGINS`              | `localhost` / `127.0.0.1`          | Comma-separated CORS allow-list                    |
| `GOOGLE_*` / `MICROSOFT_*`  | —                                  | OAuth provider credentials                         |

OAuth redirect URIs are derived from the request, so no base-URL variable is
needed — register `<public URL>/auth/<provider>/callback` with the provider.

`validateConfig()` refuses to start in production with a missing/weak
`JWT_SECRET`, so misconfiguration fails fast instead of running insecurely.

## API

The full endpoint reference lives in [`docs/api.md`](../docs/api.md).
`GET /api` is the hypermedia entry point (HATEOAS `_links` on every
representation); health probes are `/api/live` and `/api/ready`; sign-in flows
live under `/auth`.

## Docker

The image expects the built SPA at `client/dist` in the build context (CI
produces it as the `client-dist` artifact):

```bash
cd client && npm run build && cd ..
docker build -t netviz .
docker run -p 8080:8080 --env-file .env netviz
```

Or run the full stack (MongoDB + backend) from the repo root with
`docker compose up --build`.
