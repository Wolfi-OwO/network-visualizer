# 0003. Live packets stream over Server-Sent Events, not WebSockets

- **Status:** Accepted
- **Date:** 2026-07-11 (recorded retroactively; the decision predates this ADR)

## Context

The Packet Capture page is a Wireshark-style live feed: the server generates
synthetic traffic across 16+ protocols and the browser has to render it as it
happens. The Network Builder likewise animates many concurrent packets in real
time.

The data flow here is **strictly one-way**. The server produces packets; the
browser consumes them. The client does have controls — protocol on/off toggles,
starting and stopping a capture — but those are ordinary, infrequent REST calls,
not a stream.

## Options considered

- **Polling.** `GET /api/capture/packets` every N ms. Trivially simple and
  trivially bad: either the feed feels laggy or the request rate is absurd, and
  it makes "live" a lie.
- **WebSockets.** The reflex answer for anything real-time. Gives full duplex —
  which this feature does not need. Costs a protocol upgrade that some corporate
  proxies still mishandle, a second server-side protocol to secure and rate-limit
  alongside HTTP, and hand-rolled reconnection/backoff logic on the client.
- **Server-Sent Events.** One-way, server → client, over plain HTTP.

## Decision

Live packets stream over **SSE**. The capture route holds the response open and
writes events as the simulator produces them; the browser consumes them with the
native `EventSource` API.

## Consequences

**Bought:** SSE is just HTTP — it inherits the existing auth cookie, the existing
CORS allow-list, the existing rate limiting and the existing reverse-proxy setup,
with nothing new to configure. `EventSource` reconnects automatically after a drop,
with no client-side backoff code to write or get wrong. It works through the Azure
Container Apps ingress and through corporate proxies that break WebSocket upgrades.
And it matches the actual shape of the data: a one-way stream modelled as a
one-way stream.

**Cost:** No client → server channel on the stream, so anything the client wants
to *say* has to be a separate REST call (which is what the protocol toggles are —
and they are fine). Browsers cap concurrent HTTP/1.1 connections per origin
(~6), so a user with many tabs open on the same origin can starve themselves;
HTTP/2 makes this a non-issue and the production ingress speaks HTTP/2. SSE is
text-only — no binary frames — which is irrelevant here since packets are
serialized as JSON anyway.

**Revisit if:** the client ever needs to push high-frequency data *up* the same
channel — for example, if collaborative multi-user topology editing lands, where
every cursor move and node drag has to reach other users. That is a genuinely
duplex problem and SSE would be the wrong tool for it.
