# Contributing to NetViz

Thanks for taking the time to contribute. This document walks a first-time
contributor through the entire GitHub workflow — forking, branching, making a
change, and opening a pull request — with real screenshots for every step, and
then covers the project's conventions and quality bar for anyone already
comfortable with Git.

Everyone participating in this project is expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

New to Git or GitHub? Start with
[Your first contribution, step by step](#your-first-contribution-step-by-step).
Already know the drill? Jump to
[Getting set up](#getting-set-up).

## Contents

- [Your first contribution, step by step](#your-first-contribution-step-by-step)
- [Getting set up](#getting-set-up)
- [Project conventions](#project-conventions)
- [Quality gates](#quality-gates)
- [Pull requests](#pull-requests)
- [Reporting bugs & requesting features](#reporting-bugs--requesting-features)

## Your first contribution, step by step

This section walks through **one complete contribution**, end to end, using
the actual [NetViz repository](https://github.com/Wolfi-OwO/network-visualizer)
on GitHub. Every screenshot below is taken from the real project.

### 1. Fork the repository

You don't have write access to `Wolfi-OwO/network-visualizer` directly, so the
first step is to make your own copy — a **fork** — under your GitHub account.
Open the repository and click **Fork** in the top-right corner.

![The NetViz repository page with the Fork button highlighted in the top-right corner](docs/screenshots/contributing/01-fork-repo.png)

GitHub will ask you to sign in if you aren't already, then show a "Create a
new fork" screen. Leave the defaults (you can keep the same repository name)
and click **Create fork**. A few seconds later you'll land on
`github.com/<your-username>/network-visualizer` — a full copy of the project
that you own and can push to freely.

### 2. Clone your fork to your machine

On **your fork**, click the green **Code** button and copy the HTTPS URL.

![The Code button dropdown open, showing the Clone panel with the HTTPS repository URL and a copy button](docs/screenshots/contributing/02-clone-dropdown.png)

Then, in a terminal:

```bash
git clone https://github.com/<your-username>/network-visualizer.git
cd network-visualizer
```

It's a good idea to also register the original project as a remote named
`upstream`, so you can pull in new changes later:

```bash
git remote add upstream https://github.com/Wolfi-OwO/network-visualizer.git
```

### 3. Create a branch

Never commit directly to `main` — create a branch for your change. GitHub's
branch switcher (click the **main** dropdown on the repo page) shows you
what branches already exist and lets you search or create one:

![The branch switcher dropdown open on the repo page, showing the "Find a branch" search box and the existing branches](docs/screenshots/contributing/03-branch-dropdown.png)

You'll actually create the branch locally with Git, not through this dropdown.
Name it `<type>/<short-description>` to match the project's
[commit style](#project-conventions), for example:

```bash
git checkout -b fix/cidr-off-by-one
```

### 4. Install dependencies and make your change

```bash
cd application         && npm install     # backend
cd application/client  && npm install     # frontend
```

Run the dev servers as described in
[Getting set up](#getting-set-up), make your change, and check it against the
[project conventions](#project-conventions) below (file naming, layering,
config, commit style). Then verify it against the
[quality gates](#quality-gates) — lint, build, and tests — **before** you
push, so CI passes on the first try.

### 5. Commit and push

```bash
git add <files>
git commit -m "fix: correct off-by-one in CIDR host count"
git push -u origin fix/cidr-off-by-one
```

`origin` here is your fork (that's what you cloned), so this pushes the
branch to your GitHub account, not to the original project.

### 6. Open a pull request

GitHub compares your new branch against `main` and offers to open a pull
request. You can get there from the banner GitHub shows right after a push,
from the **Pull requests** tab, or by browsing to `.../compare` on the
upstream repo (`base: main` <- `compare: <your-branch>`):

![The Compare changes page with base and compare branch selectors and a Create pull request button](docs/screenshots/contributing/05-compare-page.png)

The **Pull requests** tab lists every open and past PR, and has its own
**New pull request** button if you'd rather start from there:

![The Pull requests tab listing past pull requests, with the green New pull request button in the top-right](docs/screenshots/contributing/06-pr-list.png)

Click **Create pull request** (or **Compare & pull request**) to continue.

### 7. Fill in the PR template

Opening a PR pre-fills the description from
[`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md). Below
is a real, merged NetViz pull request showing the template filled in — use it
as a model for the level of detail expected:

![A real merged NetViz pull request showing the filled-in template: what changed, type of change, and checklist](docs/screenshots/contributing/07-pr-template.png)

The **Files changed** tab is where reviewers read your diff line by line —
this is also where you'll see comments if a reviewer asks for changes:

![The Files changed tab showing a line-by-line diff of a pull request](docs/screenshots/contributing/08-pr-files-changed.png)

See [The PR template](#the-pr-template) below for what belongs in each
section.

### 8. Let CI run, then wait for review

As soon as the PR is open, GitHub Actions runs lint, build, and tests
automatically. You can watch every run (yours and everyone else's) under the
**Actions** tab — all green means you're good to go:

![The Actions tab showing a list of workflow runs, all with green checkmarks](docs/screenshots/contributing/09-actions-green.png)

If a check fails, click into it to see the log, fix the issue locally, and
push again — the PR updates automatically. Once CI is green and a maintainer
approves, your branch gets merged into `main` and your contribution is live.

## Getting set up

Prerequisites: Node.js >= 20, npm, and a local MongoDB
(`docker compose up mongo` works). Then:

```bash
cd application         && npm install     # backend
cd application/client  && npm install     # frontend
```

Run both dev servers (backend on :8080, frontend on :5173) as described in
the [root README](ReadMe.md#run-in-development).

## Project conventions

- **Two independent npm packages**: `application/` (backend) and
  `application/client/` (frontend). Run scripts inside the package you change.
- **Filenames** are lowercase kebab-case; imports carry explicit extensions
  (`./foo.ts`) so the project builds on case-sensitive filesystems.
- **Layers**: routes -> handlers -> services -> db on the server; pages /
  components / layouts / lib on the client. New endpoints get a route file, a
  handler, HATEOAS `_links`, and tests.
- **Configuration** goes through `src/config/index.ts` — never read
  `process.env` elsewhere. Document new variables in `.env.example`.
- **Commit messages are [Conventional Commits](https://www.conventionalcommits.org/)**, and
  they are **load-bearing** — the release automation reads them to decide the next
  version number and to write the changelog. Getting the prefix right matters:

  | Prefix | Goes in the changelog as | Version effect (from `2.3.0`) |
  | --- | --- | --- |
  | `fix:` | Fixed | patch — `2.3.1` |
  | `feat:` | Added | minor — `2.4.0` |
  | `feat!:` / `BREAKING CHANGE:` in the body | Added + breaking notice | major — `3.0.0` |
  | `perf:` | Performance | patch |
  | `refactor:` | Changed | patch |
  | `docs:`, `ci:`, `build:` | Documentation / CI / Build | none |
  | `test:`, `style:`, `chore:` | hidden | none |

  Squash-merge titles become the commit on `main`, so **the PR title is what gets
  read** — make it a valid Conventional Commit. Branch names follow the same
  `type/short-description` shape, e.g. `feat/packet-filters`. See
  [docs/releasing.md](docs/releasing.md).
- **Never hand-edit a version number.** `package.json`, `package-lock.json` and
  `version.txt` are all written from the tag when a release is published
  (`scripts/set-version.mjs`). CI fails the build if they disagree
  (`node scripts/check-version-sync.mjs`).

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

Quick checklist once you've read the
[step-by-step walkthrough](#your-first-contribution-step-by-step) above:

1. Fork and create a feature branch from `main`.
2. Keep the change focused; unrelated refactors go in separate PRs.
3. Update documentation that your change makes stale (READMEs,
   [docs/api.md](docs/api.md), `.env.example`, [CHANGELOG.md](CHANGELOG.md)).
4. Push your branch and open a PR against `main`. Fill in every section of
   the PR template and link related issues (`Fixes #123`).
5. CI must be green before review.

### The PR template

Every new pull request is pre-populated from
[`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) — you
don't create it, GitHub inserts it into the description box automatically. Fill
in each section:

- **What does this change?** — a short summary and the motivation. For larger
  PRs, group the description by area (e.g. UI / Docs / CI). Link issues with
  `Fixes #123`.
- **Type of change** — tick every box that applies (Bug fix, New feature,
  Refactor / cleanup, Documentation, CI / build / deployment).
- **Checklist** — tick each item once it holds: `lint` + `build` pass, backend
  `npm test` and the 90% coverage gate stay green, new behavior has tests, docs
  are updated, and breaking changes are called out.
- **Breaking changes / migration notes** — write `None`, or exactly what
  operators/users must do when upgrading (and mirror it in `CHANGELOG.md`).
- **Screenshots (UI changes)** — before/after images for anything visual.

To adjust the template for everyone, edit
[`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md); GitHub
picks up the change for subsequent PRs. The same mechanism backs the
[issue templates](.github/ISSUE_TEMPLATE).

## Reporting bugs & requesting features

Use the [issue templates](.github/ISSUE_TEMPLATE). For security problems,
follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
