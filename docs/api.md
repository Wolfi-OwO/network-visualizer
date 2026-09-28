# NetViz HTTP API Reference

The API is RESTful at Richardson Maturity Model level 3: plural resource URLs,
correct verbs and status codes (`201 Created` + `Location`, `204 No Content`),
and HATEOAS.

**Conventions that apply to every endpoint below:**

- Every JSON response carries a `_links` map — the affordances available from
  that representation — **except** binary/attachment/text-plain downloads
  (`GET /api/me/export`, `GET /api/networks/:id/config`,
  `GET /api/networks/:id/nodes/:nodeId/config`) and `204 No Content` responses,
  which have no body to attach links to.
- `GET /api` is the entry point: start there and follow `_links` rather than
  hard-coding paths.
- Every route answers `HEAD` (200, empty body) and a real `OPTIONS` — a
  per-route `Allow` header listing the methods that path actually supports,
  or a genuine `404` if the path doesn't exist. (Before this was fixed, the
  global CORS middleware swallowed every `OPTIONS` request with a blanket
  `204` and no `Allow` header, on every path including ones that don't exist.)
- `self` only appears on a resource when a matching `GET` route actually
  exists for it — a node/edge, for instance, has no dedicated `GET` route, so
  its representation links `update`/`delete`/`topology` but never `self`.

- Base URL: the origin the app is served at (same origin as the SPA).
- Errors are JSON: `{ "error": { "message": "...", "status": 4xx } }`.
- Authentication: a signed JWT session cookie (set by the `/auth` flows), or
  `Authorization: Bearer <token>`. Rate limits apply separately to `/auth` and
  `/api`.

## Roles

| Role      | Access                                                         |
| --------- | -------------------------------------------------------------- |
| anonymous | Shared `local` workspace (disabled when `REQUIRE_AUTH=true`)   |
| `viewer`  | Read-only: mutating methods are rejected on network data       |
| `editor`  | Full CRUD on their own networks (the default for new accounts) |
| `admin`   | Everything, plus `/api/users`, `/api/metrics`, `/api/audit`    |

See [organizational/roles-and-permissions.md](../organizational/roles-and-permissions.md).

## Authentication — `/auth`

Sign-in is a browser redirect flow, so it lives outside the `/api` prefix.
OAuth redirect URIs are derived from the request host — register
`<public URL>/auth/<provider>/callback` with the provider.

### `GET /auth/providers`

Which sign-in options are configured.

```http
GET /auth/providers
```

```json
{
  "providers": ["google", "microsoft"],
  "devLogin": false,
  "_links": { "self": { "href": "/auth/providers" } }
}
```

### `GET /auth/me`

Current user, or `401` when not signed in.

```http
GET /auth/me
Cookie: netviz_session=<jwt>
```

```json
{
  "id": "6f6b6e2d-2f9d-4b4a-9b8a-5e7a2b6b9a10",
  "email": "alice@example.com",
  "name": "Alice",
  "role": "editor",
  "provider": "google",
  "_links": {
    "self": { "href": "/auth/me" },
    "logout": { "href": "/auth/logout", "method": "POST" },
    "export": { "href": "/api/me/export" }
  }
}
```

### `POST /auth/dev-login`

Password-less local login (dev/self-host only, gated by `ALLOW_DEV_LOGIN`).

```http
POST /auth/dev-login
Content-Type: application/json

{ "email": "alice@example.com", "name": "Alice" }
```

```json
{
  "id": "6f6b6e2d-2f9d-4b4a-9b8a-5e7a2b6b9a10",
  "email": "alice@example.com",
  "name": "Alice",
  "role": "editor",
  "provider": "local",
  "_links": { "root": { "href": "/api" } }
}
```

### `POST /auth/logout`

Clears the session cookie.

```http
POST /auth/logout
```

```json
{ "ok": true, "_links": { "root": { "href": "/api" } } }
```

### `GET /auth/google` / `GET /auth/microsoft`

Starts the corresponding OAuth flow (a `302` redirect to the provider). `400`
if that provider isn't configured.

### `GET /auth/google/callback` / `GET /auth/microsoft/callback`

OAuth callback — exchanges the code, sets the session cookie, and redirects
to `/`. On failure it redirects to `/login?error=...` instead of a JSON error,
since the browser is mid-redirect at this point.

## API root & health

### `GET /api`

The hypermedia entry point — start here.

```http
GET /api
```

```json
{
  "name": "NetViz API",
  "version": 1,
  "_links": {
    "self": { "href": "/api" },
    "networks": { "href": "/api/networks" },
    "packets": { "href": "/api/packets" },
    "capture": { "href": "/api/capture" },
    "cidr": { "href": "/api/cidr" },
    "auth": { "href": "/auth/me" },
    "providers": { "href": "/auth/providers" },
    "users": { "href": "/api/users" },
    "me": { "href": "/api/me/export" },
    "audit": { "href": "/api/audit" },
    "metrics": { "href": "/api/metrics" },
    "ready": { "href": "/api/ready" },
    "live": { "href": "/api/live" }
  }
}
```

### `GET /health`

Basic process health, no auth required.

```json
{ "status": "ok", "uptime": 1234.5, "timestamp": "2026-09-28T12:00:00.000Z" }
```

### `GET /api/live` (alias `/livez`) / `GET /api/ready` (alias `/readyz`)

Kubernetes-style liveness/readiness probes, attached directly to the HTTP
server by `terminus` — they run before Express's own routing (including the
SPA catch-all), so a `200` here means the process, not just some fallback
page, actually answered. `/api/ready` returns non-2xx while MongoDB is
disconnected or still connecting; `/api/live` only checks the process is up.
No response body, no `_links` — these are infrastructure probes, not API
resources.

## Networks — `/api/networks`

Topology CRUD plus nodes, edges, traces, versions, validation, and config
export. Data is isolated per account (`viewer` is read-only; anonymous users
share the `local` workspace).

### `GET /api/networks`

List the caller's topologies.

```json
{
  "_links": {
    "self": { "href": "/api/networks" },
    "default": { "href": "/api/networks/default" },
    "create": { "href": "/api/networks", "method": "POST" }
  },
  "count": 1,
  "items": [
    {
      "id": "0b7e...c1",
      "name": "Demo network",
      "nodes": [],
      "edges": [],
      "createdAt": 1732000000000,
      "updatedAt": 1732000000000,
      "_links": {
        "self": { "href": "/api/networks/0b7e...c1" },
        "nodes": { "href": "/api/networks/0b7e...c1/nodes", "method": "POST" },
        "edges": { "href": "/api/networks/0b7e...c1/edges", "method": "POST" },
        "traces": { "href": "/api/networks/0b7e...c1/traces", "method": "POST" },
        "update": { "href": "/api/networks/0b7e...c1", "method": "PUT" },
        "delete": { "href": "/api/networks/0b7e...c1", "method": "DELETE" },
        "collection": { "href": "/api/networks" }
      }
    }
  ]
}
```

### `POST /api/networks`

Create a topology -> `201` + `Location`.

```http
POST /api/networks
Content-Type: application/json

{ "name": "Branch office", "description": "3-router WAN test" }
```

Response: `201`, `Location: /api/networks/<id>`, body is the created topology
in the same shape as one `items[]` entry above (with `_links`).

### `GET /api/networks/default`

The seeded demo topology (created on first access per owner).

### `GET /api/networks/:id`

Fetch one topology (same shape as above). `404` if it doesn't exist or isn't
owned by the caller.

### `PUT /api/networks/:id`

Replace `name`/`description`/`nodes`/`edges`. Any `_links` present on
incoming `nodes`/`edges` elements (e.g. a client round-tripping a previous
`GET` or node/edge response) are stripped before the write — `nodes`/`edges`
are untyped `Mixed` fields in MongoDB, so anything not stripped would be
saved verbatim.

```http
PUT /api/networks/0b7e...c1
Content-Type: application/json

{
  "nodes": [
    { "id": "n1", "type": "pc", "label": "PC-1", "position": { "x": 0, "y": 0 }, "config": {} }
  ],
  "edges": []
}
```

`400` if `nodes`/`edges` don't match the required shape.

### `DELETE /api/networks/:id`

Delete -> `204`.

### `POST /api/networks/:id/nodes`

Add a device -> `201` + `Location`. No `self` link (no dedicated `GET` route
for a single node); any `_links` sent in the body are stripped before saving.

```http
POST /api/networks/0b7e...c1/nodes
Content-Type: application/json

{ "type": "router", "label": "R1", "position": { "x": 100, "y": 40 }, "config": {} }
```

```json
{
  "id": "3f2a...9d",
  "type": "router",
  "label": "R1",
  "position": { "x": 100, "y": 40 },
  "config": {},
  "_links": {
    "update": { "href": "/api/networks/0b7e...c1/nodes/3f2a...9d", "method": "PUT" },
    "delete": { "href": "/api/networks/0b7e...c1/nodes/3f2a...9d", "method": "DELETE" },
    "topology": { "href": "/api/networks/0b7e...c1" }
  }
}
```

### `PUT /api/networks/:id/nodes/:nodeId`

Update a device (same `_links` shape as create). `404` if the node doesn't
exist.

### `DELETE /api/networks/:id/nodes/:nodeId`

Remove a device (and any edges attached to it) -> `204`.

### `POST /api/networks/:id/edges`

Add a link -> `201` + `Location`. Same `_links`/strip behaviour as nodes.

```json
{ "source": "n1", "target": "3f2a...9d", "config": {} }
```

### `PUT /api/networks/:id/edges/:edgeId` / `DELETE /api/networks/:id/edges/:edgeId`

Update or remove a link. Update returns the same `update`/`delete`/`topology`
`_links` as an edge create; delete returns `204`.

### `POST /api/networks/:id/traces`

Hop-by-hop packet trace (routing, ACLs, NAT, TTL, VLAN) -> `201`.

```http
POST /api/networks/default/traces
Content-Type: application/json

{ "srcNodeId": "n1", "dstNodeId": "n2", "protocol": "icmp" }
```

```json
{
  "hops": [{ "nodeId": "n1", "action": "forward", "interface": "eth0" }],
  "outcome": "delivered",
  "_links": {
    "self": { "href": "/api/networks/default/traces" },
    "topology": { "href": "/api/networks/default" }
  }
}
```

### `GET /api/networks/:id/validation`

Topology validation report (duplicate IPs/MACs, missing gateways, isolated
nodes, shadowed firewall rules, …).

```json
{
  "ok": false,
  "counts": { "error": 1, "warning": 0, "info": 2 },
  "checks": 12,
  "findings": [
    {
      "id": "dup-ip-1",
      "severity": "error",
      "category": "addressing",
      "message": "Duplicate IP 10.0.0.1 on PC-1 and Server-1",
      "nodeId": "n1"
    }
  ],
  "_links": {
    "self": { "href": "/api/networks/0b7e...c1/validation" },
    "topology": { "href": "/api/networks/0b7e...c1" }
  }
}
```

### `GET /api/networks/:id/config`

Export the whole topology as Cisco-style running-config. `Content-Type:
text/plain` — a config bundle, not a hypermedia resource, so no `_links`.

### `GET /api/networks/:id/nodes/:nodeId/config`

Export one device's running-config. Same `text/plain`, no `_links`.

### `GET /api/networks/:id/nodes/:nodeId/control-plane`

Device control-plane view (routing table, ARP, MAC table, DHCP leases, OSPF
neighbors, STP, ACLs, NAT — whichever apply to that device type).

```json
{
  "nodeId": "3f2a...9d",
  "type": "router",
  "hostname": "R1",
  "arp": [{ "ip": "10.0.0.2", "mac": "aa:bb:cc:00:00:02", "iface": "eth0", "type": "dynamic" }],
  "_links": {
    "self": { "href": "/api/networks/0b7e...c1/nodes/3f2a...9d/control-plane" },
    "node": { "href": "/api/networks/0b7e...c1/nodes/3f2a...9d" },
    "topology": { "href": "/api/networks/0b7e...c1" }
  }
}
```

### `GET /api/networks/:id/versions`

List saved snapshots, oldest first is not guaranteed — sorted newest first.

```json
{
  "_links": { "self": { "href": "/api/networks/0b7e...c1/versions" } },
  "count": 1,
  "items": [
    {
      "id": "v-1",
      "version": 1,
      "label": "before firewall change",
      "name": "Branch office",
      "nodeCount": 2,
      "edgeCount": 1,
      "createdAt": 1732000000000
    }
  ]
}
```

### `POST /api/networks/:id/versions`

Snapshot the current topology -> `201`.

```http
POST /api/networks/0b7e...c1/versions
Content-Type: application/json

{ "label": "before firewall change" }
```

```json
{
  "id": "v-1",
  "version": 1,
  "label": "before firewall change",
  "name": "Branch office",
  "nodeCount": 2,
  "edgeCount": 1,
  "createdAt": 1732000000000,
  "_links": {
    "self": { "href": "/api/networks/0b7e...c1/versions/v-1" },
    "collection": { "href": "/api/networks/0b7e...c1/versions" }
  }
}
```

### `GET /api/networks/:id/versions/:versionId`

Fetch one snapshot (a full topology as it looked at that point).

```json
{
  "id": "v-1",
  "name": "Branch office",
  "nodes": [],
  "edges": [],
  "createdAt": 1732000000000,
  "_links": {
    "self": { "href": "/api/networks/0b7e...c1/versions/v-1" },
    "restore": { "href": "/api/networks/0b7e...c1/versions/v-1/restore", "method": "POST" },
    "collection": { "href": "/api/networks/0b7e...c1/versions" }
  }
}
```

### `POST /api/networks/:id/versions/:versionId/restore`

Restore a snapshot back into the live topology (the current state is
snapshotted first, so a restore is never destructive). Returns the restored
topology in the same shape as `GET /api/networks/:id`.

## Packet capture — `/api/packets`, `/api/capture`

### `GET /api/packets`

Captured packets (collection). Supports `?since=<id>&limit=<n>`.

```json
{
  "_links": {
    "self": { "href": "/api/packets" },
    "stream": { "href": "/api/packets/stream" },
    "capture": { "href": "/api/capture" },
    "clear": { "href": "/api/packets", "method": "DELETE" }
  },
  "count": 1,
  "items": [
    {
      "id": 1,
      "timestamp": 1732000000000,
      "relativeTime": 0.12,
      "length": 74,
      "protocol": "ICMP",
      "info": "Echo (ping) request",
      "_links": {
        "self": { "href": "/api/packets/1" },
        "collection": { "href": "/api/packets" }
      }
    }
  ]
}
```

### `GET /api/packets/stream`

Live packet feed as **Server-Sent Events** (`text/event-stream`) — not JSON,
so no `_links`.

### `GET /api/packets/:id`

One packet, with protocol layers and hex dump.

```json
{
  "id": 1,
  "timestamp": 1732000000000,
  "protocol": "ICMP",
  "info": "Echo (ping) request",
  "ip": { "srcIp": "10.0.0.1", "dstIp": "10.0.0.2", "ttl": 64, "protocolName": "ICMP" },
  "icmp": { "type": 8, "typeName": "Echo Request", "code": 0 },
  "hexDump": ["0000  45 00 00 54 ...  E..T..."],
  "_links": {
    "self": { "href": "/api/packets/1" },
    "collection": { "href": "/api/packets" }
  }
}
```

`400` for a non-numeric `:id`, `404` if the packet isn't currently buffered.

### `DELETE /api/packets`

Clear the capture buffer -> `204`.

### `GET /api/capture`

Capture state + per-protocol toggles/statistics.

```json
{
  "capturing": false,
  "stats": { "total": 42, "byProtocol": { "ICMP": 10, "TCP": 32 } },
  "_links": {
    "self": { "href": "/api/capture" },
    "update": { "href": "/api/capture", "method": "PATCH" },
    "packets": { "href": "/api/packets" },
    "stream": { "href": "/api/packets/stream" },
    "clear": { "href": "/api/packets", "method": "DELETE" }
  }
}
```

### `PATCH /api/capture`

Start/stop capturing.

```http
PATCH /api/capture
Content-Type: application/json

{ "capturing": true }
```

Response: same shape as `GET /api/capture`, `400` if `capturing` isn't a
boolean.

## CIDR tools — `/api/cidr`

### `GET /api/cidr`

Tool index.

```json
{
  "_links": {
    "self": { "href": "/api/cidr" },
    "calculations": { "href": "/api/cidr/calculations", "method": "POST" },
    "subnets": { "href": "/api/cidr/subnets", "method": "POST" },
    "supernets": { "href": "/api/cidr/supernets", "method": "POST" },
    "validations": { "href": "/api/cidr/validations/{ip}", "templated": true }
  }
}
```

### `POST /api/cidr/calculations`

Subnet math for a single CIDR -> `201`.

```http
POST /api/cidr/calculations
Content-Type: application/json

{ "input": "10.0.0.0/24" }
```

```json
{
  "input": "10.0.0.0/24",
  "ipAddress": "10.0.0.0",
  "cidrPrefix": 24,
  "networkAddress": "10.0.0.0",
  "broadcastAddress": "10.0.0.255",
  "firstHost": "10.0.0.1",
  "lastHost": "10.0.0.254",
  "subnetMask": "255.255.255.0",
  "totalHosts": 256,
  "usableHosts": 254,
  "ipClass": "A",
  "isPrivate": true,
  "_links": {
    "self": { "href": "/api/cidr/calculations" },
    "cidr": { "href": "/api/cidr" }
  }
}
```

### `POST /api/cidr/subnets`

Split a network into subnets -> `201`.

```http
POST /api/cidr/subnets
Content-Type: application/json

{ "network": "10.0.0.0/24", "count": 4 }
```

```json
{
  "_links": { "self": { "href": "/api/cidr/subnets" }, "cidr": { "href": "/api/cidr" } },
  "count": 4,
  "items": [{ "networkAddress": "10.0.0.0", "cidrPrefix": 26 }]
}
```

### `POST /api/cidr/supernets`

Route summarization / supernet for 2+ networks -> `201`.

```http
POST /api/cidr/supernets
Content-Type: application/json

{ "networks": ["10.0.0.0/24", "10.0.1.0/24"] }
```

Response shape matches `POST /api/cidr/calculations`, describing the
resulting supernet.

### `GET /api/cidr/validations/:ip`

Validate whether a string is a well-formed IPv4 address.

```json
{
  "ip": "10.0.0.1",
  "valid": true,
  "_links": {
    "self": { "href": "/api/cidr/validations/10.0.0.1" },
    "cidr": { "href": "/api/cidr" }
  }
}
```

## Administration (role `admin`) — `/api/users`, `/api/metrics`, `/api/audit`

### `GET /api/users`

List accounts + valid roles.

```json
{
  "_links": { "self": { "href": "/api/users" } },
  "users": [{ "id": "6f6b...10", "email": "alice@example.com", "role": "editor" }],
  "roles": ["admin", "editor", "viewer"]
}
```

### `PATCH /api/users/:id`

Change a role (last admin is protected from demotion).

```http
PATCH /api/users/6f6b...10
Content-Type: application/json

{ "role": "viewer" }
```

```json
{
  "id": "6f6b...10",
  "email": "alice@example.com",
  "role": "viewer",
  "_links": {
    "update": { "href": "/api/users/6f6b...10", "method": "PATCH" },
    "delete": { "href": "/api/users/6f6b...10", "method": "DELETE" },
    "collection": { "href": "/api/users" }
  }
}
```

There is no `GET /api/users/:id` route, so this response never carries a
`self` link — only the affordances (`update`, `delete`, `collection`) that
actually resolve.

### `DELETE /api/users/:id`

Remove an account and everything it owns -> `204` (last admin is protected
from deletion).

### `GET /api/metrics`

System metrics — uptime, memory, request counts, DB counters.

```json
{
  "status": "ok",
  "requests": 4213,
  "database": { "connected": true, "topologies": 3 },
  "capture": { "capturing": false, "total": 42 },
  "_links": { "self": { "href": "/api/metrics" } }
}
```

### `GET /api/audit`

Audit log of mutating actions. Supports `?limit=<n>` (default 100, max 500).

```json
{
  "_links": { "self": { "href": "/api/audit" } },
  "count": 1,
  "items": [
    { "action": "network.update", "method": "PUT", "path": "/api/networks/0b7e...c1", "status": 200, "at": 1732000000000 }
  ]
}
```

## Self-service (GDPR) — `/api/me`

Distinct from `/api/users`, which is admin-only management of *other*
accounts — every route here acts on the caller's own account.

### `GET /api/me/export`

Everything this account holds, as a downloadable JSON file (Art. 15/20
DSGVO) — `Content-Disposition: attachment`, so this is intentionally left
without `_links`: it's a data export, not a browsable resource.

```json
{
  "exportedAt": "2026-09-28T12:00:00.000Z",
  "profile": { "id": "6f6b...10", "email": "alice@example.com", "role": "editor" },
  "networks": [],
  "auditLog": []
}
```

### `DELETE /api/me`

Permanently remove this account and everything it owns (Art. 17 DSGVO) ->
`204`. `400` if this is the last admin (refuses to lock the instance out).
