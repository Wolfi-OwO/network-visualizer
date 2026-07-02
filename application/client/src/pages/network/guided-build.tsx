import { useMemo, useState } from 'react'
import { X, CheckCircle2, Circle, ChevronDown, ChevronUp, Hammer, PartyPopper, Eraser } from 'lucide-react'
import type { NetworkNode } from '../../types/index.ts'

interface SimpleEdge { source: string; target: string }

interface GuidedBuildProps {
  active: boolean
  nodes: NetworkNode[]
  edges: SimpleEdge[]
  onClearCanvas: () => void
  onClose: () => void
}

// ── Topology helpers ─────────────────────────────────────────────────────────
const INTERNET_TYPES = ['cloud', 'isp', 'www']
const ENDPOINT_TYPES = ['pc', 'laptop', 'phone', 'printer', 'iot']

function count(nodes: NetworkNode[], type: string) {
  return nodes.filter(n => n.type === type).length
}
function has(nodes: NetworkNode[], type: string) {
  return nodes.some(n => n.type === type)
}
function edgeBetweenTypes(nodes: NetworkNode[], edges: SimpleEdge[], a: string | string[], b: string | string[]) {
  const A = Array.isArray(a) ? a : [a]
  const B = Array.isArray(b) ? b : [b]
  const typeOf = (id: string) => nodes.find(n => n.id === id)?.type ?? ''
  return edges.some(e => {
    const s = typeOf(e.source), t = typeOf(e.target)
    return (A.includes(s) && B.includes(t)) || (B.includes(s) && A.includes(t))
  })
}
// Number of links with one end in `a` types and the other in `b` types
function edgesBetweenCount(nodes: NetworkNode[], edges: SimpleEdge[], a: string[], b: string[]) {
  const typeOf = (id: string) => nodes.find(n => n.id === id)?.type ?? ''
  return edges.filter(e => {
    const s = typeOf(e.source), t = typeOf(e.target)
    return (a.includes(s) && b.includes(t)) || (b.includes(s) && a.includes(t))
  }).length
}
// Endpoints that hold an address (i.e. successfully leased one via DHCP)
function clientsOnline(nodes: NetworkNode[]) {
  return nodes.filter(n => ENDPOINT_TYPES.includes(n.type) && n.config.interfaces?.[0]?.ipAddress).length
}
function isConnected(nodes: NetworkNode[], edges: SimpleEdge[]) {
  if (nodes.length < 2) return false
  const adj = new Map<string, string[]>()
  nodes.forEach(n => adj.set(n.id, []))
  edges.forEach(e => { adj.get(e.source)?.push(e.target); adj.get(e.target)?.push(e.source) })
  const seen = new Set<string>([nodes[0].id])
  const queue = [nodes[0].id]
  while (queue.length) {
    const cur = queue.shift()!
    for (const nb of adj.get(cur) ?? []) {
      if (!seen.has(nb)) { seen.add(nb); queue.push(nb) }
    }
  }
  return seen.size === nodes.length
}
function dnsHasEntry(nodes: NetworkNode[]) {
  return nodes.some(n => n.type === 'dns' && (n.config.dns?.records?.length ?? 0) >= 1)
}
// Number of links whose BOTH ends are the given type (e.g. router↔router backbone)
function edgesAmongType(nodes: NetworkNode[], edges: SimpleEdge[], type: string) {
  const typeOf = (id: string) => nodes.find(n => n.id === id)?.type
  return edges.filter(e => typeOf(e.source) === type && typeOf(e.target) === type).length
}
function firewallHasRule(nodes: NetworkNode[]) {
  return nodes.some(n => n.type === 'firewall' && (n.config.firewallRules?.length ?? 0) >= 1)
}

interface Task {
  id: string
  label: string
  hint: string
  done: boolean
}

export default function GuidedBuild({ active, nodes, edges, onClearCanvas, onClose }: GuidedBuildProps) {
  const [phase, setPhase] = useState<'intro' | 'tasks'>('intro')
  const [collapsed, setCollapsed] = useState(false)

  // Build TechCorp HQ the way real enterprise networks are layered, from the
  // outside in:
  //   Internet ↔ edge router ↔ perimeter firewall ↔ core switch ↔ access
  //   switch ↔ endpoints — the router terminates the ISP uplink and routes,
  //   the firewall behind it inspects everything entering the LAN, DHCP/DNS
  //   sit in the server segment, and the public web server gets its own
  //   firewall leg (the DMZ).
  const tasks: Task[] = useMemo(() => {
    const connected = isConnected(nodes, edges)
    return [
      {
        id: 'internet',
        label: 'Place the Internet',
        hint: 'Drag the Cloud (from "Internet & Cloud") onto the canvas — the public Internet your company connects out to, like your real ISP/WAN. Tip: put it at the top; you will build inward from the edge.',
        done: INTERNET_TYPES.some(t => has(nodes, t)),
      },
      {
        id: 'edge',
        label: 'Connect an edge router to the Internet',
        hint: 'Drag a Router and wire it to the Cloud. The edge router terminates the ISP uplink and handles the routing work (NAT, and in bigger networks BGP or multi-WAN) — so the firewall behind it can focus purely on inspection.',
        done: has(nodes, 'router') && edgeBetweenTypes(nodes, edges, 'router', INTERNET_TYPES),
      },
      {
        id: 'perimeter',
        label: 'Add the perimeter firewall behind the router',
        hint: 'Drag a Firewall and link it to the Router (its LAN side, not the Cloud). Everything entering or leaving your network flows router → firewall, so every packet is inspected before it can reach any internal device.',
        done: has(nodes, 'firewall') && edgeBetweenTypes(nodes, edges, 'firewall', 'router'),
      },
      {
        id: 'core',
        label: 'Uplink a core switch to the firewall',
        hint: 'Drag an L2 Switch and connect it to the Firewall — the firewall’s inside interface. The entire LAN lives behind the firewall: the core switch is its center, with servers and access switches hanging off it.',
        done: has(nodes, 'switch') && edgeBetweenTypes(nodes, edges, 'switch', 'firewall'),
      },
      {
        id: 'services',
        label: 'Add DHCP + DNS to the server segment',
        hint: 'Drag a DHCP Server and a DNS Server and cable both to the core switch. Real sites keep infrastructure services in a server VLAN at the core — DHCP hands out addresses, DNS resolves names.',
        done: has(nodes, 'dhcp') && has(nodes, 'dns')
          && edgeBetweenTypes(nodes, edges, 'switch', 'dhcp')
          && edgeBetweenTypes(nodes, edges, 'switch', 'dns'),
      },
      {
        id: 'access',
        label: 'Add an access switch for the office',
        hint: 'Drag a second L2 Switch and uplink it to the core switch. Endpoints never plug into the core directly — the access layer fans out to desks, the core interconnects.',
        done: count(nodes, 'switch') >= 2 && edgesAmongType(nodes, edges, 'switch') >= 1,
      },
      {
        id: 'endpoints',
        label: 'Cable 3 office devices to the access switch',
        hint: 'Drag three endpoints (PCs, a laptop, a printer — your choice) and wire each one to a switch. They arrive powered off and without an address, just like unboxed hardware.',
        done: ENDPOINT_TYPES.reduce((a, t) => a + count(nodes, t), 0) >= 3
          && edgesBetweenCount(nodes, edges, ENDPOINT_TYPES, ['switch']) >= 3,
      },
      {
        id: 'dmz',
        label: 'Publish a web server in the DMZ',
        hint: 'Drag a Server and link it directly to the Firewall — a separate firewall leg. That is a DMZ: reachable from the Internet through firewall rules, but isolated from the internal LAN.',
        done: has(nodes, 'server') && edgeBetweenTypes(nodes, edges, 'firewall', 'server'),
      },
      {
        id: 'wire',
        label: 'One connected network — no islands',
        hint: 'Check every device is reachable: endpoints → access switch → core switch → firewall → edge router → Internet, servers on the core, web server on the firewall.',
        done: nodes.length >= 11 && connected,
      },
      {
        id: 'config',
        label: 'Add a firewall rule & a DNS record',
        hint: 'Click the Firewall → Firewall tab → add an allow rule for web traffic (TCP 443) to the DMZ server. Then click the DNS server → DNS tab → add an A record (e.g. www.techcorp.com → the web server’s IP).',
        done: dnsHasEntry(nodes) && firewallHasRule(nodes),
      },
      {
        id: 'online',
        label: 'Power on and watch DHCP bring hosts online',
        hint: 'Power on the infrastructure first — switches, router, firewall, DHCP server (the power button on each device) — then the endpoints. Each one broadcasts a real DORA exchange (Discover, Offer, Request, ACK) and receives its address. Get at least 2 endpoints online.',
        done: clientsOnline(nodes) >= 2,
      },
    ]
  }, [nodes, edges])

  if (!active) return null

  const doneCount = tasks.filter(t => t.done).length
  const allDone = doneCount === tasks.length
  const currentId = tasks.find(t => !t.done)?.id
  const pct = Math.round((doneCount / tasks.length) * 100)

  // ── Intro card ──────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div style={panelStyle}>
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)]">
          <Hammer size={14} className="text-[var(--accent)]" />
          <span className="text-[12px] font-semibold text-[var(--text-primary)] flex-1">Hands-on: Build TechCorp's network</span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
        </div>
        <div className="px-3 py-3 text-[12px] leading-relaxed text-[var(--text-secondary)] space-y-2">
          <p>Build <b>TechCorp HQ</b> exactly the way real enterprise sites are layered, from the Internet edge inward:</p>
          <p className="font-mono text-[10px] text-[var(--text-secondary)] leading-relaxed">
            Internet ↔ Edge router ↔ Firewall ↔ Core switch ↔ Access switch ↔ Desks
          </p>
          <ul className="list-disc list-inside space-y-0.5 text-[var(--text-secondary)]">
            <li>An <b>edge router</b> on the ISP uplink handling the routing</li>
            <li>A <b>perimeter firewall</b> behind it inspecting all LAN traffic</li>
            <li><b>DHCP + DNS</b> in the server segment on the core switch</li>
            <li>An <b>access switch</b> fanning out to PCs, laptop, printer</li>
            <li>A <b>DMZ</b>: the public web server on its own firewall leg</li>
            <li>Finally: rules, records, and <b>powering it all on</b> (DHCP DORA)</li>
          </ul>
          <p className="text-[var(--text-muted)]">Each step is checked as you complete it. Best to start from a blank canvas.</p>
        </div>
        <div className="flex gap-2 px-3 py-2.5 border-t border-[var(--border)]">
          <button
            onClick={() => { onClearCanvas(); setPhase('tasks') }}
            className="btn-primary flex-1 justify-center text-[11px]"
          >
            <Eraser size={12} /> Clear &amp; start building
          </button>
          <button onClick={() => setPhase('tasks')} className="btn-ghost text-[11px]">Use current canvas</button>
        </div>
      </div>
    )
  }

  // ── Task checklist ────────────────────────────────────────────────────────
  return (
    <div style={panelStyle}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--border)]">
        {allDone ? <PartyPopper size={14} className="text-[var(--green)]" /> : <Hammer size={14} className="text-[var(--accent)]" />}
        <span className="text-[12px] font-semibold text-[var(--text-primary)] flex-1">
          {allDone ? 'Network complete!' : 'Build your network'}
        </span>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">{doneCount}/{tasks.length}</span>
        <button onClick={() => setCollapsed(c => !c)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[var(--bg-800)]">
        <div className="h-full transition-all duration-300" style={{ width: `${pct}%`, background: allDone ? 'var(--green)' : 'var(--accent)' }} />
      </div>

      {!collapsed && (
        <div className="px-2 py-2 max-h-[50vh] overflow-y-auto">
          {tasks.map((t, i) => {
            const isCurrent = t.id === currentId
            return (
              <div
                key={t.id}
                className={[
                  'rounded-md px-2 py-1.5 transition-colors',
                  isCurrent ? 'bg-[rgba(88,166,255,0.08)] border border-[var(--accent)]/40' : 'border border-transparent',
                ].join(' ')}
              >
                <div className="flex items-center gap-2">
                  {t.done
                    ? <CheckCircle2 size={14} className="text-[var(--green)] shrink-0" />
                    : <Circle size={14} className={`shrink-0 ${isCurrent ? 'text-[var(--accent)]' : 'text-[var(--bg-600)]'}`} />}
                  <span className={[
                    'text-[11px] font-medium',
                    t.done ? 'text-[var(--text-muted)] line-through' : isCurrent ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                  ].join(' ')}>
                    {i + 1}. {t.label}
                  </span>
                </div>
                {isCurrent && (
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mt-1 ml-6">{t.hint}</p>
                )}
              </div>
            )
          })}

          {allDone && (
            <div className="mt-2 p-2.5 rounded-md bg-[rgba(63,185,80,0.1)] border border-[var(--green)]/40">
              <div className="text-[11px] font-semibold text-[var(--green)] flex items-center gap-1.5">
                <PartyPopper size={13} /> TechCorp is online!
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                You've built a site the way it's really wired: desks on an <b>access switch</b>, servers
                on the <b>core</b>, a <b>perimeter firewall</b> guarding the LAN behind the <b>edge
                router</b>, and a <b>DMZ</b> web server on its own firewall leg. Use <b>Send Packet</b> to
                trace a PC out to the Internet (watch it cross the firewall, then the edge router), or
                send TCP 443 from the Cloud to the DMZ server to see your allow rule fire. Turn on
                <b> Live</b> to watch DNS lookups and web traffic flow across the layers.
              </p>
              <button onClick={onClose} className="btn-success w-full justify-center text-[11px] mt-2">Finish</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  width: 300,
  zIndex: 40,
  background: 'var(--bg-900)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  overflow: 'hidden',
}
