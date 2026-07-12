# Roadmap

Rough direction, in rough order. Not dated, not promised — this is the answer to
"where is this going?", not a schedule.

The through-line: **NetViz is a simulator, not a diagram tool.** Anything that
makes the simulation more truthful, or its verdicts more legible, beats anything
that makes the canvas prettier.

---

## Now — make the foundations honest

The things that would embarrass us if someone looked closely.

- **Frontend tests.** The client is the half of the app users actually touch and it
  has zero test coverage. See [tech-debt.md](tech-debt.md).
- **A real Content-Security-Policy.** Currently disabled outright.
- **Automated dependency updates.** Dependabot; currently nothing.
- **One end-to-end test** covering build-topology → send-packet → see-it-denied.

## Next — deepen the simulation

Where the tool gets more valuable rather than merely bigger.

- **IPv6.** The CIDR calculator and the whole addressing model are v4-only. This is
  the most-requested gap in a teaching tool, and it touches everything — addressing,
  routing, NAT (or its absence), the UI. Design discussion first.
- **Dynamic routing protocols.** Routes are static today. Watching OSPF actually
  converge — and re-converge after a link drops — is the single most compelling
  thing this tool could show that a diagram cannot.
- **Richer failure injection.** Links can be up/down; devices can be powered off.
  Packet loss, latency, MTU mismatch and asymmetric routing are where real networks
  actually hurt, and where the "why didn't my packet arrive" lesson lands hardest.
- **Explain-the-verdict.** Every drop already carries a reason. Turning that into a
  step-by-step "here is the routing table it consulted, here is the rule that
  matched" panel is the difference between a tool that tells you *that* it failed
  and one that teaches you *why*.

## Later — collaboration and scale

- **Shared/multi-user topologies.** Currently every workspace is owner-scoped. Real
  collaborative editing is a genuinely duplex problem and would force revisiting
  [ADR 0003](../docs/adr/0003-server-sent-events-for-live-packets.md) (SSE → WebSockets).
- **Import/export interop.** Reading and writing formats other tools understand
  (Cisco Packet Tracer, GNS3, plain YAML) so a topology isn't trapped here.
- **Session revocation.** Blocked on [ADR 0002](../docs/adr/0002-jwt-cookie-sessions.md);
  only worth doing when the user model demands it.

## Explicitly not doing

Saying no is part of a roadmap. These come up and the answer is no:

- **A real packet forwarding plane.** NetViz simulates; it does not move real
  frames. If you want that, you want GNS3 or containerlab, and they are better at it
  than this will ever be.
- **Being a monitoring tool.** It models networks you design, not networks you
  operate. A status page was built and then
  [removed](https://github.com/Wolfi-OwO/network-visualizer/commit/db51406) for
  exactly this reason — it pulled the product in a direction it isn't.
- **A plugin system.** Not until there are enough users that the maintainer is the
  bottleneck. Right now it would be architecture for an audience that doesn't exist.
