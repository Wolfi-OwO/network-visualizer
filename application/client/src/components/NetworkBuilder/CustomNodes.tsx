import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Power } from 'lucide-react'
import type { NetworkNodeConfig, NodeType } from '../../types'
import { DEVICE_META, meta, isDhcpClient } from './deviceCatalog'

export type NodeHighlight = 'none' | 'active' | 'blocked' | 'delivered' | 'path'

export interface NetworkNodeData extends Record<string, unknown> {
  type: NodeType
  label: string
  config: NetworkNodeConfig
  highlight?: NodeHighlight
}

const HIGHLIGHT_STYLES: Record<NodeHighlight, { border: string; shadow: string; badge?: string }> = {
  none:      { border: '',        shadow: '' },
  path:      { border: '#58a6ff', shadow: '0 0 16px #58a6ff55' },
  active:    { border: '#3fb950', shadow: '0 0 20px #3fb95088, 0 0 40px #3fb95044' },
  delivered: { border: '#3fb950', shadow: '0 0 24px #3fb950aa, 0 0 50px #3fb95066' },
  blocked:   { border: '#f85149', shadow: '0 0 24px #f8514999, 0 0 50px #f8514966', badge: '✗' },
}

function getIpLabel(config: NetworkNodeConfig): string {
  const withIp = (config.interfaces ?? []).filter(i => i.ipAddress)
  if (withIp.length === 0) return ''
  const first = withIp[0]
  const base = `${first.ipAddress}${first.cidr ?? ''}`
  // Multi-homed devices (router/firewall) advertise more than one interface
  return withIp.length > 1 ? `${base}  +${withIp.length - 1}` : base
}

function NetworkNodeComponent({ data, id }: NodeProps) {
  const d = data as NetworkNodeData
  const type = d.type
  const m = meta(type)
  const Icon = m.Icon
  const hl = d.highlight ?? 'none'
  const hlStyle = HIGHLIGHT_STYLES[hl]
  const ip = getIpLabel(d.config)
  const powered = d.config.powered !== false   // undefined = on

  const borderColor = hlStyle.border || m.color
  const shadow = powered ? (hlStyle.shadow || `0 0 12px ${m.color}33`) : 'none'

  const togglePower = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('netviz:togglePower', { detail: { id } }))
  }

  return (
    <div
      style={{
        border: `2px solid ${powered ? borderColor : '#30363d'}`,
        background: !powered ? '#10131a'
          : hl === 'blocked' ? '#2d0a0a'
          : hl === 'delivered' || hl === 'active' ? '#0a2018'
          : m.bg,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 108,
        boxShadow: shadow,
        position: 'relative',
        opacity: powered ? 1 : 0.55,
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease, opacity 0.2s',
      }}
    >
      {/* Glow rings (only when powered) */}
      {powered && (hl === 'active' || hl === 'delivered') && (
        <div style={{ position: 'absolute', inset: -4, borderRadius: 14, border: '2px solid #3fb95044', animation: 'pulse-ring 1s ease-in-out infinite', pointerEvents: 'none' }} />
      )}
      {powered && hl === 'blocked' && (
        <div style={{ position: 'absolute', inset: -4, borderRadius: 14, border: '2px solid #f8514966', animation: 'pulse-ring-red 0.8s ease-in-out infinite', pointerEvents: 'none' }} />
      )}

      {/* Loose connection mode lets every one of these dots both start and
          receive a link, so you can wire devices from any side. */}
      <Handle type="target" position={Position.Top}    style={{ background: borderColor, border: '2px solid var(--bg-950)', width: 11, height: 11, cursor: 'crosshair' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: borderColor, border: '2px solid var(--bg-950)', width: 11, height: 11, cursor: 'crosshair' }} />
      <Handle type="target" position={Position.Left}   style={{ background: borderColor, border: '2px solid var(--bg-950)', width: 11, height: 11, cursor: 'crosshair' }} />
      <Handle type="source" position={Position.Right}  style={{ background: borderColor, border: '2px solid var(--bg-950)', width: 11, height: 11, cursor: 'crosshair' }} />

      {/* Power button */}
      <button
        className="nodrag"
        onClick={togglePower}
        title={powered ? 'Power off' : 'Power on (auto-requests DHCP)'}
        style={{
          position: 'absolute', top: -9, left: -9,
          width: 18, height: 18, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: powered ? '#3fb950' : '#30363d',
          color: powered ? '#0d1117' : '#8b949e',
          border: '2px solid var(--bg-950)',
          cursor: 'pointer', padding: 0,
          boxShadow: powered ? '0 0 8px #3fb95088' : 'none',
        }}
      >
        <Power size={9} strokeWidth={3} />
      </button>

      <div className="flex flex-col items-center gap-1 relative">
        {/* Trace status badge */}
        {hlStyle.badge && powered && (
          <div style={{ position: 'absolute', top: -8, right: -10, background: '#f85149', color: '#fff', width: 16, height: 16, borderRadius: '50%', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 8px #f85149' }}>
            {hlStyle.badge}
          </div>
        )}
        {hl === 'delivered' && powered && (
          <div style={{ position: 'absolute', top: -8, right: -10, background: '#3fb950', color: '#fff', width: 16, height: 16, borderRadius: '50%', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 8px #3fb950' }}>
            ✓
          </div>
        )}

        <Icon size={24} color={powered ? m.color : '#6e7681'} strokeWidth={1.75} />
        <div className="text-[11px] font-semibold text-[var(--text-primary)] text-center leading-tight max-w-[110px] truncate">
          {d.config.hostname ?? d.label}
        </div>

        {!powered ? (
          <div className="text-[9px] font-mono text-[var(--text-muted)]">⏻ powered off</div>
        ) : ip ? (
          <div className="text-[9px] font-mono text-center" style={{ color: hl !== 'none' ? borderColor : 'var(--text-muted)' }}>{ip}</div>
        ) : isDhcpClient(type) ? (
          <div className="text-[9px] font-mono" style={{ color: '#d29922' }}>needs IP</div>
        ) : null}

        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full border border-[var(--bg-800)]" style={{ background: powered ? '#3fb950' : '#6e7681' }} />
          <span className="text-[9px] text-[var(--text-muted)]">{d.config.model ?? m.label}</span>
        </div>
      </div>
    </div>
  )
}

// Map every device type to the renderer
export const nodeTypes = Object.fromEntries(
  (Object.keys(DEVICE_META) as NodeType[]).map(t => [t, NetworkNodeComponent]),
)
