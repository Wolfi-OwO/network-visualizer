# NetViz HTTP API Reference

The API is RESTful at Richardson Maturity Model level 3: plural resource URLs,
correct verbs and status codes (`201 Created` + `Location`, `204 No Content`),
and HATEOAS — every representation carries a `_links` map, and `GET /api` is
the discoverable entry point.

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

| Method | Path                       | Description                                                    |
| ------ | -------------------------- | -------------------------------------------------------------- |
| GET    | `/auth/providers`          | Which sign-in options are configured (`providers`, `devLogin`) |
| GET    | `/auth/me`                 | Current user, or `401` when not signed in                      |
| POST   | `/auth/dev-login`          | `{ email, name? }` — password-less local login (dev/self-host) |
| POST   | `/auth/logout`             | Clear the session cookie                                       |
| GET    | `/auth/google`             | Start the Google OAuth flow (full-page redirect)               |
| GET    | `/auth/google/callback`    | OAuth callback — sets the session, redirects to `/`            |
| GET    | `/auth/microsoft`          | Start the Microsoft OAuth flow                                 |
| GET    | `/auth/microsoft/callback` | OAuth callback                                                 |

## API root & health

| Method | Path         | Description                                        |
| ------ | ------------ | -------------------------------------------------- |
| GET    | `/api`       | Hypermedia entry point (`_links` to all resources) |
| GET    | `/health`    | Basic process health (status, uptime)              |
| GET    | `/api/live`  | Liveness probe (terminus)                          |
| GET    | `/api/ready` | Readiness probe (terminus)                         |

## Networks — `/api/networks`

Topology CRUD plus nodes, edges, traces, versions, validation, and config
export. Data is isolated per account (`viewer` is read-only; anonymous users
share the `local` workspace).

| Method | Path                                            | Description                                             |
| ------ | ----------------------------------------------- | ------------------------------------------------------- |
| GET    | `/api/networks`                                 | List the caller's topologies                            |
| POST   | `/api/networks`                                 | Create a topology → `201` + `Location`                  |
| GET    | `/api/networks/default`                         | The seeded demo topology                                |
| GET    | `/api/networks/:id`                             | Fetch one topology                                      |
| PUT    | `/api/networks/:id`                             | Replace/update a topology                               |
| DELETE | `/api/networks/:id`                             | Delete → `204`                                          |
| POST   | `/api/networks/:id/nodes`                       | Add a device                                            |
| PUT    | `/api/networks/:id/nodes/:nodeId`               | Update a device                                         |
| DELETE | `/api/networks/:id/nodes/:nodeId`               | Remove a device                                         |
| POST   | `/api/networks/:id/edges`                       | Add a link                                              |
| PUT    | `/api/networks/:id/edges/:edgeId`               | Update a link                                           |
| DELETE | `/api/networks/:id/edges/:edgeId`               | Remove a link                                           |
| POST   | `/api/networks/:id/traces`                      | Hop-by-hop packet trace (routing, ACLs, NAT, TTL, VLAN) |
| GET    | `/api/networks/:id/validation`                  | Topology validation report (e.g. duplicate IPs)         |
| GET    | `/api/networks/:id/config`                      | Export the whole topology configuration                 |
| GET    | `/api/networks/:id/nodes/:nodeId/config`        | Export one device's configuration                       |
| GET    | `/api/networks/:id/nodes/:nodeId/control-plane` | Device control-plane view (routing table, ARP, …)       |
| GET    | `/api/networks/:id/versions`                    | List saved snapshots                                    |
| POST   | `/api/networks/:id/versions`                    | Snapshot the current topology                           |
| GET    | `/api/networks/:id/versions/:versionId`         | Fetch one snapshot                                      |
| POST   | `/api/networks/:id/versions/:versionId/restore` | Restore a snapshot                                      |

## Packet capture — `/api/packets`, `/api/capture`

| Method | Path                  | Description                                 |
| ------ | --------------------- | ------------------------------------------- |
| GET    | `/api/packets`        | Captured packets + statistics               |
| GET    | `/api/packets/stream` | Live packet stream (**Server-Sent Events**) |
| GET    | `/api/packets/:id`    | One packet (protocol tree, hex dump)        |
| DELETE | `/api/packets`        | Clear the capture buffer                    |
| GET    | `/api/capture`        | Capture state + per-protocol toggles        |
| PATCH  | `/api/capture`        | Start/stop capture, toggle protocols        |

## CIDR tools — `/api/cidr`

| Method | Path                        | Description                                     |
| ------ | --------------------------- | ----------------------------------------------- |
| GET    | `/api/cidr`                 | Tool index (`_links` to the calculators)        |
| POST   | `/api/cidr/calculations`    | Subnet math (network, broadcast, hosts, binary) |
| POST   | `/api/cidr/subnets`         | Split a network into subnets                    |
| POST   | `/api/cidr/supernets`       | Route summarization / supernet                  |
| GET    | `/api/cidr/validations/:ip` | Validate an IP address                          |

## Administration (role `admin`)

| Method | Path             | Description                                          |
| ------ | ---------------- | ---------------------------------------------------- |
| GET    | `/api/users`     | List accounts + valid roles                          |
| PATCH  | `/api/users/:id` | `{ role }` — change a role (last admin is protected) |
| DELETE | `/api/users/:id` | Remove an account → `204`                            |
| GET    | `/api/metrics`   | System metrics (uptime, memory, requests, DB counts) |
| GET    | `/api/audit`     | Audit log of mutating actions                        |

## Status — `/api/status`

| Method | Path          | Description                              |
| ------ | ------------- | ---------------------------------------- |
| GET    | `/api/status` | Public service status and uptime history |
