import { X, Cable, Trash2, Network, ArrowLeftRight } from 'lucide-react'
import type { Edge } from '@xyflow/react'
import type { PacketEdgeData } from './packet-edge.tsx'

interface EdgePropertiesPanelProps {
  edge: Edge<PacketEdgeData>
  sourceName: string
  targetName: string
  canConfigureWan?: boolean
  onConfigureWanLink?: (edgeId: string) => void
  onChange: (edgeId: string, data: Partial<PacketEdgeData>) => void
  onDelete: (edgeId: string) => void
  onClose: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-[10px] text-[var(--text-muted)] w-20 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

export default function EdgePropertiesPanel({
  edge, sourceName, targetName, canConfigureWan, onConfigureWanLink, onChange, onDelete, onClose,
}: EdgePropertiesPanelProps) {
  const d = edge.data ?? {}
  const status = d.linkStatus ?? 'up'

  return (
    <div className="flex flex-col h-full bg-[var(--bg-900)] border-l border-[var(--border)] w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-950)] shrink-0">
        <div className="flex items-center gap-2">
          <Cable size={15} className="text-[var(--accent)]" />
          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              {d.edgeLabel || 'Connection'}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-mono">
              {sourceName} <ArrowLeftRight size={10} className="shrink-0" /> {targetName}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="space-y-2">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Link</div>

          <Field label="Name / Label">
            <input
              autoFocus
              className="input text-[11px] h-7 py-0 px-2"
              value={d.edgeLabel ?? ''}
              onChange={e => onChange(edge.id, { edgeLabel: e.target.value })}
              placeholder="e.g. LAN trunk, WAN uplink"
            />
          </Field>

          <Field label="Bandwidth">
            <input
              className="input text-[11px] h-7 py-0 px-2 font-mono"
              value={d.bandwidth ?? ''}
              onChange={e => onChange(edge.id, { bandwidth: e.target.value })}
              placeholder="1 Gbps"
            />
          </Field>

          <Field label="Latency (ms)">
            <input
              className="input text-[11px] h-7 py-0 px-2 font-mono"
              type="number"
              min={0}
              step={0.1}
              value={d.latencyMs ?? ''}
              onChange={e => onChange(edge.id, { latencyMs: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
              placeholder="1"
            />
          </Field>

          <Field label="Status">
            <div className="flex rounded overflow-hidden border border-[var(--border)] w-fit">
              {(['up', 'down'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => onChange(edge.id, { linkStatus: s })}
                  className={[
                    'px-3 py-1 text-[10px] font-medium transition-colors capitalize',
                    status === s
                      ? (s === 'up' ? 'bg-[var(--green)] text-white' : 'bg-[var(--red)] text-white')
                      : 'bg-[var(--bg-800)] text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                  ].join(' ')}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Connect two private networks — site-to-site WAN link */}
        {canConfigureWan && (
          <div className="border-t border-[var(--border)] pt-3 space-y-2">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Two-router WAN link</div>
            <button
              onClick={() => onConfigureWanLink?.(edge.id)}
              className="btn-primary w-full justify-center text-[11px]"
            >
              <Network size={12} /> Configure as WAN link
            </button>
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
              Both ends are routers. This assigns a <b>/30</b> point-to-point subnet to the link and installs the
              <b> static routes</b> on each router so the two private LANs can reach each other.
            </p>
          </div>
        )}

        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed border-t border-[var(--border)] pt-3">
          The label is shown on the line in the diagram. Latency is added to each
          packet hop that crosses this link when you run a trace.
        </p>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-[var(--border)] shrink-0">
        <button onClick={() => onDelete(edge.id)} className="btn-danger w-full justify-center text-[11px]">
          <Trash2 size={11} /> Delete Connection
        </button>
      </div>
    </div>
  )
}
