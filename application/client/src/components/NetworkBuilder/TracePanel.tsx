import { X, CheckCircle, XCircle, AlertTriangle, ArrowRight, Clock } from 'lucide-react'
import type { TraceResult, TraceHop } from '../../lib/api'
import { meta } from './deviceCatalog'

const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  start:           { label: 'Start',           color: '#58a6ff', bg: 'rgba(88,166,255,0.12)',  icon: '▶' },
  switch_forward:  { label: 'L2 Forward',      color: '#3fb950', bg: 'rgba(63,185,80,0.10)',   icon: '⇒' },
  route:           { label: 'L3 Route',        color: '#58a6ff', bg: 'rgba(88,166,255,0.10)',  icon: '↗' },
  firewall_allow:  { label: 'FW Allow',        color: '#3fb950', bg: 'rgba(63,185,80,0.12)',   icon: '✓' },
  firewall_deny:   { label: 'FW Deny',         color: '#f85149', bg: 'rgba(248,81,73,0.12)',   icon: '✗' },
  firewall_drop:   { label: 'FW Drop',         color: '#d29922', bg: 'rgba(210,153,34,0.12)',  icon: '⊘' },
  delivered:       { label: 'Delivered',       color: '#3fb950', bg: 'rgba(63,185,80,0.15)',   icon: '✓' },
  ttl_exceeded:    { label: 'TTL Exceeded',    color: '#f85149', bg: 'rgba(248,81,73,0.12)',   icon: '⏱' },
  no_route:        { label: 'No Route',        color: '#f85149', bg: 'rgba(248,81,73,0.12)',   icon: '✗' },
  port_closed:     { label: 'Port Closed',     color: '#f85149', bg: 'rgba(248,81,73,0.12)',   icon: '⊘' },
}


interface TracePanelProps {
  result: TraceResult
  activeStep: number
  onClose: () => void
}

function HopRow({ hop, active, done }: { hop: TraceHop; active: boolean; done: boolean }) {
  const cfg = ACTION_CONFIG[hop.action] ?? { label: hop.action, color: '#8b949e', bg: 'rgba(139,148,158,0.1)', icon: '?' }
  const nm = meta(hop.nodeType)
  const NodeIcon = nm.Icon
  return (
    <div className={[
      'flex gap-2 p-2 rounded-md border transition-all duration-300',
      active ? 'border-[var(--accent)] bg-[rgba(88,166,255,0.08)] scale-[1.01]' : '',
      !active && done ? 'border-[var(--border)]/50 opacity-90' : '',
      !active && !done ? 'border-transparent opacity-40' : '',
    ].join(' ')}>
      {/* Step badge */}
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
        style={{ background: cfg.bg, color: cfg.color }}
      >
        {hop.step}
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <NodeIcon size={13} color={nm.color} strokeWidth={1.9} />
          <span className="text-[11px] font-semibold text-[var(--text-primary)]">{hop.nodeName}</span>
          <ArrowRight size={9} className="text-[var(--text-muted)]" />
          <span
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.icon} {cfg.label}
          </span>
          {hop.latencyMs > 0 && (
            <span className="text-[9px] font-mono text-[var(--text-muted)] flex items-center gap-0.5 ml-auto">
              <Clock size={8} /> {hop.latencyMs.toFixed(2)}ms
            </span>
          )}
        </div>

        {/* Detail */}
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono leading-relaxed">
          {hop.detail}
        </p>

        {/* Firewall rule */}
        {hop.firewallRule && (
          <div className="mt-1 px-2 py-1 rounded text-[9px] font-mono bg-[var(--bg-700)] text-[var(--text-muted)]">
            Rule #{hop.firewallRule.priority}: {hop.firewallRule.description}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TracePanel({ result, activeStep, onClose }: TracePanelProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-900)] border-l border-[var(--border)] w-full">
      {/* Header */}
      <div className={[
        'flex items-center justify-between px-3 py-2 border-b border-[var(--border)] shrink-0',
        result.success ? 'bg-[rgba(63,185,80,0.08)]' : 'bg-[rgba(248,81,73,0.08)]',
      ].join(' ')}>
        <div className="flex items-center gap-2">
          {result.success
            ? <CheckCircle size={14} className="text-[var(--green)]" />
            : result.blocked
              ? <XCircle size={14} className="text-[var(--red)]" />
              : <AlertTriangle size={14} className="text-[var(--yellow)]" />}
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {result.success ? 'Delivered' : result.blocked ? 'Blocked' : 'Failed'}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            {result.hops.length} hops · {result.totalLatencyMs.toFixed(2)}ms
          </span>
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 transition-colors">
          <X size={13} />
        </button>
      </div>

      {/* Packet info */}
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-950)] shrink-0">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {[
            ['Protocol', result.packet.protocol.toUpperCase()],
            ['Source', result.packet.srcIp],
            ['Destination', `${result.packet.dstIp}${result.packet.dstPort ? `:${result.packet.dstPort}` : ''}`],
            ['TTL', String(result.packet.ttl)],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <span className="text-[9px] text-[var(--text-muted)] uppercase">{k}:</span>
              <span className="text-[10px] font-mono text-[var(--text-primary)]">{v}</span>
            </div>
          ))}
        </div>
        {result.blocked && result.blockedAt && (
          <div className="mt-1 text-[10px] text-[var(--red)] font-mono">
            Blocked at: {result.blockedAt} — {result.blockedBy}
          </div>
        )}
      </div>

      {/* Hop list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {result.hops.map(hop => (
          <HopRow
            key={hop.step}
            hop={hop}
            active={hop.step === activeStep}
            done={hop.step < activeStep}
          />
        ))}
      </div>
    </div>
  )
}
