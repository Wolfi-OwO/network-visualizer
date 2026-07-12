# Features

Specific, reasonably-scoped things worth building. Bigger themes live in
[roadmap.md](roadmap.md).

Items marked **good first issue** are self-contained, touch few files, and have an
obvious "done" — a decent first contribution.

---

## Network Builder

- [ ] **Show the routing table that produced a verdict.** The trace already knows
      which route matched at each hop; the UI only shows the outcome. Surfacing the
      table it consulted, with the winning longest-prefix row highlighted, turns a
      result into a lesson.
      *Where:* `application/src/services/packet-sender-service.ts` (already computes
      it), `client/src/pages/network/` · *Effort:* M

- [ ] **Bulk device operations.** Select several devices and power them on/off, or
      move them to a VLAN, in one action. Fiddly by hand today on any topology
      big enough to be interesting.
      *Effort:* M

- [ ] **Topology templates.** Ship a few starting points — a small office, a DMZ, a
      three-tier datacenter — so a new user has something to *break* rather than a
      blank canvas. The seeded "Enterprise Network" demo already proves the shape;
      this generalises it.
      *Effort:* M

- [ ] **Search / jump-to-device.** A palette (`Ctrl+K`) that finds a device by name
      or IP and centres the canvas on it.
      *Effort:* S · **good first issue**

## Packet Capture

- [ ] **Export a capture as `.pcap`.** The feature is explicitly Wireshark-shaped;
      being able to *open the result in Wireshark* is the obvious completion of that
      promise, and a genuinely useful teaching artifact.
      *Effort:* M

- [ ] **Display filters, not just protocol toggles.** A Wireshark-style filter
      expression (`ip.addr == 10.0.0.5 && tcp.port == 443`) over the live stream.
      A small parser, high payoff.
      *Effort:* L

- [ ] **Follow-stream view.** Group the packets belonging to one conversation and
      show them in order.
      *Effort:* M

## CIDR Calculator

- [ ] **IPv6 support.** The single biggest gap. Blocked on the wider v6 decision in
      [roadmap.md](roadmap.md) — the calculator shouldn't grow a v6 mode that the
      rest of the app can't model.
      *Effort:* L

- [ ] **Shareable permalink for a calculation.** Encode the input in the URL so a
      subnet plan can be pasted into a chat or a ticket.
      *Effort:* S · **good first issue**

- [ ] **VLSM planner.** Given a network and a list of required host counts, allocate
      the subnets. This is the actual homework problem the calculator is adjacent to
      but doesn't solve.
      *Effort:* M

## Admin & platform

- [ ] **Export/import a topology as a file.** Round-trips a network out of the app
      and back. Also makes bug reports reproducible — see [SUPPORT.md](../SUPPORT.md),
      which already asks people to attach one.
      *Where:* `application/src/services/config-export-service.ts` (partly exists)
      · *Effort:* S

- [ ] **Filterable audit log.** It's recorded and TTL-expired, but only listed. Filter
      by actor, action and date range.
      *Effort:* S · **good first issue**

- [ ] **Dark mode.** Frequently expected from a tool that engineers stare at.
      The UI already has a design system to hang it off.
      *Effort:* M
