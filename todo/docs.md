# Documentation gaps

Docs that are missing, thin, or at risk of going stale. Stale docs are worse than
absent ones — they get believed.

---

## Missing

- [ ] **OpenAPI / Swagger spec.** [`docs/api.md`](../docs/api.md) is hand-written,
      which means it drifts from the routes the moment someone forgets. Generating an
      OpenAPI document from the route definitions (and serving it at `/api/openapi.json`)
      would make the API self-describing and give the hand-written prose something to
      be checked against.
      *Effort:* M

- [ ] **A "how the simulator actually decides" deep-dive.**
      [`docs/architecture.md`](../docs/architecture.md) sketches the forwarding
      pipeline (power → routing → VLAN → ACL → NAT → TTL), but the packet engine is
      the most interesting code in the repo and deserves a document of its own, with
      worked examples of each drop reason.
      *Effort:* M

- [ ] **Screenshots for the admin console and use cases.** `docs/screenshots/page/`
      covers the dashboard, builder, capture, CIDR and login — but not the admin
      console or the audit log, which are the parts an evaluator most wants to see.
      *Effort:* S · **good first issue**

- [ ] **A runnable local OAuth setup guide.** Configuring a Google or Microsoft app
      for `localhost` is the most annoying part of first-time setup, and
      [troubleshooting.md](../docs/troubleshooting.md) only tells you what breaks. A
      step-by-step with screenshots would remove a real barrier.
      *Effort:* S

## Stale or thin

- [ ] **`docs/use-cases/` is written in German** while the rest of the docs are in
      English (`uc-benutzerrollen-verwalten.md`, `uc-paket-senden.md`, …). Fine if
      that's intentional for an academic submission — but it should say so, or be
      translated. Right now an English-speaking contributor just hits a wall.
      *Effort:* M

- [ ] **`docs/api.md` predates several endpoints.** Worth an audit against
      `application/src/routes/` — `audit`, `metrics` and the topology-version routes
      are the likely omissions. Best fixed by the OpenAPI item above rather than by
      hand.
      *Effort:* S

## Keeping them honest

- [ ] **Link-check the docs in CI.** This repo already shipped a broken link:
      `deploy/` moved to `organizational/deploy/` and the README pointed at the old
      path in three places for several releases. A `lychee` or `markdown-link-check`
      job on PRs makes that class of rot impossible.
      *Effort:* S · **good first issue**

- [ ] **Lint the markdown.** `markdownlint` for consistent heading levels, list style
      and line length across ~25 markdown files that currently drift.
      *Effort:* S · **good first issue**
