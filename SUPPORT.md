# Support

Thanks for using NetViz. Here's where to go, depending on what you need.

## Before you post

Two places answer most questions faster than a human will:

- **[docs/troubleshooting.md](docs/troubleshooting.md)** — the failures people
  actually hit, in dev, CI and production, with fixes.
- **[Existing issues](https://github.com/Wolfi-OwO/network-visualizer/issues?q=is%3Aissue)** —
  search closed ones too; your problem may already have an answer attached to it.

## Where to go

| I want to… | Go to |
| --- | --- |
| Ask a question, or check whether an idea is worth building | [Discussions](https://github.com/Wolfi-OwO/network-visualizer/discussions) |
| Report something broken | [Bug report](https://github.com/Wolfi-OwO/network-visualizer/issues/new/choose) |
| Request a feature | [Feature request](https://github.com/Wolfi-OwO/network-visualizer/issues/new/choose) |
| Report a **security vulnerability** | **Do not open an issue** — follow [SECURITY.md](SECURITY.md) |
| Contribute code | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Understand how something works | [Architecture](docs/architecture.md) · [API reference](docs/api.md) · [ADRs](docs/adr/README.md) |
| Find out what's planned | [The backlog](todo/README.md) |

**Questions belong in Discussions, not Issues.** Issues are for tracked, actionable
work — a bug with a reproduction, or a specific feature. "How do I…" gets a faster
answer in Discussions and doesn't leave a stale ticket behind.

## Writing a bug report that gets fixed

The [issue template](.github/ISSUE_TEMPLATE) asks for these, and the reason is
simple: a report without them usually costs a round-trip before anyone can even
start.

- **What you did**, precisely enough that someone else can do it too.
- **What you expected**, and **what happened instead**.
- **Version** — the footer in the app shows it, or check
  [`version.txt`](version.txt).
- **How you're running it** — local dev, Docker Compose, or a deployment.
- **Logs / console output / a screenshot** if the failure is visible.

For anything involving a topology, exporting it and attaching the JSON turns a
vague report into something reproducible in one step.

## What to expect

This is a small project maintained in spare time. Issues and discussions are read,
but a reply is not guaranteed to be fast. A well-scoped pull request will almost
always move faster than an issue — and [good first issues](https://github.com/Wolfi-OwO/network-visualizer/labels/good%20first%20issue)
are labelled for exactly that.

Everyone participating is expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
