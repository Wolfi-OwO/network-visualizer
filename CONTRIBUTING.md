# Contributing to NetViz

Thanks for taking the time to contribute. This document covers the development
workflow and the quality bar for pull requests.

## Getting set up

Prerequisites: Node.js >= 20, npm, and a local MongoDB
(`docker compose up mongo` works). Then:

```bash
cd application         && npm install     # backend
cd application/client  && npm install     # frontend
```

Run both dev servers (backend on :8080, frontend on :5173) as described in the
[root README](ReadMe.md#run-in-development).

## Project conventions

- **Two independent npm packages**: `application/` (backend) and
  `application/client/` (frontend). Run scripts inside the package you change.
- **Filenames** are lowercase kebab-case; imports carry explicit extensions
  (`./foo.ts`) so the project builds on case-sensitive filesystems.
- **Layers**: routes → handlers → services → db on the server; pages /
  components / layouts / lib on the client. New endpoints get a route file, a
  handler, HATEOAS `_links`, and tests.
- **Configuration** goes through `src/config/index.ts` — never read
  `process.env` elsewhere. Document new variables in `.env.example`.
- **Commit messages** follow the conventional style used in the history:
  `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `test: …`.

## Quality gates

Everything below is enforced in CI ([`lint.yml`](.github/workflows/lint.yml) +
[`ci.yml`](.github/workflows/ci.yml)) and
must pass locally before you open a PR:

```bash
# Backend (application/)
npm run lint
npm run build          # type-check + compile
npm test               # Mocha + c8, fails under 90% line coverage

# Frontend (application/client/)
npm run lint
npm run build          # tsc -b + vite build
```

New backend behavior needs tests (`application/tests/`, Mocha + Supertest
against an in-memory MongoDB). Keep the coverage gate green — if your change
drops line coverage below 90%, add tests rather than lowering the bar.

## Pull requests

1. Fork and create a feature branch from `main`.
2. Keep the change focused; unrelated refactors go in separate PRs.
3. Update documentation that your change makes stale (READMEs,
   [docs/api.md](docs/api.md), `.env.example`, [CHANGELOG.md](CHANGELOG.md)).
4. Fill in the PR template; link related issues.
5. CI must be green before review.

## Reporting bugs & requesting features

Use the [issue templates](.github/ISSUE_TEMPLATE). For security problems,
follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
