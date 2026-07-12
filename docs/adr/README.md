# Architecture decision records

The code shows *what* NetViz does. Git shows *when* it changed. Neither shows
**why** — and "why" is the thing that gets lost when the person who made the call
moves on, and the thing a reviewer needs before they can safely argue with a
design.

An ADR is a short, immutable note recording one decision: the problem, the options,
the call, and what it cost. They are written once and **not edited afterwards**. If
a decision is later reversed, that reversal is a *new* ADR that supersedes the old
one — the record of having believed the old thing is itself useful.

## When to write one

Write an ADR when a choice is **expensive to reverse** or **surprising to a
newcomer**:

- Picking (or dropping) a database, a protocol, a hosting model, an auth scheme.
- Deliberately *not* doing the obvious thing — those are the most valuable ADRs,
  because the next person will otherwise "fix" it.
- Anything you would otherwise end up re-explaining in a PR review for the third
  time.

Do **not** write one for: routine library bumps, refactors that preserve behavior,
or anything the code already makes obvious.

## How

Copy [`template.md`](template.md) to `NNNN-short-title.md`, using the next free
number. Keep it to a page. Open it as a PR so the decision itself gets reviewed —
the discussion on that PR is part of the record.

## Index

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-single-image-single-origin.md) | The backend serves the SPA — one image, one origin | Accepted |
| [0002](0002-jwt-cookie-sessions.md) | Sessions are signed JWTs in an httpOnly cookie, with no server-side store | Accepted |
| [0003](0003-server-sent-events-for-live-packets.md) | Live packets stream over Server-Sent Events, not WebSockets | Accepted |
| [0004](0004-previews-as-zero-traffic-revisions.md) | PR previews are zero-traffic revisions of the production app | Accepted |
| [0005](0005-automated-releases-with-release-please.md) | Versions and releases are derived from commits by release-please | Accepted |
