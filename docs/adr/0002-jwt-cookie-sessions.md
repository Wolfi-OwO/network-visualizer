# 0002. Sessions are signed JWTs in an httpOnly cookie, with no server-side store

- **Status:** Accepted
- **Date:** 2026-07-11 (recorded retroactively; the decision predates this ADR)

## Context

Users sign in with Google or Microsoft (OAuth 2.0). After the redirect dance, the
app needs to remember who they are on subsequent requests.

The deployment target constrains this. NetViz runs on Azure Container Apps in
**multiple-revision mode** — production is one revision, every open PR preview is
another, and a release creates a new revision that runs *alongside* the old one
until traffic is shifted. Any session mechanism that depends on a request landing
on the same process it started on will break during exactly the moments that
matter most: a deploy, and a rollback.

## Options considered

- **Server-side sessions in memory.** Simplest to write, and immediately wrong
  here: sessions evaporate on every deploy, and two revisions serving traffic
  cannot see each other's sessions. Would force sticky sessions.
- **Server-side sessions in MongoDB (or Redis).** Correct, revocable, and the
  textbook answer. But it puts a database read on the hot path of every single
  authenticated request, and — for Redis — adds a component to provision, pay for
  and monitor, for a tool whose whole deployment story is "one image, one
  database".
- **Signed JWT in an `httpOnly` cookie.** Stateless. Any revision can validate any
  session with nothing but the signing secret.

## Decision

The session is a JWT signed with `JWT_SECRET`, delivered in an `httpOnly` cookie
(`Secure` when the original request was HTTPS — which is why `app.set('trust proxy', 1)`
matters), with a lifetime of `JWT_TTL`. `middlewares/auth.ts` verifies it and
populates `req.user`. There is no session table.

Production **refuses to start** if `JWT_SECRET` is missing or too short, and if
`ALLOW_DEV_LOGIN` (the password-less local login) is still enabled.

## Consequences

**Bought:** Zero-downtime deploys and instant rollbacks work without sticky
sessions — a cookie minted by the old revision is valid on the new one. No session
store to provision, pay for, back up, or scale. No database round-trip per
request.

**Cost — and this is the real trade:** **sessions cannot be revoked.** Signing out
deletes the cookie on the client, but the token itself stays cryptographically
valid until it expires. Demoting a user from `admin` to `viewer` does not take
effect until their token expires, because the role is a claim inside it. Rotating
`JWT_SECRET` is the only global kill switch, and it logs *everyone* out.

That is an acceptable trade for a network-topology tool with a small, trusted user
set and a short token TTL. It would **not** be acceptable if NetViz held anything
genuinely sensitive, or grew to a user base where "we need to lock this account out
right now" is a real operational need.

**Revisit if:** immediate revocation becomes a requirement. The migration is a
short-lived access token plus a refresh token checked against a small server-side
denylist — which restores revocation without putting a full session lookup back on
the hot path.
