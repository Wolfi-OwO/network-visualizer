import { useState } from 'react'
import { X, ChevronRight, ChevronDown, Trash2, Play, Pause, Layers } from 'lucide-react'
import type { PacketInfo } from './packet-model.ts'

interface PacketInspectorProps {
  packets: PacketInfo[]
  selectedId: string | null
  frozen: boolean
  onSelect: (id: string) => void
  onClear: () => void
  onToggleFreeze: () => void
  onClose: () => void
}

// Per-protocol colour for the packet list (Wireshark-ish coloring rules).
const PROTO_COLOR: Record<string, string> = {
  DNS: '#a371f7', DHCP: '#2dd4bf', MySQL: '#f778ba', 'TLSv1.3': '#38bdf8',
  HTTP: '#3fb950', ICMP: '#e3b341', MQTT: '#7ee787', SMB: '#56d4dd', IMAP: '#e3b341', IPP: '#f0a35e',
  TCP: '#8b949e', ARP: '#f0883e',
}
const protoColor = (p: string) => PROTO_COLOR[p] ?? '#8b949e'

function LayerRow({ name, summary, fields }: { name: string; summary: string; fields: { label: string; value: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[var(--border)]/50">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-start gap-1 w-full text-left px-2 py-1 hover:bg-[var(--bg-800)]"
      >
        {open ? <ChevronDown size={11} className="mt-0.5 shrink-0 text-[var(--text-muted)]" /> : <ChevronRight size={11} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />}
        <span className="text-[11px] text-[var(--text-primary)] font-medium">{name}</span>
        <span className="text-[10px] text-[var(--text-muted)] ml-1 truncate">{summary}</span>
      </button>
      {open && (
        <div className="pl-6 pr-2 pb-1 space-y-0.5">
          {fields.map((f, i) => (
            <div key={i} className="flex gap-2 text-[10px] font-mono leading-relaxed">
              <span className="text-[var(--text-muted)] shrink-0">{f.label}:</span>
              <span className="text-[var(--text-secondary)] break-all">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PacketInspector({
  packets, selectedId, frozen, onSelect, onClear, onToggleFreeze, onClose,
}: PacketInspectorProps) {
  const sel = packets.find(p => p.id === selectedId) ?? packets[packets.length - 1]

  return (
    <div className="flex flex-col h-full bg-[var(--bg-900)] border-l border-[var(--border)] w-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-950)] shrink-0">
        <Layers size={15} className="text-[var(--accent)]" />
        <div className="flex-1">
          <div className="text-xs font-semibold text-[var(--text-primary)]">Packet Analyzer</div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono">{packets.length} packet(s) captured</div>
        </div>
        <button
          onClick={onToggleFreeze}
          title={frozen ? 'Resume the network' : 'Freeze all packets'}
          className={[
            'flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
            frozen ? 'bg-[var(--green)] text-white' : 'bg-[var(--bg-800)] text-[var(--text-muted)] hover:text-[var(--text-primary)]',
          ].join(' ')}
        >
          {frozen ? <><Play size={10} /> Resume</> : <><Pause size={10} /> Freeze</>}
        </button>
        <button onClick={onClear} title="Clear capture" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"><Trash2 size={13} /></button>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"><X size={14} /></button>
      </div>

      {frozen && (
        <div className="px-3 py-1 text-[10px] text-[var(--green)] bg-[rgba(63,185,80,0.08)] border-b border-[var(--green)]/30">
          ● Frozen — every packet is stopped on the spot. Click any dot on the canvas to capture it.
        </div>
      )}

      {/* Packet list (top pane) */}
      <div className="shrink-0 max-h-[34%] overflow-y-auto border-b border-[var(--border)]">
        <table className="w-full text-[10px] font-mono">
          <thead className="sticky top-0 bg-[var(--bg-950)] text-[var(--text-muted)]">
            <tr>
              <th className="text-left px-2 py-1 font-medium">No.</th>
              <th className="text-left px-1 py-1 font-medium">Source</th>
              <th className="text-left px-1 py-1 font-medium">Destination</th>
              <th className="text-left px-1 py-1 font-medium">Proto</th>
              <th className="text-left px-1 py-1 font-medium">Len</th>
            </tr>
          </thead>
          <tbody>
            {packets.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-3 text-center text-[var(--text-muted)]">Click a moving packet on the canvas to capture it.</td></tr>
            )}
            {packets.map((p, i) => {
              const isSel = p.id === sel?.id
              return (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={['cursor-pointer', isSel ? 'bg-[rgba(88,166,255,0.15)]' : 'hover:bg-[var(--bg-800)]'].join(' ')}
                >
                  <td className="px-2 py-1 text-[var(--text-muted)]">{i + 1}</td>
                  <td className="px-1 py-1 text-[var(--text-secondary)] truncate max-w-[90px]" title={`${p.srcName} ${p.srcIp}`}>{p.srcIp || p.srcName}</td>
                  <td className="px-1 py-1 text-[var(--text-secondary)] truncate max-w-[90px]" title={`${p.dstName} ${p.dstIp}`}>{p.dstIp || p.dstName}</td>
                  <td className="px-1 py-1 font-semibold" style={{ color: protoColor(p.protocol) }}>{p.protocol}</td>
                  <td className="px-1 py-1 text-[var(--text-muted)]">{p.length}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Detail (middle) + hex (bottom) */}
      {sel ? (
        <>
          <div className="px-2 py-1 text-[10px] font-mono text-[var(--text-secondary)] bg-[var(--bg-950)] border-b border-[var(--border)] truncate" title={sel.info}>
            <span style={{ color: protoColor(sel.protocol) }}>{sel.protocol}</span> · {sel.info}
          </div>
          <div className="flex-1 overflow-y-auto">
            {sel.layers.map((l, i) => <LayerRow key={i} {...l} />)}
          </div>
          <div className="shrink-0 max-h-[28%] overflow-y-auto border-t border-[var(--border)] bg-[var(--bg-950)] p-2">
            <pre className="text-[9.5px] font-mono leading-[1.5] text-[var(--text-muted)] whitespace-pre">{sel.payloadHex}</pre>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[11px] text-[var(--text-muted)] p-4 text-center">
          Turn on <b className="mx-1 text-[var(--text-secondary)]">Live</b> traffic, then click a moving packet to decode it.
        </div>
      )}
    </div>
  )
}
