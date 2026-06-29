# Roles & Permissions

NetViz uses **role-based access control (RBAC)** with three built-in roles. A
role is a single string stored on each account (`admin | editor | viewer`) and
carried inside the session token, so every request knows who you are and what
you may do.

## The three roles

| Role | Intended for | Can do |
|------|--------------|--------|
| **admin** | IT / platform owners | Everything an editor can, **plus** manage users & roles, view system metrics, and read the audit log |
| **editor** | Regular engineers (the default) | Create, edit, save, version, export, and delete **their own** networks; run traces, captures, and the CIDR tools |
| **viewer** | Stakeholders / read-only access | View their own networks and run read-only tools; **cannot modify data** |

> New accounts are created as **editor** by default. The **first** account ever
> created is promoted to **admin** automatically so the system is never left
> without an administrator.

## Capability matrix

| Capability | admin | editor | viewer | anonymous* |
|------------|:-----:|:------:|:------:|:----------:|
| View own networks | ✅ | ✅ | ✅ | ✅ |
| Create / edit / delete networks | ✅ | ✅ | ❌ | ✅ |
| Save versions / export config | ✅ | ✅ | ❌ | ✅ |
| Run packet traces & captures | ✅ | ✅ | ❌ | ✅ |
| CIDR / subnet tools | ✅ | ✅ | ✅ | ✅ |
| **Manage users & assign roles** (`/api/users`) | ✅ | ❌ | ❌ | ❌ |
| **View system metrics** (`/api/metrics`) | ✅ | ❌ | ❌ | ❌ |
| **Read the audit log** (`/api/audit`) | ✅ | ❌ | ❌ | ❌ |
| View the public status page | ✅ | ✅ | ✅ | ✅ |

\* **anonymous** = nobody signed in. When `REQUIRE_AUTH` is off (the default),
visitors share a single `local` workspace and may edit it. Turn `REQUIRE_AUTH`
on to require a sign-in for any network data — anonymous access then disappears.

## How each rule is enforced

| Rule | Where |
|------|-------|
| Who you are | `authenticate` middleware reads the session JWT cookie (or `Authorization: Bearer`) → `req.user` |
| Must be signed in | `requireAuth` |
| Must be an admin | `requireRole('admin')` on `/api/users`, `/api/metrics`, `/api/audit` |
| Viewers are read-only | `requireWrite` rejects `POST/PUT/PATCH/DELETE` for the `viewer` role |
| You only see your own data | `ownerOf(req)` scopes every network query to your account id (or `local`) |

All of the above live in [`application/src/middlewares/auth.ts`](../application/src/middlewares/auth.ts).
The role list itself is defined once in
[`application/src/services/auth-service.ts`](../application/src/services/auth-service.ts)
(`ROLES`) and reused by the API and the admin UI.

## A note on data visibility

Roles control **what you can do**, not **whose data you can see**. Networks are
**isolated per account** (`ownerOf`), so even an `admin` does not automatically
browse another user's saved topologies — that is a deliberate privacy boundary.
Admins manage *people, roles, and the platform*; they do not silently read
everyone's work. (If you ever want an "admin sees all topologies" mode, that is
a small, explicit change — see [access-control.md](./access-control.md).)
