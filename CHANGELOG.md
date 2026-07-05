# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project aims to adhere to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Continuous delivery reworked around a single Container App.** The app now
  runs in **multiple-revision mode**: releases create a new revision and shift
  **100% of traffic** onto it (`deploy.yml`), while the separate staging app is
  gone. `deploy.yml` doubles as the rollback tool (dispatch it with an older tag).
- **Per-PR previews now deploy to a 0%-traffic revision** on that same app
  instead of a dedicated staging environment — each PR gets its own public URL,
  off the load balancer, and the revision is deactivated automatically when the
  PR is merged or closed.
- Release workflow permissions widened to `contents: write` + `id-token: write`
  so the gated production deploy can mint its OIDC token.

### Added

- `pr-preview.yml` — opt-in per-PR preview (repo variable `PREVIEW_ENABLED`) that
  builds the PR image, spins up a 0%-traffic revision on the shared app, comments
  the live URL, and tears it down on close.
- `ci.yml` posts a **coverage-report comment** on every pull request (sticky,
  updated in place on each push).

### Removed

- `pr-staging.yml` and the dedicated staging Container App — replaced by the
  0%-traffic preview revisions in `pr-preview.yml`.

## [2.2.0] - 2026-07-05

### Added

- **Use-case documentation** under `docs/use-cases/`: use-case diagrams and
  descriptions (actors, flows, UML) plus a requirements catalog.
- **High-resolution UI screenshots** under `docs/screenshots/` (dashboard,
  network builder, packet capture, CIDR calculator, login).
- Opt-in **per-PR staging preview** (`pr-staging.yml`, repo variable
  `STAGING_ENABLED`); `package.yml` gained a `push_latest` input so preview
  builds don't move the `:latest` tag.
- `.markdownlint.json` defining the repo's Markdown ruleset.

### Changed

- **Frosted-glass UI refresh:** an ambient aurora backdrop, translucent panels,
  glowing accents and smooth entrance / hover / focus transitions across the
  layouts, toasts and every page (reduced-motion respected).
- **Staged delivery:** a published GitHub Release runs
  **test → package → deploy staging → deploy production**, with production gated
  behind the environment's required-reviewers approval.

### Fixed

- Corrected README instructions: `docker-compose.yml` lives in `application/`,
  so Compose is run from there (not the repo root).
- Aligned Markdown tables and cleaned up documentation so the whole repo passes
  `markdownlint` under the new ruleset.

## [2.1.0] - 2026-07-04

### Added

- Composable, individually-runnable GitHub Actions workflows: `lint.yml`,
  `package.yml`, `deploy.yml` (with an `environment` input) and `release.yml`.
- `docker-compose.yml` bringing up MongoDB + the backend for local development.
- A reusable `select-menu` component and assorted UI building blocks.

### Changed

- **Renamed the project to *network-visualizer*** — repository URLs updated
  across configuration and docs.
- Development scripts switched to **`tsx`**, with `ts-node` ESM loader
  registration for the demo-data seeder.
- Standardized the `MONGODB_CONNECTION_STRING` environment variable across the
  backend, Compose and CI.
- Broad UI polish across the dashboard, packet-capture, network-builder, status,
  login and admin pages.

### Removed

- The monolithic `release-aca.yml` workflow (superseded by the split pipeline).
- The standalone `app.css`; styles consolidated into the Tailwind/`index.css`
  layer.

## [2.0.1] - 2026-07-02

### Changed

- **Multi-stage Dockerfile** with a container `HEALTHCHECK` and cleaner
  build/runtime environment configuration.
- Release workflow now pulls the image with the ACR admin credentials
  (documented ACR credential management).

### Fixed

- Network-builder interactions: silent (background) node-config updates,
  dynamic handle IDs so connections attach from any side, floating edge anchors
  for packet edges, a more realistic guided-build layout, and clearer tutorial
  steps.

## [2.0.0] - 2026-07-01

### Changed

- **Breaking:** authentication endpoints moved from `/api/auth/*` to `/auth/*`
  (sign-in is a browser redirect flow, not an API resource). Re-register your
  OAuth redirect URIs with each provider as
  `<public URL>/auth/{google|microsoft}/callback`.
- OAuth redirect URIs and post-login redirects are now derived from the incoming
  request instead of a statically configured base URL.

### Added

- Production documentation set: security policy (`SECURITY.md`), contributing
  guide (`CONTRIBUTING.md`), full API reference (`docs/api.md`), GitHub
  issue/PR templates, and this changelog.

## [1.2.1] - 2026-07-01

### Changed

- Reworked the footer version-display logic and refactored the client app
  configuration (build-time `VITE_APP_*` metadata wiring via `vite.config.ts`).

## [1.1.0] - 2026-07-01

### Added

- App version / build metadata shown in the footer, driven by environment
  configuration.

## [1.0.0] - 2026-07-01

Initial release of **NetViz — Network Visualizer & Simulator**: design,
visualize and *simulate* enterprise networks in the browser.

### Added

- **Network Builder** — a drag-and-drop React Flow canvas with 25+ device types
  (routers, L2/L3 switches, firewalls, IDS/IPS, VPN gateways, load balancers,
  servers, endpoints, Internet/ISP…), configurable links, and per-device power
  that drives **DHCP (DORA)** addressing. Live concurrent packet simulation with
  a hop-by-hop **send-a-packet trace** enforcing longest-prefix routing, firewall
  ACLs, NAT, TTL, VLAN isolation and subnet segmentation. Undo/redo, autosave and
  a guided build tutorial.
- **Packet Capture (Wireshark-style)** — a live packet stream over Server-Sent
  Events with a protocol tree, hex dump and statistics, generating 16+ protocols
  with per-protocol on/off toggles.
- **CIDR Calculator** — subnet / network / broadcast / host math, binary view,
  subnet splitter and route summarization with strict input validation.
- **Design-validation engine** for network topologies (VLANs, security zones).
- **Accounts, roles & administration** — OAuth 2.0 sign-in (Google / Microsoft)
  with CSRF-protected state and a password-less dev login; signed-JWT session
  cookies; role-based access control (`admin`/`editor`/`viewer`) with per-user
  isolated workspaces; an admin console with an audit log and system metrics; and
  a public **status page** backed by a health-sampling service.
- **RESTful HTTP API** (Richardson Maturity Model level 3) with HATEOAS `_links`,
  a `GET /api` hypermedia entry point, and liveness/readiness probes.
- **Single-image deployment** — the Express backend serves the built SPA; a
  Docker image with OCI metadata, an initial CI workflow, ESLint, and a
  Mocha + Supertest + c8 test suite running against an in-memory MongoDB.

[Unreleased]: https://github.com/Wolfi-OwO/network-visualizer/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/Wolfi-OwO/network-visualizer/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/Wolfi-OwO/network-visualizer/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/Wolfi-OwO/network-visualizer/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/Wolfi-OwO/network-visualizer/compare/v1.2.1...v2.0.0
[1.2.1]: https://github.com/Wolfi-OwO/network-visualizer/compare/v1.1.0...v1.2.1
[1.1.0]: https://github.com/Wolfi-OwO/network-visualizer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Wolfi-OwO/network-visualizer/releases/tag/v1.0.0
