// HATEOAS helpers — Richardson Maturity Model level 3. Every resource response
// carries a `_links` map so clients can discover related resources/actions.

export interface Link {
  href: string
  /** HTTP method for non-GET affordances (omitted ⇒ GET) */
  method?: string
}
export type Links = Record<string, Link>

export const API_BASE = '/api'

/** Attach a `_links` map to a resource representation. */
export function withLinks<T extends object>(resource: T, links: Links): T & { _links: Links } {
  return { ...resource, _links: links }
}

// ── Per-resource link builders ────────────────────────────────────────────────
export function apiRootLinks(): Links {
  return {
    self: { href: API_BASE },
    networks: { href: `${API_BASE}/networks` },
    packets: { href: `${API_BASE}/packets` },
    capture: { href: `${API_BASE}/capture` },
    cidr: { href: `${API_BASE}/cidr` },
    ready: { href: `${API_BASE}/ready` },
    live: { href: `${API_BASE}/live` },
  }
}

export function networksCollectionLinks(): Links {
  return {
    self: { href: `${API_BASE}/networks` },
    default: { href: `${API_BASE}/networks/default` },
    create: { href: `${API_BASE}/networks`, method: 'POST' },
  }
}

export function topologyLinks(id: string): Links {
  const base = `${API_BASE}/networks/${id}`
  return {
    self: { href: base },
    nodes: { href: `${base}/nodes`, method: 'POST' },
    edges: { href: `${base}/edges`, method: 'POST' },
    traces: { href: `${base}/traces`, method: 'POST' },
    update: { href: base, method: 'PUT' },
    delete: { href: base, method: 'DELETE' },
    collection: { href: `${API_BASE}/networks` },
  }
}

export function captureLinks(): Links {
  return {
    self: { href: `${API_BASE}/capture` },
    update: { href: `${API_BASE}/capture`, method: 'PATCH' },
    packets: { href: `${API_BASE}/packets` },
    stream: { href: `${API_BASE}/packets/stream` },
    clear: { href: `${API_BASE}/packets`, method: 'DELETE' },
  }
}

export function packetsCollectionLinks(): Links {
  return {
    self: { href: `${API_BASE}/packets` },
    stream: { href: `${API_BASE}/packets/stream` },
    capture: { href: `${API_BASE}/capture` },
    clear: { href: `${API_BASE}/packets`, method: 'DELETE' },
  }
}

export function packetLinks(id: number): Links {
  return {
    self: { href: `${API_BASE}/packets/${id}` },
    collection: { href: `${API_BASE}/packets` },
  }
}

export function cidrRootLinks(): Links {
  return {
    self: { href: `${API_BASE}/cidr` },
    calculations: { href: `${API_BASE}/cidr/calculations`, method: 'POST' },
    subnets: { href: `${API_BASE}/cidr/subnets`, method: 'POST' },
    supernets: { href: `${API_BASE}/cidr/supernets`, method: 'POST' },
  }
}
