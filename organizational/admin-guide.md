# Administrator Guide

Everything an administrator does to manage people and roles. This mirrors the
"Users & roles" area of a Google Workspace / Microsoft 365 admin console.

## 1. Becoming the first administrator

There is no manual bootstrap step:

1. Deploy the app and open it.
2. Sign in (Google, Microsoft, or local login).
3. Because the database has no users yet, **your account is created as `admin`.**

Every account created after that is an **editor** by default, until an admin
changes it.

## 2. Assigning a role to an account (the UI)

1. Sign in as an **admin**.
2. Go to **Administration** (the `/admin` area).
3. Scroll to **Users & roles**. You'll see every account with its provider and a
   role dropdown.
4. Pick a new role (`admin`, `editor`, or `viewer`). It saves immediately.
5. Use the **Delete** (trash) button to remove an account entirely.

> **Safety net:** the system refuses to demote or delete the **last remaining
> administrator**, so you can never lock everyone out. Promote a second admin
> first if you want to step down.

## 3. Managing roles via the API

The UI is just a front-end for these admin-only endpoints (all require an
`admin` session):

```http
GET    /api/users              # list every account + the valid roles
PATCH  /api/users/:id          # body: { "role": "admin" | "editor" | "viewer" }
DELETE /api/users/:id          # remove an account
```

Example — promote a user to admin with `curl` (cookie-based session):

```bash
curl -X PATCH https://your-host/api/users/<user-id> \
  -H 'Content-Type: application/json' \
  -b 'netviz_token=<your-admin-session-cookie>' \
  -d '{"role":"admin"}'
```

Every change is written to the **audit log** (`GET /api/audit`, admin-only).

## 4. Requiring sign-in for everyone

By default, anonymous visitors share a `local` workspace they can edit. To make
the platform private (no anonymous access — every action needs an account):

```env
REQUIRE_AUTH=true
```

Set this in `application/.env` (or the container environment) and restart.

## 5. Identity providers

| Provider    | How to enable                                                                         |
| ----------- | ------------------------------------------------------------------------------------- |
| Google      | Set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`                                       |
| Microsoft   | Set `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` (+ optional `MICROSOFT_TENANT`) |
| Local login | On by default in dev; in production it only works if `ALLOW_DEV_LOGIN=true`           |

Only providers with both a client id and secret appear on the login page.

## 6. Useful admin views

| View                                                      | Where                                    | Who      |
| --------------------------------------------------------- | ---------------------------------------- | -------- |
| Users & roles                                             | Administration page                      | admin    |
| System metrics (uptime, memory, request count, DB counts) | Administration page / `GET /api/metrics` | admin    |
| Audit log (who changed what)                              | `GET /api/audit`                         | admin    |
| Public status / uptime                                    | the `status.` subdomain                  | everyone |

## 7. Common tasks — quick reference

| I want to…             | Do this                                                    |
| ---------------------- | ---------------------------------------------------------- |
| Make someone an admin  | Administration -> Users & roles -> set role to `admin`     |
| Make someone read-only | Set their role to `viewer`                                 |
| Off-board someone      | Set to `viewer`, or remove them with the **Delete** button |
| Step down as admin     | Promote another admin first, then lower your own role      |
| Lock the platform down | `REQUIRE_AUTH=true`                                        |
