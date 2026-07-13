# Releasing

**Publishing a GitHub Release is the release.** That is the only thing that ships.

You pick the version, you pick the moment. The pipeline then writes that version
into every file that records it, commits that under your name, moves the tag onto
that commit, rebuilds, and waits for you to approve production.

Nobody edits a `package.json` by hand. Nobody types a version number twice.

---

## TL;DR

1. Merge normal PRs into `main`. Nothing ships. No bot PR appears.
2. When you want to release: **Releases → Draft a new release → create tag `vX.Y.Z` → Publish.**
3. The pipeline sets all 7 version files to `X.Y.Z`, lands that on `main`, and
   re-points `vX.Y.Z` at it.
4. It re-runs the full test suite, builds the image, and waits for your approval
   to deploy production.

Creating a **tag** on its own does nothing — a tag is just a pointer. Only
**Publish** starts a release.

---

## The thing that makes this non-obvious

A tag points at a commit. When you publish `v2.5.0`, the commit it points at
still says `2.4.1` in `application/package.json` — nothing has bumped it yet.

Shipping that as-is is exactly the bug this repo already had: the tag said
`v2.3.0` while `application/package.json` said `1.0.0` and the client said
`0.0.0`. It was invisible from the outside, because the build injects the
displayed version from the **tag**. The app looked right; the source lied.

So the release **cannot simply trust the tag**. It does this instead:

```text
You publish v2.5.0  ─▶ tag points at commit A (package.json still says 2.4.1)
                          │
   sync-version           │  writes 2.5.0 into all 7 files
                          │  prepends your release notes to CHANGELOG.md
                          │  commits it as YOU, merges it to main  ─▶ commit B
                          │  moves tag v2.5.0 from A to B
                          ▼
                     tag v2.5.0 ─▶ commit B (package.json says 2.5.0)  ✅
                          │
        test ──▶ package ──▶ [your approval] ──▶ deploy production
              (all three build from B, via the moved tag)
```

After `sync-version`, the tag and the files it points at agree **by
construction** — and every later stage builds from the moved tag, so the image
really does contain the version on its label.

## What a release rewrites

| File | Why it exists |
| --- | --- |
| `version.txt` | **The source of truth.** Plain-text version, trivially readable by any script. |
| `CHANGELOG.md` | Your release notes, prepended. One source — they cannot disagree. |
| `application/package.json` | Backend package version. |
| `application/package-lock.json` (`.version` **and** `.packages[""].version`) | npm records the version twice; both must move. |
| `application/client/package.json` | Frontend package version. |
| `application/client/package-lock.json` (both fields) | Same. |

All of it is written by [`scripts/set-version.mjs`](../scripts/set-version.mjs).
You can run it yourself:

```bash
node scripts/set-version.mjs 2.5.0
```

**And if they ever drift**, CI catches it. Every push and PR runs a **Version
consistency** job ([`scripts/check-version-sync.mjs`](../scripts/check-version-sync.mjs))
that compares all seven fields against `version.txt` and fails the build on any
mismatch. Adding a new file that records the version means adding it to *both*
scripts.

## Why the version bump can touch a protected branch

It doesn't push to `main` directly — the ruleset forbids that, and we are not
weakening it.

`sync-version` opens a **real pull request** and merges it with `gh pr merge
--admin`. Your repository-admin role is explicitly granted a *pull-request*
bypass in the `main-protection` ruleset, which is precisely the permission to
merge a PR without waiting on its checks. Nothing else is bypassed, and branch
protection stays on throughout.

Skipping the bump PR's checks is safe because the **`test` stage re-runs the
entire suite on the merged commit** before anything is packaged or deployed. The
code is tested; it is just tested one step later.

## Why the token is a PAT (`RELEASE_PLEASE_TOKEN`)

> The name is historical — it dates from when this repo used release-please. It
> is now just "the release token". Renaming it would mean re-creating the secret,
> so it kept its name.

It needs the **`repo`** and **`workflow`** scopes, and it exists for two reasons:

**GitHub's recursion guard.** Anything done with the default `GITHUB_TOKEN` does
not trigger further workflows. A release published by `GITHUB_TOKEN` would never
start this pipeline at all.

**Attribution.** Commits authored with `GITHUB_TOKEN` are attributed to
`github-actions[bot]`, which lands the bot in the repository's contributor list.
With a maintainer's PAT, the version-bump commit is authored by a human and shows
up under their profile — which is the whole point of "commit under my name".

If the PAT expires, releases fail loudly (`sync-version` cannot check out or
push). Rotate it before it expires.

---

## Recipes

### Ship a release

Releases → **Draft a new release** → **Choose a tag** → type `v2.5.0` → **Create
new tag on publish** → write (or auto-generate) the notes → **Publish release**.

Then approve the `Deploy · production` job when it asks. That's it.

### Pick the version

You already did — it's the tag you typed. There is no bot deciding for you.
Follow [semver](https://semver.org/): breaking change → major, new feature →
minor, bug fix → patch.

### Write the changelog

Whatever you put in the Release notes becomes the `CHANGELOG.md` entry. GitHub's
**Generate release notes** button fills it from the merged PRs, which is usually
what you want.

### Roll back production

The release pipeline is not the rollback tool — `deploy.yml` is. Dispatch it
manually with an older, already-published tag:

```bash
gh workflow run deploy.yml -f tag=v2.2.0 -f environment=production
```

The revision that was serving traffic is left active, so this is a traffic shift
rather than a rebuild. It takes seconds.

### Re-ship a version that is already tagged

Publish the release again from the Releases page. `sync-version` is idempotent —
if the files already say that version, it lands nothing and just re-runs the ship
stages.

---

## Troubleshooting

**I created a tag and nothing happened.**
Correct. A tag is only a pointer. Publish a *Release* on it.

**The release failed at `Set version …` with "not a vX.Y.Z tag".**
The tag must look like `v2.5.0`. Delete the release and re-publish with a valid
tag.

**CI fails with "Version drift".**
Something hand-edited a version file. Don't patch the one file the error names:

```bash
node scripts/set-version.mjs "$(cat version.txt)"
```

**The tag moved after I published. Is that a bug?**
No — that is the design. The tag is re-pointed onto the commit that actually
contains the version you released. See the diagram above.

**The tag and Release exist but nothing deployed.**
Look at the `release.yml` run for that tag. The `Deploy · production` job is
probably sitting in the required-reviewers gate waiting for your approval.

**`sync-version` can't push or open a PR.**
`RELEASE_PLEASE_TOKEN` is missing or expired. Re-create it at
https://github.com/settings/tokens with the `repo` and `workflow` scopes.

## Files involved

| File | Role |
| --- | --- |
| [`.github/workflows/release.yml`](../.github/workflows/release.yml) | The whole pipeline |
| [`scripts/set-version.mjs`](../scripts/set-version.mjs) | Writes the version into every file |
| [`scripts/check-version-sync.mjs`](../scripts/check-version-sync.mjs) | The CI guard against drift |
| [`version.txt`](../version.txt) | The source of truth |
| [`organizational/deploy/README.md`](../organizational/deploy/README.md) | What the deploy step actually does to Azure |
