# 0004. PR previews are zero-traffic revisions of the production app

- **Status:** Accepted
- **Date:** 2026-07-11 (recorded retroactively; the decision predates this ADR)

## Context

Reviewing a change to a *visual* tool by reading a diff is close to useless. A
reviewer needs to click the thing. So every PR should get a real, public,
working URL.

The obvious way to do that is to spin up a preview environment per PR — a second
Container App, its own database, its own DNS. That is a real amount of
infrastructure to provision, pay for, and garbage-collect, on a project that is
otherwise deliberately "one image, one app, one database".

The hard constraint: **a preview must not be able to touch production data or take
production traffic.** Ever. Not through a config typo, not through a race in the
workflow.

## Options considered

- **A second Container App per PR.** Cleanest isolation, and the standard answer.
  Costs a full app + database provisioned and torn down per PR, and a pile of
  Azure resource lifecycle code that only runs on the unhappy path when a PR is
  abandoned.
- **A single shared staging environment.** Cheap, but serializes reviews — two open
  PRs fight over it, and you can never trust what you're looking at.
- **A new revision of the *production* app, carrying 0% of the traffic.** Container
  Apps already runs in multiple-revision mode, and every revision gets its own
  public URL for free.

## Decision

`pr-preview.yml` copies the current production revision, swaps in the PR's image,
and deploys it as a **new revision of the same Container App** — with its own
public URL (`https://netviz--pr-<N>-<sha>….azurecontainerapps.io`), and **0% of the
ingress traffic**. The workflow **never touches the traffic split**, which is what
makes "a preview cannot take production traffic" a structural property rather than
a promise.

Data isolation comes from overriding `MONGODB_DB_NAME`: the preview reuses
production's Mongo *connection secret* but lands on a **different database in the
same cluster**. Nothing to provision; it simply cannot see production's
collections.

The revision is deactivated automatically when the PR is merged or closed. It is
opt-in per repo (`PREVIEW_ENABLED=true`) and skipped for fork PRs, whose read-only
token cannot reach the registry anyway.

## Consequences

**Bought:** A reviewable public URL per PR, on real infrastructure, with zero extra
infrastructure to pay for. Previews run the *same* ingress, TLS and runtime config
as production, so "works in preview, breaks in prod" gets much rarer. Cleanup is
one API call, not a resource-graph teardown.

**Cost:** Previews share the production Container App's **compute** — a preview
revision that pathologically burns CPU or memory is contending with production for
it. They also share the Mongo *cluster* (though not the database), so they share
its connection limits and its blast radius. And a preview holds a live credential
to the production database server, which is a real if narrow trust concession: it
is scoped by database name, not by a separate principal.

This is acceptable because previews only run for PRs from the repo itself, by
people who already have write access. It would **not** be acceptable if previews
ran for arbitrary fork PRs — which is exactly why they don't.

**Revisit if:** the project takes fork PRs from untrusted contributors and wants
previews for them, or if preview load starts measurably degrading production. Both
point at the same fix: a separate preview app with its own database principal.
