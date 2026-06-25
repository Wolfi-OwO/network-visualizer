<div align="center">

# 🌐 NetViz — Network Visualizer & Simulator

**Design, visualize and *simulate* real enterprise networks in your browser.**
Build topologies with drag-and-drop, watch live packets flow hop-by-hop, inspect traffic like Wireshark, and calculate subnets — all in one tool.

<!-- Replace `Wolfi-OwO` with your GitHub handle so the CI badge resolves -->
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
| Backend  | Node.js, Express, TypeScript, Server-Sent Events                                                      |
| Tooling  | ESLint, `tsc`, GitHub Actions                                                                         |

## Project structure

```text
routing-visualizer/
├─ application/                 # Express + TypeScript backend (REST + SSE)
│  ├─ src/
│  │  ├─ api/                   # Express routers: packets, cidr, network, packetSend
│  │  ├─ services/              # business logic: packetSimulator, cidrService, packetSenderService
│  │  ├─ db/                    # data store (in-memory topology repository)
│  │  ├─ middlewares/           # requestLogger, errorHandler
│  │  ├─ lib/                   # reusable utilities (logger)
│  │  ├─ config/                # environment-driven configuration
│  │  ├─ types/                 # shared domain types
│  │  ├─ app.ts                 # express app assembly (CORS, body parsing, routes)
│  │  └─ server.ts              # entrypoint (PORT 8080)
│  ├─ tests/                    # test suite (planned)
│  ├─ Dockerfile · .dockerignore · .prettierrc · README.md
│  │
│  └─ client/                   # React + Vite frontend
│     ├─ src/
│     │  ├─ pages/              # route-level views (Dashboard, PacketCapture, NetworkBuilder, CIDR)
│     │  ├─ components/         # feature components (NetworkBuilder/, PacketCapture/)
│     │  ├─ layouts/            # Layout + Sidebar
│     │  ├─ lib/                # axios API client
│     │  ├─ hooks/ · context/ · common/   # shared React building blocks
│     │  ├─ styles/             # global CSS
│     │  └─ types/              # shared types (mirror of backend)
│     ├─ Dockerfile · nginx.conf · .prettierrc
│     └─ vite.config.ts         # dev proxy  /api → http://localhost:8080
├─ .github/workflows/ci.yml     # CI: typecheck + lint + build
├─ docker-compose.yml           # full stack (frontend :8080 + backend :8080)
├─ LICENSE
└─ ReadMe.md
```

> The backend lives in `application/` and the frontend in `application/client/` — two independent npm packages, organized into clear enterprise layers (api / services / db / middlewares / lib / config on the server; pages / components / layouts / lib on the client).

## Getting started

### Prerequisites

- **Node.js ≥ 20** (CI uses Node 22) and **npm**

### Run in development

The app has two parts — run each in its own terminal.

**1) Backend** (REST API + packet stream on **:8080**)

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

**Frontend** (`application/client/`)

| Script              | Description                                         |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Vite dev server with HMR                            |
| `npm run build`     | Type-check (`tsc -b`) + production bundle → `dist/` |
| `npm run preview`   | Preview the production bundle locally               |
| `npm run lint`      | Run ESLint                                          |
| `npm run typecheck` | Type-check without emitting                         |

## Building for production

**Backend**

```bash
cd application
npm install
npm run build      # → application/dist/
npm start          # node dist/server.js   (set PORT to override 8080)
```

**Frontend**

```bash
cd application/client
npm install
npm run build      # → application/client/dist/ (static assets)
npm run preview    # optional local preview
```

Serve `application/client/dist/` from any static host (nginx, Caddy, a CDN, …).

> **Production note:** the SPA talks to the backend at `/api`. Put both behind one origin (reverse-proxy `/api` → the Node server) so the browser stays same-origin. The backend's CORS allowlist accepts `localhost` / `127.0.0.1` out of the box — set `CORS_ORIGINS` (comma-separated) to your production domain(s). All configuration is environment-driven (see `application/.env.example`).

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
