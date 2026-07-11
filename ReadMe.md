<div align="center">

# NetViz — Network Visualizer & Simulator

**Design, visualize and *simulate* real enterprise networks in your browser.**
Build topologies with drag-and-drop, watch live packets flow hop-by-hop, inspect traffic like Wireshark, and calculate subnets — all in one tool.

[![Lint](https://github.com/Wolfi-OwO/network-visualizer/actions/workflows/lint.yml/badge.svg)](https://github.com/Wolfi-OwO/network-visualizer/actions/workflows/lint.yml)
[![CI](https://github.com/Wolfi-OwO/network-visualizer/actions/workflows/ci.yml/badge.svg)](https://github.com/Wolfi-OwO/network-visualizer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Wolfi-OwO/network-visualizer?label=release&color=blue)](https://github.com/Wolfi-OwO/network-visualizer/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![codecov](https://codecov.io/gh/Wolfi-OwO/network-visualizer/graph/badge.svg?token=7YTR0GKYJI)](https://codecov.io/gh/Wolfi-OwO/network-visualizer)

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)
[![Good first issues](https://img.shields.io/github/issues/Wolfi-OwO/network-visualizer/good%20first%20issue?color=7057ff&label=good%20first%20issues)](https://github.com/Wolfi-OwO/network-visualizer/labels/good%20first%20issue)
[![Open issues](https://img.shields.io/github/issues/Wolfi-OwO/network-visualizer)](https://github.com/Wolfi-OwO/network-visualizer/issues)
[![Contributors](https://img.shields.io/github/contributors/Wolfi-OwO/network-visualizer)](https://github.com/Wolfi-OwO/network-visualizer/graphs/contributors)
[![Discussions](https://img.shields.io/github/discussions/Wolfi-OwO/network-visualizer)](https://github.com/Wolfi-OwO/network-visualizer/discussions)

![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-single_image-2496ED?logo=docker&logoColor=white)

</div>

![NetViz in action — building a topology, tracing a packet hop-by-hop, capturing traffic and calculating subnets](docs/demo/netviz-demo.gif)

<div align="center"><sub>A 30-second tour — live traffic simulation, a hop-by-hop packet trace, Wireshark-style capture and the CIDR calculator.<br/>Also available as <a href="docs/demo/netviz-demo.mp4">full-resolution video</a>.</sub></div>

## Features

### Dashboard

![NetViz dashboard](docs/screenshots/page/dashboard.png)

- At-a-glance capture counters, protocol distribution and an inventory of the current topology, with quick access to every tool.

### Network Builder

![Network Builder — live topology with hop-by-hop packet flow](docs/screenshots/page/network-builder.png)

- **Drag-and-drop canvas** (powered by React Flow) with 25+ device types across categories: routers, L2/L3 switches, firewalls, IDS/IPS, VPN gateways, load balancers, reverse proxies, API gateways, servers (DNS, DHCP, mail, file, database, VM host), NAS/storage, endpoints (PC, laptop, phone, printer, IoT) and Internet/ISP/cloud.
- **Clean line-icon set** (no emoji), color-coded per role, with per-device **hardware/capabilities** (NIC, Wi-Fi card, CPU/RAM…).
- **Connect from any side** of a device; name & configure links (label, bandwidth, latency, up/down).
- **Per-device power button** — switch a device on and it **automatically broadcasts DHCP (DORA)** and gets an address. Power something off and traffic correctly stops crossing it.
- **Live, concurrent traffic simulation** — many labelled packets (DNS, HTTPS, SMTP, SQL, DHCP…) animate in parallel, in real time. DNS lookups precede server requests, just like real life.
- **Send-a-packet trace**: hop-by-hop path with routing (longest-prefix match), **firewall ACLs** (ingress/egress + implicit deny), **NAT** at the Internet edge, **TTL**, **VLAN isolation** and **subnet segmentation** enforcement, plus clear block reasons.
- **Resizable inspector**, **Undo/Redo** (`Ctrl+Z` / `Ctrl+Shift+Z`) and **autosave** to local storage.
- **Guided build tutorial** that teaches the whole workflow step-by-step.

### Packet Capture (Wireshark-style)

![Packet capture — live SSE stream, protocol filters, hex dump](docs/screenshots/page/packet-capture.png)

- Live packet stream over **Server-Sent Events**, protocol tree, hex dump, statistics.
- **16+ protocols** generated realistically (HTTP, TLS, DNS, mDNS, DHCP, ARP, ICMP, TCP, UDP, STP, NTP, LLDP, SNMP, OSPF, SSDP, SIP) with **per-protocol on/off toggles**.

### CIDR Calculator

![CIDR calculator — subnet math, binary view and address-space map](docs/screenshots/page/cidr-calculator.png)

- Subnet / network / broadcast / host math, binary view, subnet splitter, and supernet (route summarization) with strict input validation.

### Accounts, roles & administration

- **Sign in with Google or Microsoft** (OAuth 2.0 with CSRF-protected state), or a password-less **dev login** for local use. Sessions are signed JWTs in an `httpOnly` cookie.
- **Role-based access control** — `admin` / `editor` / `viewer`; the first account to sign in becomes admin. Per-user, isolated network workspaces.
- **Admin console** for user & role management, an **audit log** of mutating actions (TTL-expired), and **system metrics**.
- Details in [organizational/](organizational/README.md).

## Tech stack

| Layer    | Tech                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, React Flow (`@xyflow/react`), Recharts, lucide-react, axios |
| Backend  | Node.js, Express, TypeScript, MongoDB + Mongoose, Server-Sent Events, terminus (health checks)        |
| Auth     | OAuth 2.0 (Google / Microsoft), JWT session cookies, role-based access control, rate limiting         |
| Tooling  | ESLint, `tsc`, Mocha + Supertest + c8, GitHub Actions, Docker                                         |

The HTTP API is **RESTful (Richardson Maturity Model level 3)**: plural resource URLs (`/api/networks`, `/api/packets`, `/api/capture`, `/api/cidr`), correct verbs/status codes (`201 Created` + `Location`, `204 No Content`), and **HATEOAS** `_links` on every representation. `GET /api` is the hypermedia entry point. Authentication endpoints live under **`/auth`** (sign-in is a browser redirect flow, not an API resource). Liveness/readiness probes are exposed at `/api/live` and `/api/ready`. See the full [API reference](docs/api.md).

## Project structure

```text
routing-visualizer/
├─ application/                 # Express + TypeScript backend (REST + SSE)
│  ├─ src/
│  │  ├─ routes/                # express.Router per resource: auth, users, networks, packets, capture, cidr, audit, metrics
│  │  ├─ handlers/              # request handlers (controllers) per route
│  │  ├─ services/              # business logic: packet-simulator, packet-sender, cidr, auth, metrics, versions, validation
│  │  ├─ db/                    # MongoDB: connection, models/, network-service (repository), seed
│  │  ├─ middlewares/           # auth (sessions + roles), audit, rate-limit, request-logger, error-handler
│  │  ├─ lib/                   # logger, HTTP error classes, hateoas links, health-checks, jwt
│  │  ├─ config/                # environment-driven configuration
│  │  ├─ types/                 # shared domain types (packet, network, cidr)
│  │  └─ app.ts                 # express app assembly (CORS, body parsing, routes, SPA serving)
│  ├─ server.ts                 # entrypoint (config validation, DB connect + seed, health checks)
│  ├─ tests/                    # Mocha + Supertest suite (in-memory MongoDB)
│  ├─ Dockerfile · docker-compose.yml · .env.example · README.md
│  │
│  └─ client/                   # React + Vite frontend (kebab-case, explicit import extensions)
│     ├─ src/
│     │  ├─ pages/              # one folder per page (dashboard/, network/, packets/, cidr/, admin/, auth/)
│     │  ├─ components/ · layouts/ · hooks/ · context/
│     │  ├─ lib/api/            # axios API client (one module per backend resource)
│     │  ├─ config/ · styles/ · types/
│     ├─ vite.config.ts         # dev proxy  /api and /auth -> http://localhost:8080
│     └─ README.md
├─ docs/                        # API reference, screenshots
├─ deploy/                      # production deployment runbook (Azure Container Apps)
├─ organizational/              # roles, admin guide, access control, account lifecycle
├─ .github/workflows/           # lint.yml · ci.yml (build + test) · package.yml · deploy.yml · release.yml
├─ CONTRIBUTING.md · SECURITY.md · CHANGELOG.md · LICENSE
└─ ReadMe.md
```

> The backend lives in `application/` and the frontend in `application/client/` — two independent npm packages, organized into clear enterprise layers (routes / handlers / services / db / middlewares / lib / config on the server; pages / components / layouts / lib / config / hooks on the client). All filenames are lowercase kebab-case and every import carries its explicit extension, so the project builds identically on case-sensitive (Linux) filesystems.

## Getting started

### Prerequisites

- **Node.js ≥ 20** (CI uses Node 22) and **npm**
- **MongoDB** — run one locally with `docker run -p 27017:27017 mongo:7` (or use the bundled `docker compose up mongo` from `application/`). Override the connection with `MONGODB_CONNECTION_STRING` (default `mongodb://localhost:27017/netviz`). The backend seeds a demo "Enterprise Network" topology on first start.

### Run in development

The app has two parts — run each in its own terminal.

**1) Backend** (REST API + packet stream on **:8080**, needs MongoDB running)

```bash
cd application
npm install
npm run dev
```

**2) Frontend** (Vite dev server on **:5173**, proxies `/api` and `/auth` -> `:8080`)

```bash
cd application/client
npm install
npm run dev
```

Then open **<http://localhost:5173>**.

### Run the full stack with Docker Compose

```bash
cd application
cp .env.example .env       # adjust secrets first
docker compose up --build
```

This starts MongoDB and the backend container (which also serves the built SPA) on **<http://localhost:8080>**. The `docker-compose.yml` lives in `application/`, so run Compose from there.

## Scripts

**Backend** (`application/`)

| Script              | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Start with hot-reload (nodemon + ts-node)          |
| `npm run build`     | Compile TypeScript -> `dist/`                      |
| `npm start`         | Run the compiled server (`node dist/server.js`)    |
| `npm run lint`      | Run ESLint                                         |
| `npm run typecheck` | Type-check without emitting                        |
| `npm test`          | Mocha + c8 (in-memory MongoDB, ≥90% line coverage) |
| `npm run test-ci`   | Same, with cobertura + JUnit reports for CI        |

**Frontend** (`application/client/`)

| Script              | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Vite dev server with HMR                             |
| `npm run build`     | Type-check (`tsc -b`) + production bundle -> `dist/` |
| `npm run preview`   | Preview the production bundle locally                |
| `npm run lint`      | Run ESLint                                           |
| `npm run typecheck` | Type-check without emitting                          |

## Building for production

### Backend

```bash
cd application
npm install
npm run build      # -> application/dist/
npm start          # node dist/server.js   (set PORT to override 8080)
```

### Frontend

```bash
cd application/client
npm install
npm run build      # -> application/client/dist/ (static assets)
npm run preview    # optional local preview
```

The frontend has **no Docker image of its own**. In CI it is built and published as the `client-dist` artifact; the backend Docker image then bakes that bundle in (`COPY client/dist ./client/dist`) and serves it as static files with SPA fallback. To build the backend image locally, build the frontend first so `application/client/dist/` exists in the build context:

```bash
cd application/client && npm run build      # produces client/dist
cd ..                && docker build -t netviz .
```

Alternatively serve `application/client/dist/` from any static host (Caddy, a CDN, …) and point it at the backend.

> **Production note:** the SPA talks to the backend at `/api` (and `/auth` for sign-in), and the backend serves the SPA from `<cwd>/client/dist`, so a single origin works out of the box. The backend's CORS allowlist accepts `localhost` / `127.0.0.1` — set `CORS_ORIGINS` (comma-separated) for your production domain(s). All configuration is environment-driven (see `application/.env.example`).

For a full production deployment (Azure Container Apps, managed MongoDB, custom domains, CD on release) follow the [deployment runbook](deploy/README.md).

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
npm run lint          # ESLint
npm run typecheck     # tsc (no emit)
npm run build         # compile
npm test              # Mocha + c8 — unit + integration, fails under 90% line coverage
npm run test-ci       # same, with cobertura + JUnit reports (for CI)
```

> The backend test suite (Mocha + Supertest + c8) covers every API route plus the
> services and libs directly — **77 tests, ≥90% line coverage** (enforced by `.c8rc.json`).
> It uses an in-memory MongoDB by default, or `MONGODB_CONNECTION_STRING` if reachable.
> HTML coverage is written to `application/coverage/`.

## CI/CD — GitHub Actions

The pipeline is split into atomic workflows, each runnable on its own:

| Workflow | Trigger | What it does |
| --- | --- | --- |
| [`lint.yml`](.github/workflows/lint.yml) | push / PR | ESLint for server and client |
| [`ci.yml`](.github/workflows/ci.yml) | push / PR / release | Type-check + build + backend tests (in-memory MongoDB, **≥90% coverage gate**); posts a **coverage-report comment** on PRs, uploads the `client-dist` artifact, and uploads coverage to Codecov. Reusable — the release pipeline runs it as its test stage |
| [`pr-preview.yml`](.github/workflows/pr-preview.yml) | PR to `main` (opened/updated/closed) | Builds the PR image and copies it onto a new **zero-traffic revision of the production app**, with its own public URL and its own throwaway database — then comments the link. Deactivates it when the PR closes. Opt-in (repo variable `PREVIEW_ENABLED=true`); skipped for fork PRs |
| [`package.yml`](.github/workflows/package.yml) | release / PR preview / manual | Builds the client + Docker image, pushes it to ACR |
| [`deploy.yml`](.github/workflows/deploy.yml) | release (via `release.yml`) or manual | Copies a new revision from the live production revision, waits for it to be healthy, then shifts 100% of traffic to it — also your rollback tool |
| [`release.yml`](.github/workflows/release.yml) | GitHub Release published | Staged pipeline: **test -> package -> deploy production (gated)** — see [deploy/](deploy/README.md) |

### Pull-request lifecycle

`main` is protected: a change reaches it only through a reviewed PR that passes checks. A preview is a **zero-traffic revision of the production app**, on its own throwaway database — so a PR gets a real, public, reviewable URL without touching production data or live users, and without a second app to pay for.

```text
open PR -> test + coverage comment -> isolated preview (public URL comment) -> review -> merge -> preview destroyed
```

- **Tests / coverage** — `ci.yml` and `lint.yml` run on every PR; the four checks (`Server (build + test)`, `Client (build)`, `Server (ESLint)`, `Client (ESLint)`) are **required** and must be green before merge. `ci.yml` also posts the coverage report as a sticky comment.
- **Preview** — once opted in, `pr-preview.yml` copies the production revision onto a new revision of the **same app** with the PR's image, at its own URL (`https://netviz--pr-<N>-<sha>…azurecontainerapps.io`) and comments it. It carries **0% of the traffic** (the workflow never touches the traffic split) and overrides `MONGODB_DB_NAME` so it runs on its own database in the production cluster — isolated data, nothing extra to provision. The revision is deactivated automatically when the PR is merged or closed.
- **Review + merge** — the branch rule requires **1 approving review** and resolved conversations; direct pushes to `main` are blocked. Admins can still merge their own PRs (so a solo maintainer isn't locked out).

### Release -> production

Only a published release ships to production. One image is tested, built, then promoted behind a manual gate:

```text
Release v1.2.3 -> test -> package -> [approval] -> deploy: netviz (100% traffic)
```

Production is gated by the `production` environment's **required-reviewers** rule, so a maintainer approves the promotion. `deploy.yml` then copies a new revision of `netviz` from the one currently live, **waits for it to report healthy, and only then shifts the traffic** — a revision that fails to boot never gets users, and the revision it replaced stays active for a one-command rollback. All jobs run on Node 22 with npm caching, least-privilege tokens, and concurrency cancellation of superseded runs. The coverage badge at the top of this README is served by Codecov, which CI uploads the lcov report to on every build.

## Configuration

All backend configuration is read from the environment in `application/src/config/index.ts` (documented in [`application/.env.example`](application/.env.example)); the frontend reads `VITE_*` vars in `application/client/src/config/index.ts` (see [`application/client/.env.example`](application/client/.env.example)).

| Variable                                            | Where    | Default                            | Purpose                                             |
| --------------------------------------------------- | -------- | ---------------------------------- | --------------------------------------------------- |
| `HOST` / `PORT`                                     | backend  | `0.0.0.0` / `8080`                 | Bind address and port                               |
| `NODE_ENV`                                          | backend  | `development`                      | Enables production config validation                |
| `MONGODB_CONNECTION_STRING`                         | backend  | `mongodb://localhost:27017/netviz` | MongoDB connection string                           |
| `MONGODB_DB_NAME`                                   | backend  | — (db from the string)             | Override the database (PR previews get their own)   |
| `DB_RECREATE`                                       | backend  | `false`                            | Drop & re-seed the database on startup              |
| `CORS_ORIGINS`                                      | backend  | `localhost` / `127.0.0.1`          | Comma-separated CORS allow-list                     |
| `JSON_BODY_LIMIT`                                   | backend  | `8mb`                              | Max JSON request body                               |
| `JWT_SECRET` / `JWT_TTL`                            | backend  | — / `7d`                           | Session signing secret (required in prod) and TTL   |
| `ALLOW_DEV_LOGIN`                                   | backend  | `true` outside prod                | Password-less local login                           |
| `REQUIRE_AUTH`                                      | backend  | `false`                            | Disable the anonymous shared workspace              |
| `AUDIT_RETENTION_DAYS`                              | backend  | `90`                               | Audit-log TTL                                       |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`         | backend  | —                                  | Enable Google sign-in                               |
| `MICROSOFT_CLIENT_ID` / `..._SECRET` / `..._TENANT` | backend  | — / — / `common`                   | Enable Microsoft sign-in                            |
| `VITE_APP_*`                                        | frontend | see `.env.example`                 | App metadata shown in the footer (OCI-style fields) |

> **OAuth redirect URIs** are derived from the URL the app is served at — no base-URL
> env var is needed. Register `<your public URL>/auth/<provider>/callback` with each provider.

## Documentation

| Document                                                     | What it covers                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| [docs/api.md](docs/api.md)                                   | Full HTTP API reference (`/api/*` resources and `/auth/*` endpoints) |
| [docs/use-cases/](docs/use-cases/README.md)                  | Use-case diagrams & descriptions (actors, flows, UML) + requirements |
| [application/README.md](application/README.md)               | Backend package: layout, scripts, configuration                      |
| [application/client/README.md](application/client/README.md) | Frontend package: layout, scripts, dev proxy                         |
| [deploy/README.md](deploy/README.md)                         | Production deployment (Azure Container Apps runbook, CD)             |
| [organizational/README.md](organizational/README.md)         | Identity, roles & permissions, admin guide, account lifecycle        |
| [SECURITY.md](SECURITY.md)                                   | Security model and how to report a vulnerability                     |
| [CONTRIBUTING.md](CONTRIBUTING.md)                           | Development workflow, quality gates, PR conventions                  |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)                     | Community standards for participating in this project                |
| [CHANGELOG.md](CHANGELOG.md)                                 | Notable changes per release                                          |

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for a full,
screenshot-by-screenshot walkthrough of forking, branching, and opening a pull
request, plus the development workflow, quality gates, and PR conventions. Bug
reports and feature requests use the [issue templates](.github/ISSUE_TEMPLATE),
and general questions belong in
[Discussions](https://github.com/Wolfi-OwO/network-visualizer/discussions).
Everyone participating is expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Found a vulnerability? Please follow the [security policy](SECURITY.md) — do not open
a public issue.

## License

Released under the **MIT License** — see [LICENSE](./LICENSE).
