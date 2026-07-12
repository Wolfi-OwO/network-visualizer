# The backlog

What is planned, what is known-broken-but-tolerated, and what is deliberately not
being done. Everything here is a candidate, not a commitment.

## Files

| File | What lives here |
| --- | --- |
| [roadmap.md](roadmap.md) | Where the project is going, in rough order |
| [features.md](features.md) | Specific features people have asked for or that obviously fit |
| [tech-debt.md](tech-debt.md) | Known compromises in the code, with the reason each was accepted |
| [docs.md](docs.md) | Documentation that is missing or stale |

## How this relates to GitHub Issues

They are not the same thing and they are not a duplicate of each other:

- **Issues** are *tracked, actionable* work — something specific enough that a
  contributor could pick it up today, with a reproduction or an acceptance
  criterion. Issues are the unit of work.
- **This directory** is the *thinking* — the shape of where things are going, and
  the honest list of what's wrong. Most of it is not yet well-formed enough to be
  an issue, and some of it never will be.

The flow is: something lands here → it gets sharp enough to act on → it becomes an
issue → it gets fixed → it is removed from here. An item that has become an issue
should link to it and otherwise get out of the way.

## Conventions

Each item is a checkbox with enough context to be picked up cold:

```markdown
- [ ] **Short title.** What's actually wrong or wanted, and why it matters.
      *Where:* `path/to/file.ts` · *Effort:* S/M/L · *Issue:* #123
```

Effort is a rough shirt size, not an estimate: **S** = an afternoon, **M** = a few
days, **L** = a project with a design discussion in front of it.

Anything that changes an architectural decision needs an
[ADR](../docs/adr/README.md), not just a checkbox.
