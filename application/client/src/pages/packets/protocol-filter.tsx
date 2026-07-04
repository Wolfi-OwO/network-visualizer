import { Eye, EyeOff } from 'lucide-react'

// Canonical protocol set with display colors (matches packet row tints)
export const PROTOCOLS: { id: string; color: string }[] = [
  { id: 'HTTP', color: '#3fb950' },
  { id: 'TLS',  color: '#ffa657' },
  { id: 'DNS',  color: '#58a6ff' },
  { id: 'mDNS', color: '#79c0ff' },
  { id: 'DHCP', color: '#2dd4bf' },
  { id: 'ARP',  color: '#bc8cff' },
  { id: 'ICMP', color: '#f85149' },
  { id: 'TCP',  color: '#8b949e' },
  { id: 'UDP',  color: '#d29922' },
  { id: 'STP',  color: '#e3b341' },
  { id: 'NTP',  color: '#56d4dd' },
  { id: 'LLDP', color: '#a371f7' },
  { id: 'SNMP', color: '#f778ba' },
  { id: 'OSPF', color: '#3fb950' },
  { id: 'SSDP', color: '#9ca3af' },
  { id: 'SIP',  color: '#ff7b72' },
]

interface ProtocolFilterProps {
  counts: Record<string, number>          // protocol -> live count
  hidden: Set<string>                      // protocols turned OFF
  onToggle: (proto: string) => void
  onAll: () => void
  onNone: () => void
}

export default function ProtocolFilter({ counts, hidden, onToggle, onAll, onNone }: ProtocolFilterProps) {
  // Show canonical protocols plus any unexpected ones that actually appeared
  const extra = Object.keys(counts).filter(p => !PROTOCOLS.some(c => c.id === p))
  const all = [...PROTOCOLS, ...extra.map(id => ({ id, color: '#8b949e' }))]

  return (
    <div className="relative shrink-0">
      <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--bg-900)] border-b border-[var(--border)] overflow-x-auto">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] shrink-0 mr-1">
        Protocols
      </span>

      <button onClick={onAll} className="text-[10px] px-1.5 py-0.5 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-700)] shrink-0 flex items-center gap-1" title="Show all">
        <Eye size={10} /> All
      </button>
      <button onClick={onNone} className="text-[10px] px-1.5 py-0.5 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-700)] shrink-0 flex items-center gap-1" title="Hide all">
        <EyeOff size={10} /> None
      </button>

      <div className="w-px h-4 bg-[var(--border)] mx-0.5 shrink-0" />

      {all.map(({ id, color }) => {
        const on = !hidden.has(id)
        const count = counts[id] ?? 0
        return (
          <button
            key={id}
            onClick={() => onToggle(id)}
            title={`${on ? 'Hide' : 'Show'} ${id}`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono whitespace-nowrap shrink-0 transition-all border"
            style={{
              background: on ? `${color}22` : 'transparent',
              borderColor: on ? `${color}66` : 'var(--border)',
              color: on ? color : 'var(--text-muted)',
              opacity: on ? 1 : 0.5,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: on ? color : 'var(--bg-600)' }}
            />
            {id}
            {count > 0 && (
              <span className="opacity-70">{count > 999 ? `${(count / 1000).toFixed(1)}k` : count}</span>
            )}
          </button>
        )
      })}
      </div>
      {/* Edge fades hint that the strip scrolls horizontally */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[var(--bg-900)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--bg-900)] to-transparent" />
    </div>
  )
}
