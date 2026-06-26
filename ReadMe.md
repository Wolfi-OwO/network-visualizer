<div align="center">

# 🌐 NetViz — Network Visualizer & Simulator

**Design, visualize and *simulate* real enterprise networks in your browser.**
Build topologies with drag-and-drop, watch live packets flow hop-by-hop, inspect traffic like Wireshark, and calculate subnets — all in one tool.

[![CI](https://github.com/Wolfi-OwO/routing-visualizer/actions/workflows/ci.yml/badge.svg)](https://github.com/Wolfi-OwO/routing-visualizer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white)

</div>

![Network Builder](docs/screenshots/network-builder.png)

## Features

### Network Builder

- **Drag-and-drop canvas** (powered by React Flow) with 25+ device types across categories: routers, L2/L3 switches, firewalls, IDS/IPS, VPN gateways, load balancers, reverse proxies, API gateways, servers (DNS, DHCP, mail, file, database, VM host), NAS/storage, endpoints (PC, laptop, phone, printer, IoT) and Internet/ISP/cloud.
- **Clean line-icon set** (no emoji), color-coded per role, with per-device **hardware/capabilities** (NIC, Wi-Fi card, CPU/RAM…).
- **Connect from any side** of a device; name & configure links (label, bandwidth, latency, up/down).
- **Per-device power button** — switch a device on and it **automatically broadcasts DHCP (DORA)** and gets an address. Power something off and traffic correctly stops crossing it.
- **Live, concurrent traffic simulation** — many labelled packets (DNS, HTTPS, SMTP, SQL, DHCP…) animate in parallel, in real time. DNS lookups precede server requests, just like real life.
- **Send-a-packet trace**: hop-by-hop path with routing (longest-prefix match), **firewall ACLs** (ingress/egress + implicit deny), **NAT** at the Internet edge, **TTL**, **VLAN isolation** and **subnet segmentation** enforcement, plus clear block reasons.
- **Resizable inspector**, **Undo/Redo** (`Ctrl+Z` / `Ctrl+Shift+Z`) and **autosave** to local storage.
- **Guided build tutorial** that teaches the whole workflow step-by-step.

### Packet Capture (Wireshark-style)

- Live packet stream over **Server-Sent Events**, protocol tree, hex dump, statistics.
- **16+ protocols** generated realistically (HTTP, TLS, DNS, mDNS, DHCP, ARP, ICMP, TCP, UDP, STP, NTP, LLDP, SNMP, OSPF, SSDP, SIP) with **per-protocol on/off toggles**.

### CIDR Calculator

- Subnet / network / broadcast / host math, binary view, subnet splitter, and supernet (route summarization) with strict input validation.

## Tech stack

| Layer    | Tech                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Flow (`@xyflow/react`), Recharts, lucide-react, axios |
| Backend  | Node.js, Express, TypeScript, MongoDB + Mongoose, Server-Sent Events, terminus (health checks)        |
| Tooling  | ESLint, `tsc`, `node:test` + supertest, GitHub Actions                                                |

The HTTP API is **RESTful (Richardson Maturity Model level 3)**: plural resource URLs (`/api/networks`, `/api/packets`, `/api/capture`, `/api/cidr`), correct verbs/status codes (`201 Created` + `Location`, `204 No Content`), and **HATEOAS** `_links` on every representation. `GET /api` is the hypermedia entry point. Liveness/readiness probes are exposed at `/api/live` and `/api/ready`.

## Project structure

```text
routing-visualizer/
├─ application/                 # Express + TypeScript backend (REST + SSE)
│  ├─ src/
│  │  ├─ routes/                # express.Router definitions: networks, cidr, packets, capture
│  │  ├─ handlers/              # request handlers (controllers) per route
│  │  ├─ services/              # business logic: packet-simulator, cidr-service, packet-sender-service
│  │  ├─ db/                    # MongoDB: connection, models/, network-service (repository), seed
│  │  ├─ middlewares/           # request-logger, error-handler
│  │  ├─ lib/                   # logger, HTTP error classes, hateoas links, health-checks
│  │  ├─ config/                # environment-driven configuration
│  │  ├─ types/                 # shared domain types (packet, network, cidr)
│  │  └─ app.ts                 # express app assembly (CORS, body parsing, routes)
│  ├─ server.ts                 # entrypoint (DB connect + seed, binds HOST:PORT, health checks)
│  ├─ tests/                    # endpoint tests (node:test + supertest + mongodb-memory-server)
│  ├─ Dockerfile · .dockerignore · .prettierrc · .env.example · README.md
│  │
│  └─ client/                   # React + Vite frontend (kebab-case, explicit import extensions)
│     ├─ src/
│     │  ├─ pages/              # one folder per page incl. its components (dashboard/, packets/, network/, cidr/, admin/)
│     │  ├─ components/         # core/ (generic) · toasts/ (toast UI)
│     │  ├─ layouts/            # regular-layout, admin-layout, top-nav, sidebar, error-page
│     │  ├─ lib/api/            # axios API client (one module per backend resource)
│     │  ├─ hooks/ · context/   # use-toast hook · toast provider
│     │  ├─ config/             # frontend config (VITE_* env vars)
│     │  ├─ styles/             # global CSS
│     │  └─ types/              # shared types (mirror of backend)
│     ├─ .prettierrc            # no Docker image — built in CI as the `client-dist` artifact
│     └─ vite.config.ts         # dev proxy  /api → http://localhost:8080
├─ .github/workflows/ci.yml     # CI: typecheck + lint + build
├─ docker-compose.yml           # full stack: mongo + backend (+ frontend)
├─ LICENSE
└─ ReadMe.md
```

> The backend lives in `application/` and the frontend in `application/client/` — two independent npm packages, organized into clear enterprise layers (routes / handlers / services / db / middlewares / lib / config on the server; pages / components / layouts / lib / config / hooks on the client). All filenames are lowercase kebab-case and every import carries its explicit extension, so the project builds identically on case-sensitive (Linux) filesystems.

## Getting started

### Prerequisites

- **Node.js ≥ 20** (CI uses Node 22) and **npm**
- **MongoDB** — run one locally with `docker run -p 27017:27017 mongo:7` (or use the bundled `docker compose up mongo`). Override the connection with `MONGO_URI` (default `mongodb://localhost:27017/netviz`). The backend seeds a demo "Enterprise Network" topology on first start.

### Run in development

The app has two parts — run each in its own terminal.

**1) Backend** (REST API + packet stream on **:8080**, needs MongoDB running)

```bash
cd application
npm install
npm run dev
```

**2) Frontend** (Vite dev server on **:5173**, proxies `/api` → `:8080`)

```bash
cd application/client
npm install
npm run dev
```

Then open **<http://localhost:5173>** 🎉

## Scripts

**Backend** (`application/`)

| Script              | Description                                     |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Start with hot-reload (nodemon + ts-node)       |
| `npm run build`     | Compile TypeScript → `dist/`                    |
| `npm start`         | Run the compiled server (`node dist/server.js`) |
| `npm run typecheck` | Type-check without emitting                     |
| `npm test`          | Run endpoint tests (in-memory MongoDB)          |

**Frontend** (`application/client/`)

| Script              | Description                                         |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Vite dev server with HMR                            |
| `npm run build`     | Type-check (`tsc -b`) + production bundle → `dist/` |
| `npm run preview`   | Preview the production bundle locally               |
| `npm run lint`      | Run ESLint                                          |
| `npm run typecheck` | Type-check without emitting                         |

## Building for production

### Backend

```bash
cd application
npm install
npm run build      # → application/dist/
npm start          # node dist/server.js   (set PORT to override 8080)
```

### Frontend

```bash
cd application/client
npm install
npm run build      # → application/client/dist/ (static assets)
npm run preview    # optional local preview
```

The frontend has **no Docker image of its own**. In CI it is built and published as the `client-dist` artifact; the backend Docker image then bakes that bundle in (`COPY client/dist ./client/dist`) and serves it as static files with SPA fallback. To build the backend image locally, build the frontend first so `application/client/dist/` exists in the build context:

```bash
cd application/client && npm run build      # produces client/dist
cd ..                && docker build -t netviz .
```

Alternatively serve `application/client/dist/` from any static host (Caddy, a CDN, …) and point it at the backend.

> **Production note:** the SPA talks to the backend at `/api`, and the backend serves the SPA from `<cwd>/client/dist`, so a single origin works out of the box. The backend's CORS allowlist accepts `localhost` / `127.0.0.1` — set `CORS_ORIGINS` (comma-separated) for your production domain(s). All configuration is environment-driven (see `application/.env.example`).

## Testing & quality

Current quality gates (also enforced in CI):

```bash
# Frontend
cd application/client
npm run lint          # ESLint
npm run typecheck     # tsc (no emit)
npm run build         # type-check + bundle

# Backend
cd application
npm run typecheck     # tsc (no emit)
npm run build         # compile
```

> A dedicated unit-test suite (e.g. Vitest for `cidrService` / `packetSenderService`) is on the roadmap.

## CI/CD — GitHub Actions

`.github/workflows/ci.yml` runs on every push / PR to `main` or `master`:

- **Server job** → `npm ci` + `npm run build` (type-check + compile) in `application/`
- **Client job** → `npm ci` + `npm run lint` + `npm run build` in `application/client/`

Both jobs run on Node 22 with npm caching, a least-privilege token, and concurrency cancellation of superseded runs.

## Configuration

All backend configuration is read from the environment in `application/src/config/index.ts` (see `application/.env.example`); the frontend reads `VITE_*` vars in `application/client/src/config.ts` (see `application/client/.env.example`).

| Variable           | Where            | Default                        |
| ------------------ | ---------------- | ------------------------------ |
| `HOST`             | backend          | `0.0.0.0`                      |
| `PORT`             | backend          | `8080`                         |
| `NODE_ENV`         | backend          | `development`                  |
| `CORS_ORIGINS`     | backend          | `localhost` / `127.0.0.1`      |
| `JSON_BODY_LIMIT`  | backend          | `8mb`                          |
| `VITE_APP_VERSION` | frontend         | `1.0.0`                        |
| `VITE_REPO_URL`    | frontend         | project repo                   |
| Dev API proxy      | `vite.config.ts` | `/api → http://localhost:8080` |

## Contributing

1. Fork & create a feature branch.
2. Keep it green: `npm run lint`, `npm run typecheck`, `npm run build` in the affected package(s).
3. Open a pull request.

## License

Released under the **MIT License** — see [LICENSE](./LICENSE).
