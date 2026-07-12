# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

> **This file is generated.** Since v2.3.0, entries are written by
> [release-please](https://github.com/googleapis/release-please) from the
> Conventional Commit messages on `main` — do not add an `Unreleased` section or
> edit released entries by hand. To change what appears here, write a better commit
> message (or PR title, since merges are squashed). See
> [docs/releasing.md](docs/releasing.md).

## [2.4.1](https://github.com/Wolfi-OwO/network-visualizer/compare/v2.4.0...v2.4.1) (2026-07-12)


### CI/CD

* restore .github workflows and templates ([#7](https://github.com/Wolfi-OwO/network-visualizer/issues/7)) ([64051a4](https://github.com/Wolfi-OwO/network-visualizer/commit/64051a44f9335510217a5bb92bd83570f0f9368e))

## [2.4.0](https://github.com/Wolfi-OwO/network-visualizer/compare/v2.3.0...v2.4.0) (2026-07-12)


### Added

* automate releases with release-please and fix version drift ([#5](https://github.com/Wolfi-OwO/network-visualizer/issues/5)) ([b1291c9](https://github.com/Wolfi-OwO/network-visualizer/commit/b1291c929ab1681b4243bfe4dbfea5de0dd0d773))

## [2.3.0] - 2026-07-11

### Changed

- **Continuous delivery now runs on a single Container App.** `netviz` is in
  multiple-revision mode; production and every PR preview are revisions of that
  one app. No second app, no extra infrastructure to pay for or provision.
- **Production releases are health-gated.** `deploy.yml` copies a new revision
  from the revision currently serving production, waits for it to report healthy,
  and only then shifts 100% of the traffic to it — a revision that fails to boot
  never receives users. The revision it replaces is kept active, so a rollback is
  a single `az containerapp ingress traffic set`. `deploy.yml` still doubles as
  the rollback tool (dispatch it with an older tag).
- **Per-PR previews are zero-traffic revisions of the production app.** Each PR
  gets its own public revision URL and its **own throwaway database** — the
  preview reuses production's Mongo secret but overrides `MONGODB_DB_NAME`, so it
  lands on a separate database in the same cluster and cannot see or change
  production data. `pr-preview.yml` never touches the ingress traffic split, so a
  preview cannot take production traffic. Revisions are deactivated when the PR is
  merged or closed.
- Both workflows copy from *the revision serving 100% of traffic*, never from
  `latest` — otherwise a preview's env overrides would be inherited by the next
  production release and point production at a throwaway PR database.
- `deploy.yml` sets `MONGODB_CONNECTION_STRING` explicitly, fixing production
  drift left when the app was renamed off the old `MONGO_URI` variable.
- Release workflow permissions widened to `contents: write` + `id-token: write`
  so the gated production deploy can mint its OIDC token.

### Added

- `MONGODB_DB_NAME` — optional override for the database named in the connection
  string. Lets a deployment share a Mongo cluster (and its connection secret)
  while keeping its own data; this is what makes per-PR preview databases
  possible without a second cluster or a second secret.
- `pr-preview.yml` — opt-in per-PR preview (repo variable `PREVIEW_ENABLED`) that
  builds the PR image, copies it onto a zero-traffic revision of the production
  app, comments the live URL, and tears it down on close.
- `ci.yml` posts a **coverage-report comment** on every pull request (sticky,
  updated in place on each push).

### Fixed

- `dropCurrentDatabase()` now honours `MONGODB_DB_NAME`. Without this,
  `DB_RECREATE=true` on a preview would have dropped **production's** database,
  since the preview shares production's connection string.
- The Mongo connection string (credentials included) is no longer written to the
  application log on startup.

### Removed

- `pr-staging.yml`, the dedicated staging Container App, and the `netviz-preview`
  app with its `mongo:7` sidecar — all replaced by preview revisions on the
  production app. The `PREVIEW_CONTAINERAPP_NAME` repo variable is no longer used.

## [2.2.0] - 2026-07-05

### Added

- **Use-case documentation** under `docs/use-cases/`: use-case diagrams and
  descriptions (actors, flows, UML) plus a requirements catalog.
- **High-resolution UI screenshots** under `docs/screenshots/page/` (dashboard,
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
  **test -> package -> deploy staging -> deploy production**, with production gated
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

[2.3.0]: https://github.com/Wolfi-OwO/network-visualizer/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/Wolfi-OwO/network-visualizer/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/Wolfi-OwO/network-visualizer/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/Wolfi-OwO/network-visualizer/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/Wolfi-OwO/network-visualizer/compare/v1.2.1...v2.0.0
[1.2.1]: https://github.com/Wolfi-OwO/network-visualizer/compare/v1.1.0...v1.2.1
[1.1.0]: https://github.com/Wolfi-OwO/network-visualizer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Wolfi-OwO/network-visualizer/releases/tag/v1.0.0
