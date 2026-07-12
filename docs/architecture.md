# Architecture

How NetViz fits together — the shape of the system, what each layer is allowed to
do, and how a request travels from a click in the browser to a document in
MongoDB and back.

For *why* the big choices were made, see the [decision records](adr/README.md).
For the endpoint-by-endpoint contract, see the [API reference](api.md).

---

## The big picture

NetViz ships as **one Docker image on one origin**. The Express backend serves
both the JSON API and the compiled React SPA as static files, so there is no
cross-origin problem to solve, no second image to build, and no CORS config to
get wrong in production.

```text
                        ┌──────────────────────────────────────┐
   Browser              │  Azure Container App  (one image)    │
  ┌──────────┐          │                                      │
  │  React   │  /api    │   ┌────────────────────────────┐     │
  │   SPA    │─────────▶│   │  Express                   │     │
  │          │  /auth   │   │   routes → handlers →      │     │        ┌─────────┐
  │ (served  │◀─────────│   │   services → db            │─────┼───────▶│ MongoDB │
  │  by the  │          │   └────────────────────────────┘     │        └─────────┘
  │  backend)│   SSE    │   ┌────────────────────────────┐     │
  │          │◀─────────│   │  packet-simulator (in-mem) │     │        ┌──────────────┐
  └──────────┘          │   └────────────────────────────┘     │◀──────▶│ Google /     │
                        │        static: client/dist           │  OAuth │ Microsoft    │
                        └──────────────────────────────────────┘        └──────────────┘
```

Two independent npm packages live in the repo:

| Package | Path | Builds to |
| --- | --- | --- |
| Backend | `application/` | `application/dist/` (compiled TS) |
| Frontend | `application/client/` | `application/client/dist/` (static bundle) |

The image bakes the frontend bundle into the backend image
(`COPY client/dist ./client/dist`) and Express serves it with SPA fallback. The
frontend has **no image of its own**.

---

## Backend layers

The server is a strict one-way dependency chain. A layer may only call the layer
below it — this is the rule that keeps the codebase navigable, and PRs that
violate it get sent back.

```text
routes/        express.Router per resource. URL shapes, verbs, middleware wiring.
   │           No business logic. No database access.
   ▼
handlers/      Request handlers (controllers). Parse and validate input, call a
   │           service, choose the status code, attach HATEOAS _links.
   ▼           No business logic of their own. No direct Mongoose calls.
services/      All the actual thinking: packet simulation, packet routing, CIDR
   │           math, auth, metrics, validation. Pure-ish, unit-testable, knows
   ▼           nothing about HTTP — no `req`, no `res`.
db/            Mongoose models and network-service (the repository). The ONLY
               layer that talks to MongoDB.
```

Cross-cutting concerns sit beside the chain rather than inside it:

- **`middlewares/`** — `auth` (session cookie → `req.user`, plus role guards),
  `audit` (records mutating actions), `rate-limit`, `request-logger`,
  `error-handler`.
- **`lib/`** — `logger`, `errors` (HTTP error classes), `hateoas` (link builders),
  `health-checks`, `jwt`, `ip`.
- **`config/`** — the *only* place `process.env` is read. Everything else imports
  the typed `config` object. Production refuses to start if a required secret is
  missing or too short.
- **`types/`** — shared domain types (`packet`, `network`, `cidr`).

### Request lifecycle

`app.ts` assembles the middleware stack in this order, and the order is
load-bearing:

1. **`trust proxy: 1`** — trust exactly one reverse-proxy hop, so `req.secure`
   reflects the original HTTPS request (which controls the cookie `Secure` flag)
   without trusting `X-Forwarded-For` far enough that a client could spoof its IP
   past the rate limiter.
2. **`helmet`** — security headers.
3. **static `client/dist`** — the SPA.
4. **`cors`** — allow-list from config; `credentials: true` so the session cookie
   flows.
5. **`express.json`** — body parsing, with a raised limit because topologies are
   large.
6. **`cookieParser` → `authenticate`** — verifies the signed JWT session cookie
   and populates `req.user`. Never rejects on its own; guards do that.
7. **`requestLogger`, `audit`** — observability and the audit trail.
8. **rate limiters** — a stricter one on `/auth`, a general one on `/api`.
9. **routers** — `/api/*` resources and `/auth/*`.
10. **`notFound` → `errorHandler`** — every thrown `HttpError` becomes a
    consistent JSON error body here. Handlers throw; they don't format errors.

### The API is hypermedia (RMM level 3)

`GET /api` is the entry point and every representation carries `_links`. Clients
are meant to *follow* links rather than string-concatenate URLs. `lib/hateoas.ts`
is the single place link shapes are defined, so a URL change is a one-file change.

Liveness and readiness are separate — `/api/live` and `/api/ready` (via
`@godaddy/terminus`), which is what lets `deploy.yml` wait for a new revision to
be genuinely healthy before shifting traffic to it.

---

## The simulation engine

This is the interesting part, and it is deliberately **in-memory and
stateless-per-request**. Nothing about a simulated packet is persisted; only the
*topology* is.

Two distinct things are often confused:

| | `packet-simulator.ts` | `packet-sender-service.ts` |
| --- | --- | --- |
| Answers | "what does live traffic look like?" | "where would *this one packet* go?" |
| Drives | the Wireshark-style capture feed + the ambient animation | the hop-by-hop trace in the Network Builder |
| Output | a stream of synthetic packets over **SSE** | a single deterministic path + verdict |
| Realism | 16+ protocols generated with plausible timing and framing | full forwarding decision per hop |

The **sender** is what makes NetViz a simulator rather than a diagram tool. For
each hop it evaluates, in order:

1. **Is the device powered on?** (Powering a device on triggers a DHCP DORA
   exchange and it acquires an address.)
2. **Routing** — longest-prefix match against the device's routes.
3. **VLAN / subnet segmentation** — is this traffic even allowed to cross?
4. **Firewall ACLs** — ingress and egress rules, with an implicit deny at the end.
5. **NAT** — translation at the Internet edge.
6. **TTL** — decrement, and drop at zero.

Every drop carries a *reason*, which is what the UI surfaces. That is the whole
pedagogical point of the tool: not "the packet didn't arrive", but "the packet was
denied by an egress ACL on fw-1".

Live traffic reaches the browser over **Server-Sent Events**, not WebSockets — the
stream is strictly one-way (server → client), and SSE gives automatic reconnection
and plain-HTTP proxy compatibility for free. See
[ADR 0003](adr/0003-server-sent-events-for-live-packets.md).

---

## Data model

Four Mongoose models, all in `db/models/`:

| Model | Holds | Notes |
| --- | --- | --- |
| `topology` | The network: nodes, edges, per-device config | Scoped to an owner. The only large document. |
| `topology-version` | Point-in-time snapshots of a topology | Powers undo/restore. Auto-snapshots before a restore. |
| `user` | Identity, role, OAuth subject | First account to sign in becomes `admin`. |
| `audit` | Mutating actions by signed-in users | **TTL-expired** (`AUDIT_RETENTION_DAYS`, default 90) — MongoDB deletes old entries itself. |

Topologies are **owner-scoped**: `network-service` takes an `ownerId` on every
read and write, so one user's workspace is invisible to another. When
`REQUIRE_AUTH=false` (the default), there is additionally a shared anonymous
workspace.

---

## Authentication and authorization

- **Sign-in** is an OAuth 2.0 browser redirect flow (Google or Microsoft), with a
  CSRF-protected `state` parameter. It lives under `/auth`, *not* `/api`, because
  a redirect flow is not a REST resource.
- **Sessions** are signed JWTs in an `httpOnly` cookie — no server-side session
  store, which is what lets the app scale to multiple Container App revisions
  without sticky sessions or shared state.
- **`ALLOW_DEV_LOGIN`** enables a password-less local login. It defaults to `true`
  outside production and production *refuses to start* with it on.
- **Roles** are `admin` / `editor` / `viewer`, enforced by the `requireWrite` /
  `requireAuth` guards in `middlewares/auth.ts`. The first account to sign in is
  promoted to `admin`.

OAuth redirect URIs are derived from the URL the app is actually served at, so
there is no base-URL environment variable to keep in sync across environments.

---

## Frontend

React 19 + TypeScript + Vite, one folder per page under `src/pages/`
(`dashboard/`, `network/`, `packets/`, `cidr/`, `admin/`, `auth/`, `error/`).

- **`lib/api/`** — one axios module per backend resource. Components never call
  axios directly; this is the frontend's equivalent of the `db/` layer.
- **Canvas** — React Flow (`@xyflow/react`) drives the topology editor.
- **State** — deliberately no Redux/Zustand. Server data is fetched per page;
  editor state lives in `context/` with undo/redo and autosave to local storage.
- **`config/index.ts`** — the only place `import.meta.env` is read. The `VITE_APP_*`
  fields mirror the OCI image annotations and are injected at build time by
  `package.yml` from the git tag, so the footer always shows the version that was
  actually shipped.

In development, Vite proxies `/api` and `/auth` to `localhost:8080`, which
reproduces the single-origin production setup exactly — the SPA never knows
whether it is being served by Vite or by Express.

## Conventions that are enforced, not suggested

- **Lowercase kebab-case filenames**, and every import carries its explicit
  extension (`./foo.js`). This is what makes the project build identically on
  case-sensitive Linux filesystems and under `NodeNext` resolution. It is not a
  style preference; getting it wrong breaks the Docker build and not your laptop.
- **`process.env` is read in exactly one file** per package.
- **New endpoints need**: a route, a handler, HATEOAS `_links`, and tests.
- **≥90% line coverage** on the backend, enforced by `.c8rc.json` and CI.
