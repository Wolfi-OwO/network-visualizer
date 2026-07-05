# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project aims to adhere to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Breaking:** authentication endpoints moved from `/api/auth/*` to `/auth/*`.
  Re-register your OAuth redirect URIs with each provider as
  `<public URL>/auth/{google|microsoft}/callback`.
- OAuth redirect URIs and post-login redirects are now derived from the
  incoming request instead of a statically configured base URL.
- Refreshed the client UI with a frosted-glass visual language: an ambient
  aurora backdrop, translucent panels, glowing accents and smooth entrance /
  hover / focus transitions (reduced-motion respected).
- Release pipeline is now staged: a published GitHub Release runs
  **test → package → deploy staging → deploy production**, with production gated
  behind the environment's required-reviewers approval. `deploy.yml` takes an
  `environment` input (`staging` / `production`); `ci.yml` is reusable as the
  release test stage.

### Fixed

- Corrected README instructions: `docker-compose.yml` lives in `application/`,
  so Compose is run from there (not the repo root).
- Aligned Markdown tables and cleaned up documentation so the whole repo passes
  `markdownlint` under the new `.markdownlint.json` ruleset.

### Added

- Production documentation set: security policy, contributing guide, API
  reference, issue/PR templates, and this changelog.
- High-resolution UI screenshots under `docs/screenshots/` (dashboard, network
  builder, packet capture, CIDR, login).
- Use-case documentation under `docs/use-cases/`: use-case diagrams and
  descriptions (actors, flows, UML) plus a requirements catalog.
- `.markdownlint.json` defining the repo's Markdown ruleset.
