# Account Lifecycle

From first sign-in to off-boarding — the full life of an account.

## 1. Creation (just-in-time)

There is no separate "invite" or "register" step. An account is created the
**first time a person signs in**:

1. The user authenticates with Google, Microsoft, or the local login.
2. `findOrCreateUser()` looks them up by `(provider, providerId)`.
3. If they don't exist yet, a new account is created:
   - `role = admin` if they are the **very first** user, otherwise `role = editor`.
   - identity details (email, name, avatar, provider) are stored.

This is "just-in-time provisioning", the same pattern Google/Microsoft SSO uses.

## 2. Onboarding

A new **editor** can immediately:

- build, save, version, and export their **own** networks,
- run packet traces and captures, use the CIDR tools.

They **cannot** see other people's networks or reach any admin area.

## 3. Role changes

An **admin** assigns roles at any time:

- **UI:** Administration → Users & roles → role dropdown.
- **API:** `PATCH /api/users/:id { role }`.

Promotions and demotions take effect on the account's **next request** (the role
is read from the session token; users may need to sign out/in for an in-flight
session to pick up a change). Every change is audited.

## 4. Off-boarding

Two options, both admin-only:

| Goal | Action |
|------|--------|
| Revoke their ability to change anything, keep the account | Set role to **viewer** |
| Remove the account entirely | 🗑 in the UI, or `DELETE /api/users/:id` |

Guard rail: the **last administrator** can be neither demoted nor deleted.

## 5. Sessions & tokens

- A session is a signed JWT in an httpOnly cookie, valid for `JWT_TTL`
  (default 7 days).
- **Logout** clears the cookie (`POST /api/auth/logout`).
- Because roles live in the token, a role change is fully reflected once the
  user gets a fresh token (re-login or token refresh). Sensitive actions are
  re-checked server-side on every request, so a demoted user loses admin access
  immediately for anything that calls `requireRole('admin')`.

## 6. Quick reference

| Stage | Trigger | Result |
|-------|---------|--------|
| Create | First sign-in | Account created (`admin` if first, else `editor`) |
| Onboard | — | Can manage own networks |
| Promote/Demote | Admin sets role | Capabilities change |
| Off-board | Admin sets `viewer` or deletes | Read-only or removed |
| End session | Logout / TTL expiry | Cookie cleared / token expires |
