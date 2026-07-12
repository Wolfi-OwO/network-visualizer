# 0005. Versions and releases are derived from commits by release-please

- **Status:** Accepted
- **Date:** 2026-07-11

## Context

Releases were manual: a maintainer created a GitHub Release by hand, and
`release.yml` (triggered by `release: published`) tested, packaged and deployed it.

That worked, but the version number was never written down anywhere in the repo.
Nothing in the pipeline updated a `package.json`. By `v2.3.0`, the repo said:

| File | Said | Should have said |
| --- | --- | --- |
| git tag / GitHub Release | `v2.3.0` | — |
| `application/package.json` | `1.0.0` | `2.3.0` |
| `application/package-lock.json` | `1.0.0` | `2.3.0` |
| `application/client/package.json` | `0.0.0` | `2.3.0` |
| `application/client/package-lock.json` | `0.0.0` | `2.3.0` |

The drift went unnoticed because the *deployed* app looked right: `package.yml`
injects `VITE_APP_VERSION` into the client bundle from the git tag at build time,
so the footer showed `2.3.0` while the source of truth said `1.0.0`. The bug was
invisible from the outside — which is the worst kind.

Manual releases also meant `CHANGELOG.md` was written by hand, and the changelog
is exactly the artifact that rots when it depends on someone remembering.

## Options considered

- **A script + a documented checklist.** "Run `npm version`, update the lockfiles,
  edit the changelog, tag, push." Cheap to build. But it relies on a human
  executing it correctly every time, which is precisely the thing that already
  failed. A checklist is not automation.
- **`semantic-release`.** Mature, and fully automatic — it tags and publishes with
  no human in the loop at all. That last property is the problem: this project
  wants a human to *choose the moment* to ship, because shipping moves production
  traffic. semantic-release would release on every qualifying merge to `main`.
- **`release-please`.** Derives the version from Conventional Commits like
  semantic-release, but stages it as a **pull request** rather than releasing
  immediately. The PR is the "shall we ship?" decision point.

## Decision

Adopt **release-please**, configured in
[`release-please-config.json`](../../release-please-config.json) with
[`.release-please-manifest.json`](../../.release-please-manifest.json) as the
source of truth for the current version.

Commit prefixes decide the bump (`fix:` → patch, `feat:` → minor, `BREAKING CHANGE:`
→ major). release-please keeps a `chore(main): release X.Y.Z` PR permanently open
showing the next version and the changelog it would write. **Merging that PR is the
release**: one commit rewrites all seven version fields, writes `CHANGELOG.md`,
tags `vX.Y.Z` and publishes the GitHub Release. `test → package → deploy` then runs
behind the existing required-reviewers gate.

Two supporting decisions:

**The ship stages live in the same workflow run as release-please**, gated on its
`release_created` output — rather than in a separate `on: release: published`
workflow. This is not a style choice. A Release published with the default
`GITHUB_TOKEN` **does not trigger other workflows** (GitHub's recursion guard), so
the old `release.yml` trigger would have silently never fired: tag created, release
published, nothing shipped. The alternative is a personal access token or a GitHub
App — a long-lived credential to store and rotate — to buy back a workflow
separation that has no independent value.

**`scripts/check-version-sync.mjs` runs in CI on every push and PR.** release-please
makes the files agree *by construction*, so this guard should never fire. It exists
because the original bug was silent for three minor versions, and the cost of
catching it is one 10-second job.

## Consequences

**Bought:** The tag, the changelog and every `package.json` are now produced by a
single commit and cannot disagree. Nobody types a version number. The changelog is
derived from work that was actually done rather than from memory. A human still
chooses when to ship (merge the PR) and still approves the production deploy — the
two decisions worth keeping a person in.

**Cost:** **Commit messages are now load-bearing.** A PR squash-merged with the
title "fixed the thing" contributes nothing to the version and nothing to the
changelog — the discipline moved from "remember to bump the version" to "write the
commit title correctly", which is at least enforced at review time and visible in
the PR. Contributors have to learn Conventional Commits (documented in
`CONTRIBUTING.md`), and the release automation is now a dependency: if
release-please breaks or is abandoned, releases stop until it is replaced.

The repo also gains a `version.txt` at the root — the `simple` release type
maintains it. It is a harmless and occasionally useful plain-text mirror of the
version, and the sync check covers it.

**Revisit if:** the project ever wants to ship on every merge with no human gate
(then semantic-release is the better fit), or splits into independently-versioned
packages (then release-please's monorepo mode, with per-package tags, replaces the
`simple` single-version setup used here).
