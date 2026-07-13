# Troubleshooting

Things that actually go wrong, and what to do about them. Grouped by where you hit
them.

If you're stuck on something not listed here, see [SUPPORT.md](../SUPPORT.md).

---

## Local development

### The backend exits immediately on startup

Almost always MongoDB. The server validates its config and connects before it
listens, so a missing database is a hard failure rather than a slow one.

```bash
docker run -d -p 27017:27017 mongo:7     # or: cd application && docker compose up mongo
```

Point it somewhere else with `MONGODB_CONNECTION_STRING` (default
`mongodb://localhost:27017/netviz`).

### The frontend loads but every API call 404s or hangs

The Vite dev server proxies `/api` and `/auth` to `http://localhost:8080` — **the
backend has to actually be running there.** They are two processes in two
terminals:

```bash
cd application        && npm run dev    # :8080
cd application/client && npm run dev    # :5173  ← open this one
```

Open `http://localhost:5173`, not `:8080`. Hitting `:8080` directly in dev serves
whatever stale `client/dist` happens to exist on disk, which is a confusing way to
debug a frontend change that "isn't applying".

### Sign-in does nothing / redirects to an error

Without `GOOGLE_CLIENT_ID` / `MICROSOFT_CLIENT_ID` configured, the OAuth buttons
have nothing to talk to. For local work you usually want the password-less dev
login instead — it is on by default outside production (`ALLOW_DEV_LOGIN=true`).

If you *are* configuring a real provider: the redirect URI is derived from the URL
the app is served at, so register exactly
`http://localhost:5173/auth/<provider>/callback` with the provider. A mismatch here
is the single most common OAuth failure.

### An import works on my machine and fails in Docker / CI

You almost certainly wrote `import { x } from './foo'` instead of
`import { x } from './foo.js'`, or capitalised a filename.

This project builds under `NodeNext` resolution on a **case-sensitive** filesystem.
macOS and Windows are case-*insensitive*, so `./Foo.js` and `./foo.js` are the same
file locally and different files in the Linux container. Every import carries its
explicit extension, and every filename is lowercase kebab-case. This is not style —
it is what makes the build reproducible.

---

## Tests and CI

### `npm test` fails on coverage, not on assertions

The backend enforces **≥90% line coverage** (`.c8rc.json`), and it is a hard gate.
The fix is tests, not a lower threshold. `application/coverage/index.html` shows
exactly which lines are uncovered.

### CI fails with "Version drift"

The `Version consistency` job found a `package.json` / `package-lock.json` that
disagrees with `version.txt` (the source of truth).

**Do not fix this by hand-editing the one file the error names.** Version numbers are
written from the tag when a release is published; if they have drifted, something
bypassed that. Set *all* of them at once with `node scripts/set-version.mjs $(cat
version.txt)`, in a single commit. Run the check locally:

```bash
node scripts/check-version-sync.mjs
```

### The client build passes locally but the Docker build fails

The backend image expects `application/client/dist/` to already exist in the build
context — it copies the bundle in rather than building it. Build the client first:

```bash
cd application/client && npm run build
cd ..                 && docker build -t netviz .
```

CI does this for you (the `client-dist` artifact); a local `docker build` does not.

---

## Releases

### I merged a PR but no release PR appeared

Check what actually landed on `main`:

```bash
gh release list
```

Publishing a **Release** is what ships. Creating a bare *tag* does nothing — a tag is
only a pointer. Go to Releases → **Draft a new release**, pick the tag, and **Publish**.

### I published a release and the tag moved

That is the design, not a bug. At publish time the tag points at a commit whose
`package.json` still holds the *old* version. `sync-version` writes the released
version into every file, lands it on `main`, and re-points the tag at that commit — so
the tag and the files it points at agree. See [releasing.md](releasing.md).

### The tag and GitHub Release exist, but nothing deployed

Open the `release.yml` run for that commit. `Deploy · production` is almost
certainly parked in the **required-reviewers gate**, waiting for a maintainer to
approve the promotion. That gate is deliberate.

### `sync-version` can't push or open a PR

The `RELEASE_PLEASE_TOKEN` secret (a maintainer's PAT, `repo` + `workflow` scopes) is
missing or expired — re-create it at <https://github.com/settings/tokens>.

Also check *Settings → Actions → General → Workflow permissions*: **Read and write
permissions**, with **Allow GitHub Actions to create and approve pull requests**
enabled.

Full release documentation: [docs/releasing.md](releasing.md).

---

## Production

### A new revision deployed but the app is broken

`deploy.yml` waits for the new revision to report healthy on `/api/ready` before
shifting traffic, and it **leaves the previous revision active**. So a rollback is a
traffic shift, not a rebuild — dispatch `deploy.yml` with the older tag:

```bash
gh workflow run deploy.yml -f tag=v2.2.0 -f environment=production
```

It takes seconds. Roll back first, diagnose second.

### The app won't start in production

Production runs stricter config validation than development and fails fast rather
than starting in an unsafe state. The usual causes:

- **`JWT_SECRET` missing or too short.** Generate one: `openssl rand -hex 32`.
- **`ALLOW_DEV_LOGIN` still enabled.** Production refuses to boot with the
  password-less login on — that is the check working.

The container logs name the offending variable.

### CORS errors in production

`CORS_ORIGINS` defaults to allowing only `localhost` / `127.0.0.1`. In the standard
single-origin deployment you should not need it at all — the SPA is served by the
same backend it calls ([ADR 0001](adr/0001-single-image-single-origin.md)). If
you're seeing CORS errors, you are serving the frontend from a different origin;
set `CORS_ORIGINS` to a comma-separated list of your real domains.

### A PR preview URL 404s or was never posted

Previews are opt-in (repo variable `PREVIEW_ENABLED=true`) and are **skipped for
fork PRs**, whose read-only token cannot reach the container registry. They also
need `ACR_NAME` / `IMAGE_NAME` (variables) and `ACR_USERNAME` / `ACR_PASSWORD`
(secrets) to be set — `package.yml` fails fast and names whichever is missing.

### Teardown fails with `authentication required` when deleting an image

```
ERROR: Error: authentication required, visit https://aka.ms/acr/authorization
```

This looks like a broken login, and it isn't — `azure/login` worked, which is why
the *read* calls (`show-tags`, `show`) in the same step succeeded. Deleting is a
**data-plane** call, and the token from `azure/login` only carries the scopes the
service principal's ACR roles grant it. `AcrPush` and `AcrPull` do not include
deletion, so the registry rejects the delete and phrases it as an auth failure.

Grant the identity `AcrDelete` on the registry (scoped to the registry, not the
subscription):

```bash
az role assignment create \
  --assignee <AZURE_CLIENT_ID> \
  --role AcrDelete \
  --scope $(az acr show -n <ACR_NAME> --query id -o tsv)
```

### A closed PR left its preview revision running

Almost always because the PR had a **merge conflict**. For a `pull_request` event,
GitHub runs the workflow from `refs/pull/<n>/merge` — the head test-merged into the
base. A conflicting PR has no such ref, so GitHub schedules **no run at all**, not a
failing one. Closing that PR therefore fired no teardown, and its zero-traffic
revision stayed active on the app.

This is why the teardown lives in its own workflow on `pull_request_target`
(`pr-preview-teardown.yml`), which runs from the base branch and needs no merge ref.
If you find a stale preview revision from before that change, deactivate it by hand
— the name filter makes it impossible to hit production:

```bash
az containerapp revision deactivate -g <RG> -n <APP> --revision <app>--pr-<n>-<sha>
```
