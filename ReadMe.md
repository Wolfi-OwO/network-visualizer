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

![Network Builder](network-builder.png)

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
│  │  ├─ routes/                # packets, cidr, network, packetSend
│  │  ├─ services/              # packetSimulator, cidrService, networkService, packetSenderService
│  │  ├─ types/                 # shared domain types
│  │  ├─ app.ts                 # express app, CORS, middleware
│  │  └─ server.ts              # entrypoint (PORT 3001)
│  ├─ client/                   # React + Vite frontend
│  │  ├─ src/
│  │  │  ├─ components/          # NetworkBuilder, PacketCapture, CIDRCalculator, Dashboard, Layout
│  │  │  ├─ api/                # axios client
│  │  │  └─ types/              # shared types (mirror of backend)
│  │  └─ vite.config.ts         # dev proxy  /api → http://localhost:3001
│  ├─ package.json              # backend
│  └─ tsconfig.json
├─ .github/workflows/ci.yml     # CI: typecheck + lint + build
├─ LICENSE
└─ ReadMe.md
```

> The backend lives in `application/` and the frontend in `application/client/` — two independent npm packages.

## Getting started

### Prerequisites

- **Node.js ≥ 20** (CI uses Node 22) and **npm**

### Run in development

The app has two parts — run each in its own terminal.

**1) Backend** (REST API + packet stream on **:3001**)

```bash
cd application
npm install
npm run dev
```

**2) Frontend** (Vite dev server on **:5173**, proxies `/api` → `:3001`)

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
npm start          # node dist/server.js   (set PORT to override 3001)
```

**Frontend**

```bash
cd application/client
npm install
npm run build      # → application/client/dist/ (static assets)
npm run preview    # optional local preview
```

Serve `application/client/dist/` from any static host (nginx, Caddy, a CDN, …).

> **Production note:** the SPA talks to the backend at `/api`. Put both behind one origin (reverse-proxy `/api` → the Node server) so the browser stays same-origin. The backend's CORS allowlist accepts `localhost` / `127.0.0.1` out of the box — widen `ALLOWED_ORIGIN` in `application/src/app.ts` for your production domain.

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

| What                 | Where                                       | Default                        |
| -------------------- | ------------------------------------------- | ------------------------------ |
| Backend port         | `PORT` env var                              | `3001`                         |
| Dev API proxy        | `application/client/vite.config.ts`         | `/api → http://localhost:3001` |
| Allowed CORS origins | `application/src/app.ts` (`ALLOWED_ORIGIN`) | `localhost` / `127.0.0.1`      |

## Contributing

1. Fork & create a feature branch.
2. Keep it green: `npm run lint`, `npm run typecheck`, `npm run build` in the affected package(s).
3. Open a pull request.

## License

Released under the **MIT License** — see [LICENSE](./LICENSE).
