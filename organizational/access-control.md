# Access Control — Technical Reference

How authentication and authorization are actually implemented, for engineers
working on the codebase.

## Authentication

- **Identity providers:** Google & Microsoft via OAuth 2.0 authorization-code
  flow ([`auth-service.ts`](../application/src/services/auth-service.ts)), plus a
  local login for development/self-host.
- **Sessions:** on success the server issues a **signed JWT** stored in an
  **httpOnly cookie** (`netviz_token`). The JWT payload carries
  `{ sub, email, name, role }`. See
  [`lib/jwt.ts`](../application/src/lib/jwt.ts) and
  [`handlers/auth.handlers.ts`](../application/src/handlers/auth.handlers.ts).
- **CSRF on login:** the OAuth `state` is a random nonce stored in a short-lived
  cookie and verified on callback.
- The cookie is marked `Secure` only when the request is actually HTTPS
  (`req.secure`), so it still works on plain-HTTP localhost.

## Authorization middleware

All in [`application/src/middlewares/auth.ts`](../application/src/middlewares/auth.ts):

| Function                | Purpose                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `authenticate`          | Runs on every request; decodes the session token into `req.user` (or leaves it undefined) |
| `requireAuth`           | 401 if there is no `req.user`                                                             |
| `requireRole(...roles)` | 403 unless `req.user.role` is one of the listed roles                                     |
| `requireWrite`          | 403 for `viewer` on any mutating method (`POST/PUT/PATCH/DELETE`)                         |
| `ownerOf(req)`          | Returns the data owner key: the user id, or `'local'` when anonymous                      |

## Where roles are enforced (route map)

From [`application/src/app.ts`](../application/src/app.ts):

| Mount                                       | Guard                                              | Effect                               |
| ------------------------------------------- | -------------------------------------------------- | ------------------------------------ |
| `/auth`                                     | —                                                  | Login / logout / `me`                |
| `/api/status`                               | —                                                  | Public status & uptime               |
| `/api/users`                                | `requireRole('admin')`                             | **Account & role management**        |
| `/api/metrics`                              | `requireRole('admin')`                             | System metrics                       |
| `/api/audit`                                | `requireRole('admin')`                             | Audit log                            |
| `/api/networks`                             | `requireWrite` (+ `requireAuth` if `REQUIRE_AUTH`) | Per-user networks; viewers read-only |
| `/api/cidr`, `/api/packets`, `/api/capture` | —                                                  | Tools                                |

The role list is defined once as `ROLES` in
[`auth-service.ts`](../application/src/services/auth-service.ts) and validated by
`isRole()`, so the API and UI can never disagree on valid roles.

## Account & role management API

Implemented in [`handlers/users.handlers.ts`](../application/src/handlers/users.handlers.ts)
and [`routes/users.routes.ts`](../application/src/routes/users.routes.ts):

```http
GET    /api/users          → { users: [...], roles: ["admin","editor","viewer"] }
PATCH  /api/users/:id       { role }   → updated user
DELETE /api/users/:id                  → 204
```

Service layer (`auth-service.ts`): `listUsers()`, `setUserRole(id, role)`,
`deleteUser(id)`. Both mutating functions call `countAdmins()` and **refuse to
remove the last admin** (`BadRequestError`).

## Data isolation

Every network query is scoped by `ownerOf(req)`:

- signed in → `req.user.id` (your private workspace)
- anonymous → `'local'` (shared workspace, disabled when `REQUIRE_AUTH=true`)

Roles do **not** widen this scope — an `admin` still queries against their own
owner id. To add an "admin sees all networks" capability you would relax the
owner filter in the networks service for `req.user.role === 'admin'`; it is
intentionally **not** done today to keep each user's work private.

## Auditing

The `audit` middleware ([`middlewares/audit.ts`](../application/src/middlewares/audit.ts))
records mutating actions by signed-in users (including role changes and user
deletions) with a TTL retention window (`AUDIT_RETENTION_DAYS`, default 90).

## Relevant configuration

| Env var                                                                | Meaning                                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `JWT_SECRET`                                                           | Signs session tokens — **must** be a strong random value in production |
| `REQUIRE_AUTH`                                                         | `true` disables the anonymous `local` workspace                        |
| `ALLOW_DEV_LOGIN`                                                      | Allow the password-less local login (off in production unless set)     |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                            | Enable Google sign-in                                                  |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT` | Enable Microsoft sign-in                                               |
| `AUDIT_RETENTION_DAYS`                                                 | How long audit entries are kept                                        |
