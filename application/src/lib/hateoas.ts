// HATEOAS helpers — Richardson Maturity Model level 3. Every resource response
// carries a `_links` map so clients can discover related resources/actions.

export interface Link {
  href: string;
  /** HTTP method for non-GET affordances (omitted => GET) */
  method?: string;
  /** href is a URI template (e.g. `/api/cidr/validations/{ip}`), not a concrete link */
  templated?: boolean;
}
export type Links = Record<string, Link>;

export const API_BASE = '/api';

/** Attach a `_links` map to a resource representation. */
export function withLinks<T extends object>(resource: T, links: Links): T & { _links: Links } {
  return { ...resource, _links: links };
}

// Nodes/edges are stored as untyped Mixed sub-documents (topology.model.ts), so
// anything sent back to a write endpoint is saved as-is. Node/edge responses
// carry `_links`, and the client can round-trip a previously-fetched
// node/edge object into a topology PUT — without stripping, `_links` would
// get written permanently into MongoDB. Strip on every incoming write instead
// of trusting every call site to remember not to persist a response shape.
// Operates on request bodies, which Express types as `any` and which every
// call site already runtime-validates (assertValidNodeBody etc.) — typing
// this as `any` in/out avoids fighting that with a generic that would just
// get cast back anyway.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripLinks(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  const { _links, ...rest } = value;
  return rest;
}

/** Same as `stripLinks`, applied to every element of an array. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripLinksAll(values: any[]): any[] {
  return values.map(stripLinks);
}

// ── Per-resource link builders ────────────────────────────────────────────────
export function apiRootLinks(): Links {
  return {
    self: { href: API_BASE },
    networks: { href: `${API_BASE}/networks` },
    packets: { href: `${API_BASE}/packets` },
    capture: { href: `${API_BASE}/capture` },
    cidr: { href: `${API_BASE}/cidr` },
    auth: { href: '/auth/me' },
    providers: { href: '/auth/providers' },
    users: { href: `${API_BASE}/users` },
    me: { href: `${API_BASE}/me/export` },
    audit: { href: `${API_BASE}/audit` },
    metrics: { href: `${API_BASE}/metrics` },
    ready: { href: `${API_BASE}/ready` },
    live: { href: `${API_BASE}/live` },
  };
}

export function networksCollectionLinks(): Links {
  return {
    self: { href: `${API_BASE}/networks` },
    default: { href: `${API_BASE}/networks/default` },
    create: { href: `${API_BASE}/networks`, method: 'POST' },
  };
}

export function topologyLinks(id: string): Links {
  const base = `${API_BASE}/networks/${id}`;
  return {
    self: { href: base },
    nodes: { href: `${base}/nodes`, method: 'POST' },
    edges: { href: `${base}/edges`, method: 'POST' },
    traces: { href: `${base}/traces`, method: 'POST' },
    update: { href: base, method: 'PUT' },
    delete: { href: base, method: 'DELETE' },
    collection: { href: `${API_BASE}/networks` },
  };
}

export function captureLinks(): Links {
  return {
    self: { href: `${API_BASE}/capture` },
    update: { href: `${API_BASE}/capture`, method: 'PATCH' },
    packets: { href: `${API_BASE}/packets` },
    stream: { href: `${API_BASE}/packets/stream` },
    clear: { href: `${API_BASE}/packets`, method: 'DELETE' },
  };
}

export function packetsCollectionLinks(): Links {
  return {
    self: { href: `${API_BASE}/packets` },
    stream: { href: `${API_BASE}/packets/stream` },
    capture: { href: `${API_BASE}/capture` },
    clear: { href: `${API_BASE}/packets`, method: 'DELETE' },
  };
}

export function packetLinks(id: number): Links {
  return {
    self: { href: `${API_BASE}/packets/${id}` },
    collection: { href: `${API_BASE}/packets` },
  };
}

export function cidrRootLinks(): Links {
  return {
    self: { href: `${API_BASE}/cidr` },
    calculations: { href: `${API_BASE}/cidr/calculations`, method: 'POST' },
    subnets: { href: `${API_BASE}/cidr/subnets`, method: 'POST' },
    supernets: { href: `${API_BASE}/cidr/supernets`, method: 'POST' },
    validations: { href: `${API_BASE}/cidr/validations/{ip}`, templated: true },
  };
}

export function cidrValidationLinks(ip: string): Links {
  return {
    self: { href: `${API_BASE}/cidr/validations/${ip}` },
    cidr: { href: `${API_BASE}/cidr` },
  };
}

// ── Auth ────────────────────────────────────────────────────────────────────
export function authProvidersLinks(): Links {
  return { self: { href: '/auth/providers' } };
}

export function authMeLinks(): Links {
  return {
    self: { href: '/auth/me' },
    logout: { href: '/auth/logout', method: 'POST' },
    export: { href: `${API_BASE}/me/export` },
  };
}

// Shared "back to the hypermedia root" link for auth actions that return no
// resource of their own (logout, dev-login).
export function authRootLinks(): Links {
  return { root: { href: API_BASE } };
}

// ── Users ─────────────────────────────────────────────────────────────────────
// No GET /api/users/:id route exists — only PATCH (role change) and DELETE —
// so a per-user response never gets a `self` link, only the affordances that
// actually resolve.
export function userLinks(id: string): Links {
  return {
    update: { href: `${API_BASE}/users/${id}`, method: 'PATCH' },
    delete: { href: `${API_BASE}/users/${id}`, method: 'DELETE' },
    collection: { href: `${API_BASE}/users` },
  };
}

// ── Versions ──────────────────────────────────────────────────────────────────
export function versionLinks(topologyId: string, versionId: string): Links {
  const base = `${API_BASE}/networks/${topologyId}/versions`;
  return {
    self: { href: `${base}/${versionId}` },
    restore: { href: `${base}/${versionId}/restore`, method: 'POST' },
    collection: { href: base },
  };
}

// ── Nodes / edges ─────────────────────────────────────────────────────────────
// No dedicated GET route exists for an individual node/edge, so these never
// carry `self` — only the affordances that actually resolve.
export function nodeWriteLinks(topologyId: string, nodeId: string): Links {
  const base = `${API_BASE}/networks/${topologyId}/nodes/${nodeId}`;
  return {
    update: { href: base, method: 'PUT' },
    delete: { href: base, method: 'DELETE' },
    topology: { href: `${API_BASE}/networks/${topologyId}` },
  };
}

export function edgeWriteLinks(topologyId: string, edgeId: string): Links {
  const base = `${API_BASE}/networks/${topologyId}/edges/${edgeId}`;
  return {
    update: { href: base, method: 'PUT' },
    delete: { href: base, method: 'DELETE' },
    topology: { href: `${API_BASE}/networks/${topologyId}` },
  };
}
