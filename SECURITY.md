# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

- Preferred: use GitHub's private vulnerability reporting —
  **Security -> Report a vulnerability** on this repository.
- Alternatively, email the maintainer at <koflerphillip@gmail.com> with a
  description, reproduction steps, and the affected version/commit.

You can expect an acknowledgement within a few days. Please give us a
reasonable window to ship a fix before disclosing publicly.

## Supported versions

Only the latest release (and the current `main` branch) receives security
fixes.

## Security model (what the app already does)

| Area              | Measure                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Sessions          | Signed JWT in an `httpOnly`, `SameSite=Lax` cookie; `Secure` when served over HTTPS               |
| Login CSRF        | OAuth `state` nonce stored in a short-lived cookie and verified on the callback                   |
| Authorization     | Role-based access control (`admin` / `editor` / `viewer`) enforced in middleware on every request |
| Data isolation    | Network data is scoped per account; roles never widen visibility                                  |
| Rate limiting     | Separate limiters for `/auth` and `/api`                                                          |
| Headers           | `helmet` security headers (CSP left to the deployment; see `app.ts`)                              |
| Proxy trust       | Exactly one reverse-proxy hop is trusted, so clients cannot spoof their IP past rate limiting     |
| Config validation | Production refuses to start with a missing or weak `JWT_SECRET`                                   |
| Auditing          | Mutating actions by signed-in users are recorded with a TTL retention window                      |

Details for engineers: [organizational/access-control.md](organizational/access-control.md).

## Deployment hardening checklist

- Set a strong random `JWT_SECRET` (at least 32 characters) — production will
  not start with the default.
- Serve over HTTPS (the cookie `Secure` flag follows the request protocol).
- Set `ALLOW_DEV_LOGIN=false` in production unless you explicitly need the
  password-less local login.
- Set `REQUIRE_AUTH=true` to disable the anonymous shared workspace on
  non-public deployments.
- Restrict `CORS_ORIGINS` to your production domain(s).
- Use an authenticated MongoDB connection string and keep the database off the
  public network.
