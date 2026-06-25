import { useMemo, useState } from 'react'
import { X, CheckCircle2, Circle, ChevronDown, ChevronUp, Hammer, PartyPopper, Eraser } from 'lucide-react'
import type { NetworkNode } from '../../types'

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
function dhcpConfigured(nodes: NetworkNode[]) {
  return nodes.some(n => {
    const d = n.config.dhcp
    return !!d && d.enabled && !!d.poolStart && !!d.poolEnd && !!d.gateway
  })
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
        id: 'router',
        label: 'Add a Router',
        hint: 'Drag the 🔀 Router from the palette onto the canvas — it will be the heart of your LAN.',
        done: has(nodes, 'router'),
      },
      {
        id: 'pcs',
        label: 'Add 2 desktop PCs',
        hint: 'Drag two 💻 PCs onto the canvas — these are your wired workstations.',
        done: count(nodes, 'pc') >= 2,
      },
      {
        id: 'ap',
        label: 'Add a Wi-Fi access point',
        hint: 'Drag a 📡 Wi-Fi AP onto the canvas — it bridges wireless clients into the LAN.',
        done: has(nodes, 'wifiap'),
      },
      {
        id: 'laptop',
        label: 'Add a laptop & connect it over Wi-Fi',
        hint: 'Drag a 3rd 💻 PC (your laptop), then drag a link from it to the 📡 Wi-Fi AP.',
        done: count(nodes, 'pc') >= 2 && count(nodes, 'laptop') >= 1 && edgeBetweenTypes(nodes, edges, 'laptop', 'wifiap'),
      },
      {
        id: 'dhcp',
        label: 'Add a DHCP server',
        hint: 'Drag the 📲 DHCP device onto the canvas — it will hand out IP addresses automatically.',
        done: has(nodes, 'dhcp'),
      },
      {
        id: 'wire',
        label: 'Cable everything into one network',
        hint: 'Drag links so the Router connects to both PCs, the Wi-Fi AP and the DHCP server (everything in one connected web).',
        done: nodes.length >= 6 && connected,
      },
      {
        id: 'config',
        label: 'Configure the DHCP scope',
        hint: 'Click the DHCP server → open the DHCP tab → enable it and set the pool start/end and gateway. This is what makes the network actually work.',
        done: dhcpConfigured(nodes),
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
          <span className="text-[12px] font-semibold text-[var(--text-primary)] flex-1">Hands-on: Build a working network</span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X size={14} /></button>
        </div>
        <div className="px-3 py-3 text-[12px] leading-relaxed text-[var(--text-secondary)] space-y-2">
          <p>You'll build a small office LAN step by step:</p>
          <ul className="list-disc list-inside space-y-0.5 text-[var(--text-secondary)]">
            <li>1 Router</li>
            <li>2 wired PCs</li>
            <li>1 laptop on Wi-Fi (PC + access point)</li>
            <li>1 DHCP server to make it all work</li>
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
                <PartyPopper size={13} /> Your network is functional!
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                Every device is wired into one LAN and the DHCP server is ready to lease addresses.
                Each connected host now <b>requests an IP automatically via DHCP</b> (watch the DORA
                packets). Use the <b>Send Packet</b> bar to watch traffic hop through the network. ✅
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
