# 0001. The backend serves the SPA — one image, one origin

- **Status:** Accepted
- **Date:** 2026-07-11 (recorded retroactively; the decision predates this ADR)

## Context

NetViz is two npm packages: an Express API and a React SPA. They have to reach
users somehow. The conventional split is to deploy the SPA to a static host or CDN
and the API somewhere else, then wire them together.

That split immediately buys three problems: a cross-origin setup (CORS
preflights, and `SameSite`/`Secure` cookie rules that behave differently across
browsers), a second thing to build and pay for, and a base-URL configuration value
that must be kept in sync in every environment — the classic "works in staging,
broken in prod" footgun.

This is also a project a single maintainer runs, and that a contributor should be
able to bring up locally in two commands.

## Options considered

- **Separate static host + API host.** The default in most tutorials. Best CDN
  story, and lets the frontend scale independently. Costs a second deployment
  target, a real CORS configuration, cross-site cookie handling, and a base-URL
  env var per environment.
- **Two containers behind one reverse proxy.** Keeps a single origin and preserves
  independent deploys, but adds a proxy to configure and a second image to build,
  version and roll back — and now the two can be at different versions, which is
  its own class of bug.
- **One image: Express serves the built SPA as static files.** One artifact, one
  origin.

## Decision

The Docker image bakes the built client bundle in (`COPY client/dist ./client/dist`)
and Express serves it as static files with SPA fallback, alongside `/api` and
`/auth` on the same origin. The frontend has **no image of its own**; CI builds it
and passes it to the backend image build as the `client-dist` artifact.

In development, Vite proxies `/api` and `/auth` to `localhost:8080`, so the SPA
cannot tell whether Vite or Express is serving it. Dev and prod have the same
topology.

## Consequences

**Bought:** No CORS problem in production (the allow-list exists only for local
dev). Session cookies are same-site by construction. One version number, one image,
one tag, one rollback. OAuth redirect URIs derive from the URL the app is served
at, so there is no base-URL env var to drift. `docker compose up` gets a
contributor a working stack.

**Cost:** The frontend cannot be deployed independently of the backend — a
CSS-only change goes through the full image build and release. There is no CDN in
front of the static assets, so first-load latency is whatever the Container App
serves at. Scaling is coupled: scaling the API scales the static file server too,
which is wasteful but, at this traffic, free.

**Revisit if:** static-asset latency becomes a real user complaint, or the
frontend release cadence genuinely diverges from the backend's. The fix then is a
CDN in front of the same origin, not a second deployment target.
