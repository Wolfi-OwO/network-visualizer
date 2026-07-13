# 0006. Releases are cut by publishing a GitHub Release

- **Status:** Accepted
- **Date:** 2026-07-13
- **Supersedes:** [0005](0005-automated-releases-with-release-please.md)

## Context

[ADR 0005](0005-automated-releases-with-release-please.md) adopted release-please:
Conventional Commits decided the version, and a permanently-open
`chore(main): release X.Y.Z` PR was the ship button. It solved the real bug it was
brought in for — seven version files that had silently drifted three minor versions
behind the tag — and it worked.

It was also the wrong shape for how this project actually releases.

The maintainer wants to decide *the version* and *the moment*, by hand, at the point
of shipping — not to have both derived from commit prefixes weeks earlier and then
staged in a bot PR that sits open in the PR list forever. Shipping v2.4.0 and v2.4.1
made the friction concrete:

- The release PR is **always open**, so the PR list never reads as "nothing pending".
- The version is decided by commit *titles*, which are easy to get wrong and awkward
  to override (`Release-As:` footers).
- release-please could not run under `GITHUB_TOKEN` without deadlocking (its PR never
  triggered the required checks), so it needed a PAT anyway — the cost 0005 had
  explicitly tried to avoid.
- The release commits were authored by `github-actions[bot]`, which put the bot in the
  repository's contributor list. Removing it needed a history rewrite.

None of that is a defect in release-please. It is a mismatch between a
commit-derived, always-staged release model and a maintainer who wants to type a
version into the GitHub UI and press Publish.

## Options considered

- **Keep release-please, ignore the PR until you want to ship.** Zero work. But it
  leaves the standing bot PR, keeps the version tied to commit titles, and keeps a
  release path nobody wanted.
- **Hand-cut the tag, and *verify* the version files match it.** Publish a Release;
  a CI job refuses to ship if the tag disagrees with the committed version files. Safe
  and simple — but it does not *set* the version, so you must land a bump commit first
  anyway. That is the release-please PR wearing a different hat.
- **Hand-cut the tag, and *derive* the version files from it.** Publishing the Release
  is the trigger; the pipeline writes the version you released into every file. The
  version number is typed exactly once, in the place you were already looking.

## Decision

**Publishing a GitHub Release is the release.** `release.yml` triggers on
`release: published` and nothing else. Pushes and merges to `main` ship nothing;
creating a bare tag ships nothing.

A `sync-version` stage runs first and makes the repo say what the tag claims:

1. Validate the tag is `vX.Y.Z`.
2. `scripts/set-version.mjs` writes that version into all seven fields.
3. Prepend the Release's own notes to `CHANGELOG.md` — one source, so the changelog
   and the release page cannot disagree.
4. Commit it, open a PR, merge it to `main`.
5. **Move the tag onto that commit**, and re-point the Release at it.

Then `test → package → deploy production` runs, every stage building from the *moved*
tag.

Three supporting decisions:

**The tag is moved, deliberately.** A tag points at a commit, and at publish time that
commit still holds the *old* version — nothing has bumped it yet. Either the bump lands
before the tag (which means a staged release PR: the model we are leaving) or the tag is
re-pointed after it. Anything else re-creates the 0005 bug: a tag claiming a version the
files it points at do not have, invisible from outside because the build injects the
displayed version from the tag. Moving a tag *within the release that creates it* is not
history rewriting; nothing has consumed it yet.

**The bump reaches `main` through a PR merged with `--admin`, not a direct push.**
The `main-protection` ruleset forbids direct pushes, and we are not weakening it. It
already grants repository admins a *pull-request* bypass — exactly the permission to
merge a PR without waiting on its checks — so the pipeline uses that and nothing more.
Skipping the bump PR's checks is safe: `test` re-runs the full suite on the merged
commit before anything is packaged or deployed.

**`scripts/check-version-sync.mjs` stays, with `version.txt` as the source of truth**
(it was `.release-please-manifest.json`; both release-please files are deleted). The
release now makes the files agree by construction, so the guard should never fire. It
exists because the original bug was silent for three minor versions, and the cost of
catching it is one 10-second job.

## Consequences

**Bought:** The version is typed once, in the GitHub UI, at the moment of shipping — by
a person, not inferred from commit prefixes. The changelog is the release notes. The
version files, the tag and the built image cannot disagree. No standing bot PR. No bot
in the contributor list. Two human gates remain: publishing the Release, and approving
the production deploy.

**Cost:** **The release is no longer derivable from the commit log.** Nothing stops a
maintainer publishing `v5.0.0` after a typo fix; semver discipline moved from the tool
into the person's head. Conventional Commits are no longer load-bearing for versioning
(they remain useful for the generated notes), so the safety net that "a `feat:` forces a
minor bump" is gone.

The pipeline is also **more bespoke**: ~60 lines of workflow plus a bump script that
this project now maintains, instead of a widely-used action. If it breaks, it is ours to
fix. That is the deliberate trade — a smaller, exactly-shaped mechanism over a larger,
approximately-shaped one.

Publishing a Release now **mutates `main`** (the bump commit) and **moves the tag**.
Both are surprising if you do not expect them; both are documented in
[`docs/releasing.md`](../releasing.md), and the tag move is the reason the whole thing
is correct.

**Revisit if:** the project grows contributors who release, and hand-picked versions
start drifting from semver (then a commit-derived tool like release-please earns its
keep again), or splits into independently-versioned packages (then a monorepo-aware
release tool replaces this single-version setup).
