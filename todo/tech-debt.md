# Tech debt

Known compromises. Each one was *accepted*, not accidental — the point of writing
them down is that the next person can tell the difference, and doesn't "fix"
something that was a deliberate trade.

An item leaves this list when it's fixed, or when it's promoted to an
[ADR](../docs/adr/README.md) as a decision we're keeping on purpose.

---

## Security

- [ ] **Content-Security-Policy is disabled.** `helmet({ contentSecurityPolicy: false })`
      turns off CSP wholesale because React's inline styles trip the default policy.
      That's the single biggest gap in the app's security headers — it leaves XSS
      with no second line of defence. The fix is a real policy (`style-src 'self'
      'unsafe-inline'` at minimum, ideally nonce-based), not leaving it off.
      *Where:* `application/src/app.ts:37` · *Effort:* M

- [ ] **Sessions cannot be revoked.** Signing out clears the cookie, but the JWT
      stays cryptographically valid until it expires; demoting a user from `admin`
      doesn't take effect until their token expires. Accepted deliberately — see
      [ADR 0002](../docs/adr/0002-jwt-cookie-sessions.md) for the reasoning and the
      migration path (short access token + refresh token with a denylist). Becomes
      urgent the moment "lock this account out *now*" is a real requirement.
      *Where:* `application/src/middlewares/auth.ts` · *Effort:* L

- [ ] **PR previews hold a live credential to the production database server.**
      Isolated by database *name*, not by a separate principal — see
      [ADR 0004](../docs/adr/0004-previews-as-zero-traffic-revisions.md). Tolerable
      only because previews never run for fork PRs. If that ever changes, this must
      be fixed first.
      *Where:* `.github/workflows/pr-preview.yml` · *Effort:* M

## Testing

- [ ] **The frontend has no tests at all.** There is no test script and no test
      directory under `application/client/`. The 90% coverage gate is
      **backend-only**, which makes the project's coverage badge quietly misleading
      about the client. The packet-trace UI and the CIDR calculator both have real
      logic worth pinning down. Vitest + Testing Library is the obvious fit (Vite is
      already there).
      *Where:* `application/client/` · *Effort:* L

- [ ] **No end-to-end test.** Nothing exercises the actual chain — sign in, build a
      topology, send a packet, watch it get denied by an ACL. That is the app's core
      promise and it is verified only by hand. One Playwright spec covering that path
      would catch more real regressions than a lot of unit tests.
      *Effort:* M

## Build and dependencies

- [ ] **No automated dependency updates.** No Dependabot or Renovate config, so
      security patches land only when someone notices. `.github/dependabot.yml` with
      npm ecosystems for `application/` and `application/client/` (plus
      `github-actions`) is close to free. Group the minor/patch bumps into a single
      PR and ignore majors, or it turns into a wall of PRs nobody reads.
      *Effort:* S

- [ ] **`tsx` is a runtime dependency of the backend.** It sits in `dependencies`
      rather than `devDependencies` in `application/package.json`, so it ships in the
      production image even though the image runs compiled JS from `dist/`. Worth
      confirming nothing imports it at runtime, then moving it.
      *Where:* `application/package.json` · *Effort:* S

## Consistency

- [ ] **The README is `ReadMe.md`.** Unconventional casing. GitHub renders it fine,
      but tooling and contributors both expect `README.md`, and the repo otherwise
      insists on lowercase kebab-case filenames. Renaming needs `git mv` with care on
      case-insensitive filesystems, and every inbound link checked.
      *Effort:* S
