# Releasing

Releases are **fully automatic**. Nobody types a version number, edits a
`package.json`, writes a changelog entry, or creates a git tag by hand. The only
human actions in the whole process are *merging a pull request* and *approving
the production deploy*.

This document explains what happens, why it is built this way, and what to do
when it misbehaves.

---

## TL;DR

1. You merge normal PRs into `main`. Their titles are Conventional Commits
   (`feat: …`, `fix: …`).
2. A bot PR titled **`chore(main): release X.Y.Z`** appears and keeps itself up
   to date. It shows exactly what the next version will be and what the changelog
   will say.
3. When you want to ship, **merge that PR**. That is the release.
4. The pipeline tags `vX.Y.Z`, publishes the GitHub Release, rebuilds, and waits
   for a maintainer to approve the production deploy.

---

## How the version number is decided

The version comes from the commits, not from a person. Every commit that lands on
`main` is a [Conventional Commit](https://www.conventionalcommits.org/), and
[release-please](https://github.com/googleapis/release-please) reads the ones
added since the last tag:

| Commit prefix | Next version, starting from `2.3.0` |
| --- | --- |
| `fix:`, `perf:`, `refactor:` | `2.3.1` (patch) |
| `feat:` | `2.4.0` (minor) |
| `feat!:`, or any commit with `BREAKING CHANGE:` in its body | `3.0.0` (major) |
| `docs:`, `ci:`, `build:`, `test:`, `style:`, `chore:` | no release on their own |

The **highest** bump among the pending commits wins: one `feat:` among ten
`fix:`es produces a minor bump.

> **Squash merges matter.** The repo squash-merges PRs, so the **PR title**
> becomes the commit message on `main` — that is the string release-please
> actually reads. A PR titled "fixed the thing" contributes nothing to the
> version or the changelog. Title it `fix: correct off-by-one in CIDR host count`.

## What the release commit rewrites

This is the part that used to be broken. Before this automation, the git tag said
`v2.3.0` while `application/package.json` still said `1.0.0` and the client said
`0.0.0`, because *nothing in the pipeline ever wrote them*. The deployed app only
looked correct because `package.yml` injects `VITE_APP_VERSION` from the git tag
at build time — the repo's own source of truth had silently drifted three minor
versions.

Now a single release commit rewrites **every** file that records a version:

| File | Why it exists |
| --- | --- |
| `.release-please-manifest.json` | The source of truth. release-please reads this to know where it left off. |
| `version.txt` | Plain-text version, trivially readable by any script or Dockerfile. |
| `CHANGELOG.md` | Generated from the commit messages. |
| `application/package.json` | Backend package version. |
| `application/package-lock.json` (`.version` **and** `.packages[""].version`) | npm records the version in two places; both must move. |
| `application/client/package.json` | Frontend package version. |
| `application/client/package-lock.json` (both fields) | Same. |

That list lives in [`release-please-config.json`](../release-please-config.json)
under `extra-files`. Because the tag and these files come from the same commit,
they cannot disagree.

**And if they ever do**, CI catches it. Every push and PR runs a **Version
consistency** job:

```bash
node scripts/check-version-sync.mjs
```

It compares all seven version fields against the manifest and fails the build on
any mismatch. Adding a new file that records the version means adding it to
*both* `release-please-config.json` and that script.

## The pipeline

Everything lives in one workflow,
[`.github/workflows/release.yml`](../.github/workflows/release.yml), triggered on
every push to `main`:

```text
push to main
     |
     v
release-please ──▶ opens/updates "chore(main): release X.Y.Z"  ──▶ (waits)
     |
     |  (that PR is merged — this is the release)
     v
release-please ──▶ bumps versions, writes CHANGELOG,
     |             tags vX.Y.Z, publishes the GitHub Release
     |
     |  release_created == true
     v
   test ──▶ package ──▶ [maintainer approval] ──▶ deploy production (100% traffic)
```

- **test** reuses `ci.yml` — the exact same lint/build/test suite that gates PRs,
  re-run on the tagged commit. Nothing ships that hasn't passed.
- **package** builds the client and the Docker image and pushes it to ACR tagged
  `vX.Y.Z`, injecting the version, the git SHA and the build timestamp into the
  bundle.
- **deploy production** is gated by the `production` GitHub environment's
  **required-reviewers** rule. `deploy.yml` copies a new Container App revision
  from the one currently serving traffic, waits for it to report healthy, and only
  then shifts 100% of the traffic across.

On an ordinary push to `main` (not a release-PR merge), the last three jobs are
skipped — `release_created` is `false` — so day-to-day merges stay cheap.

### Why the ship stages are in the same workflow

A GitHub Release published with the default `GITHUB_TOKEN` **does not trigger
other workflows.** That is GitHub's deliberate recursion guard, and it is the
single most common way a release-please setup silently half-works: the tag and
the Release appear, but a separate `on: release: published` workflow never fires
and the release is never actually shipped.

Gating the stages on release-please's `release_created` output *inside the same
run* sidesteps it entirely. That is why `release.yml` triggers on `push` rather
than on `release`.

### Why release-please needs a PAT (`RELEASE_PLEASE_TOKEN`)

The same recursion guard has a second edge that the design above does *not* cover:
**a pull request opened by `GITHUB_TOKEN` does not trigger `pull_request` workflows
either.**

Under branch protection that is a deadlock. The release PR requires `CI`, `Lint`
and the version check to pass before it can merge — but those workflows never
start, so the required checks sit at `action_required` forever and the PR is
permanently unmergeable. v2.4.0 had to be unblocked by hand (closing and reopening
the PR, so that a *human* event started the checks).

The token also decides the **author** of the release commit. With `GITHUB_TOKEN`,
release commits are authored by `github-actions[bot]`, which lands the bot in the
repository's contributor list and adds a bot `Co-authored-by` trailer to the squash
commit.

`RELEASE_PLEASE_TOKEN` — a PAT owned by a maintainer, with `repo` and `workflow`
scopes — fixes both. The release PR becomes an ordinary PR that runs its own
checks, and the release commit is authored by a human.

If the secret is missing or expired, `release.yml` falls back to `GITHUB_TOKEN`, so
releases still work — they just revert to needing the manual close/reopen. Rotate
the PAT before it expires to avoid that.

---

## Recipes

### Ship a release

Merge the open `chore(main): release X.Y.Z` PR. Then approve the
`Deploy · production` job when it asks. That's it.

### See what the next release *would* be

Look at the open release PR. It is regenerated on every push to `main` and always
reflects the pending commits.

### Force a major version bump

Put a breaking-change footer in the commit body (or the squash-merge PR body):

```text
feat: replace the topology export format

BREAKING CHANGE: exports are now JSON Schema 2020-12; v1 files must be re-saved.
```

Or use the shorthand prefix: `feat!: replace the topology export format`.

### Release something that has no `feat:` or `fix:`

A docs-only or CI-only change won't trigger a release on its own. To cut one
anyway, land an empty commit:

```bash
git commit --allow-empty -m "fix: re-release with updated deployment config"
git push
```

### Roll back production

The release pipeline is not the rollback tool — `deploy.yml` is. Dispatch it
manually with an older, already-published tag:

```bash
gh workflow run deploy.yml -f tag=v2.2.0 -f environment=production
```

The revision that was serving traffic is left active, so this is a traffic shift
rather than a rebuild. It takes seconds.

### Skip the release PR for a hotfix

Don't. Land the `fix:` on `main`, merge the release PR it produces, and approve
the deploy — the whole path is a few minutes and it keeps the version files, the
tag and the changelog honest. If production is actively broken, roll back first
(above), *then* fix forward.

---

## Troubleshooting

**No release PR appeared after I merged something.**
Check the commit message that actually landed on `main` (`git log --oneline -1`).
If it isn't a Conventional Commit, or it's a `chore:`/`docs:`/`test:`, then
release-please correctly decided there is nothing to release. Land an empty
`fix:` commit (above) if you need one anyway.

**The release PR shows the wrong version.**
It is derived from the pending commit prefixes. A `feat:` you expected to bump the
minor may have been squash-merged under a different title — check `git log`, not
the PR list.

**CI fails with "Version drift".**
Something hand-edited a version. Do not patch the one file the error names; set
*all* of them to the version in `.release-please-manifest.json` in a single
commit, then let release-please take it from there.

**The tag and Release exist but nothing deployed.**
Look at the `release.yml` run for that commit. The `Deploy · production` job is
probably sitting in the required-reviewers gate waiting for an approval.

**release-please can't push / open a PR.**
The repo needs *Settings → Actions → General → Workflow permissions* set to
**Read and write permissions**, with **Allow GitHub Actions to create and approve
pull requests** enabled.

## Files involved

| File | Role |
| --- | --- |
| [`.github/workflows/release.yml`](../.github/workflows/release.yml) | The whole pipeline |
| [`release-please-config.json`](../release-please-config.json) | Which files to bump, how to group the changelog |
| [`.release-please-manifest.json`](../.release-please-manifest.json) | Current version — the source of truth |
| [`version.txt`](../version.txt) | Plain-text mirror of the current version |
| [`scripts/check-version-sync.mjs`](../scripts/check-version-sync.mjs) | The CI guard against drift |
| [`organizational/deploy/README.md`](../organizational/deploy/README.md) | What the deploy step actually does to Azure |
