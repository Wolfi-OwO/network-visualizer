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
function count(nodes: NetworkNode[], type: string) {
  return nodes.filter(n => n.type === type).length
}
function has(nodes: NetworkNode[], type: string) {
  return nodes.some(n => n.type === type)
}
function edgeBetweenTypes(nodes: NetworkNode[], edges: SimpleEdge[], a: string, b: string) {
  const typeOf = (id: string) => nodes.find(n => n.id === id)?.type
  return edges.some(e => {
    const s = typeOf(e.source), t = typeOf(e.target)
    return (s === a && t === b) || (s === b && t === a)
  })
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

  const tasks: Task[] = useMemo(() => {
    const connected = isConnected(nodes, edges)
    return [
      {
        id: 'cloud',
        label: 'Place the Internet ☁️',
        hint: 'Drag the ☁️ Cloud (from “Internet & Cloud”) onto the canvas. This is the public Internet that TechCorp connects out to — just like your real ISP/WAN.',
        done: has(nodes, 'cloud') || has(nodes, 'www') || has(nodes, 'isp'),
      },
      {
        id: 'globalDns',
        label: 'Add a global DNS resolver',
        hint: 'Drag a 🧭 DNS Server next to the cloud — a public resolver (think 8.8.8.8) that every site uses to turn names like www.techcorp.com into IP addresses.',
        done: has(nodes, 'dns'),
      },
      {
        id: 'routers',
        label: 'Add 3 routers (the backbone)',
        hint: 'Drag three 🔀 Routers. Each is the gateway for part of the company; together they route traffic between all four networks.',
        done: count(nodes, 'router') >= 3,
      },
      {
        id: 'backbone',
        label: 'Interconnect the routers',
        hint: 'Draw links *between* the routers (at least 2 router↔router links) so they form a backbone and can route between the networks.',
        done: edgesAmongType(nodes, edges, 'router') >= 2,
      },
      {
        id: 'uplink',
        label: 'Connect the edge router to the Internet',
        hint: 'Draw a link from one router (your edge/border router) to the ☁️ Cloud — that is TechCorp’s Internet uplink.',
        done: edgeBetweenTypes(nodes, edges, 'router', 'cloud') || edgeBetweenTypes(nodes, edges, 'router', 'www') || edgeBetweenTypes(nodes, edges, 'router', 'isp'),
      },
      {
        id: 'switches',
        label: 'Give each of the 4 networks a switch',
        hint: 'Drag four 🔁 L2 Switches — one per network (HQ, two branches, and the DMZ side) — and uplink each switch to a router.',
        done: count(nodes, 'switch') >= 4,
      },
      {
        id: 'pcs',
        label: 'Put 2 PCs in every network (8 total)',
        hint: 'Drag two 💻 Workstations into each network and cable them to that network’s switch — 8 PCs in all.',
        done: count(nodes, 'pc') >= 8,
      },
      {
        id: 'firewall',
        label: 'Add the DMZ firewall',
        hint: 'In your Internet-facing network, drag a 🛡️ Firewall and wire it to the edge router. It will guard the DMZ — the zone exposed to the outside world.',
        done: has(nodes, 'firewall') && (edgeBetweenTypes(nodes, edges, 'router', 'firewall') || edgeBetweenTypes(nodes, edges, 'firewall', 'cloud')),
      },
      {
        id: 'dmzServer',
        label: 'Put a public web server in the DMZ',
        hint: 'Drag a 🖥️ Server and link it to the 🛡️ Firewall — this is TechCorp’s public website, isolated from the internal LANs behind the firewall.',
        done: has(nodes, 'server') && edgeBetweenTypes(nodes, edges, 'firewall', 'server'),
      },
      {
        id: 'wire',
        label: 'Cable it all into one internetwork',
        hint: 'Make sure every device is reachable — switches to routers, routers to each other, PCs to switches, firewall+server in the DMZ. No islands!',
        done: nodes.length >= 18 && connected,
      },
      {
        id: 'config',
        label: 'Add a DNS record & a firewall rule',
        hint: 'Click the DNS server → DNS tab → add an A record (e.g. www.techcorp.com → the web server’s IP). Then click the Firewall → Firewall tab → add an allow rule for web traffic (TCP 443) into the DMZ.',
        done: dnsHasEntry(nodes) && firewallHasRule(nodes),
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
          <p>A real-world example: <b>TechCorp</b> has 4 office networks that all reach the Internet. You'll build it the way it actually works:</p>
          <ul className="list-disc list-inside space-y-0.5 text-[var(--text-secondary)]">
            <li><b>4 networks</b>, each with its own switch &amp; 2 PCs</li>
            <li><b>3 routers</b> forming a backbone that routes between them</li>
            <li>A <b>DMZ</b>: a firewall guarding a public web server</li>
            <li>An <b>Internet ☁️ uplink</b> + a <b>global DNS</b> (like 8.8.8.8)</li>
          </ul>
          <p className="text-[var(--text-muted)]">I'll check each step as you do it. Best to start from a blank canvas.</p>
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
                You've built a real enterprise internetwork: <b>4 networks</b> linked by a <b>3-router
                backbone</b>, a <b>DMZ</b> firewalling a public web server, an <b>Internet uplink</b> and
                a <b>global DNS</b>. Use <b>Send Packet</b> to route a host across the backbone, or turn on
                <b> Live</b> to watch DNS, web and inter-network traffic flow. Tip: add a DHCP server per
                network (or set static IPs) to bring every PC online. ✅
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
