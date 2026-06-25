# NetViz — Backend

Express + TypeScript API that powers the NetViz frontend: live packet simulation
(Server-Sent Events), CIDR math, in-memory topology store, and the packet-trace engine.

## Layout

```
src/
├─ api/            # Express routers (HTTP endpoints)
│  ├─ packets.ts       # /api/packets   — live capture stream (SSE) + stats
│  ├─ cidr.ts          # /api/cidr       — subnet / supernet calculations
│  ├─ network.ts       # /api/network    — topology CRUD
│  └─ packetSend.ts    # /api/send       — hop-by-hop packet trace
├─ services/       # Business logic
│  ├─ cidrService.ts
│  ├─ packetSenderService.ts   # routing, firewall, NAT, VLAN/subnet enforcement
│  └─ packetSimulator.ts       # realistic multi-protocol traffic generator
├─ db/             # Data store (in-memory topology repository)
│  └─ networkService.ts
├─ middlewares/    # Cross-cutting Express middleware
│  ├─ requestLogger.ts
│  └─ errorHandler.ts
├─ lib/            # Reusable utilities (logger, …)
├─ config/         # Environment-driven configuration
├─ types/          # Shared domain types
├─ app.ts          # Express app assembly (CORS, body parsing, routes)
└─ server.ts       # Entry point (listens on PORT, default 8080)
tests/             # Test suite (planned)
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Hot-reload dev server (nodemon + ts-node) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled server |
| `npm run typecheck` | Type-check without emitting |

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8080` | HTTP listen port |
| `NODE_ENV` | `development` | Hides error details in `production` |

CORS is restricted to `localhost` / `127.0.0.1` (see `src/config`).

## Docker

```bash
docker build -t netviz-backend .
docker run -p 8080:8080 netviz-backend
```
