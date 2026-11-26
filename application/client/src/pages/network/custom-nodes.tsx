import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Power, Check, X } from 'lucide-react'
import type { NetworkNodeConfig, NodeType } from '../../types/index.ts'
import { DEVICE_META, meta, isDhcpClient } from './device-catalog.tsx'

export type NodeHighlight = 'none' | 'active' | 'blocked' | 'delivered' | 'path'

export interface NetworkNodeData extends Record<string, unknown> {
  type: NodeType
  label: string
  config: NetworkNodeConfig
  highlight?: NodeHighlight
}

// A trace colours the plate's edge and nothing else; the colour of a device type lives in the stripe on its left.
const HIGHLIGHT_BORDER: Record<NodeHighlight, string> = {
  none: '',
  path: '#e6a23c',
  active: '#5ec27f',
  delivered: '#5ec27f',
  blocked: '#ef6b5f',
}

// Square marker the trace drops on a node when a packet stops (or lands) there.
function TraceBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-[3px] text-[var(--bg-950)]"
      style={{ background: color }}
    >
      {children}
    </div>
  )
}

function getIpLabel(config: NetworkNodeConfig): string {
  const withIp = (config.interfaces ?? []).filter((i) => i.ipAddress)
  if (withIp.length === 0) return ''
  const first = withIp[0]
  const base = `${first.ipAddress}${first.cidr ?? ''}`
  // Multi-homed devices (router/firewall) advertise more than one interface
  return withIp.length > 1 ? `${base}  +${withIp.length - 1}` : base
}

const SIDES = [
  ['top', Position.Top],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
  ['right', Position.Right],
] as const

function NetworkNodeComponent({ data, id, selected }: NodeProps) {
  const d = data as NetworkNodeData
  const type = d.type
  const m = meta(type)
  const Icon = m.Icon
  const hl = d.highlight ?? 'none'
  const ip = getIpLabel(d.config)
  const powered = d.config.powered !== false // undefined = on

  const traceColor = HIGHLIGHT_BORDER[hl]
  const edgeColor = !powered
    ? 'var(--border)'
    : traceColor || (selected ? 'var(--accent)' : 'var(--border-strong)')

  const togglePower = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('netviz:togglePower', { detail: { id } }))
  }

  return (
    <div
      className="nv-node group relative min-w-[148px] max-w-[190px] overflow-visible rounded-[4px] bg-[var(--bg-900)] pl-3 pr-2 py-2"
      style={{
        border: `1px solid ${edgeColor}`,
        // the stripe is the device type, drawn as an inset so it never shifts the layout
        boxShadow: `inset 3px 0 0 ${powered ? m.color : 'var(--bg-600)'}${
          traceColor && powered
            ? `, 0 0 0 2px ${traceColor}33`
            : selected
              ? ', 0 0 0 2px #e6a23c33'
              : ''
        }`,
        opacity: powered ? 1 : 0.6,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
      }}
    >
      {powered && (hl === 'active' || hl === 'delivered') && (
        <div
          className="pointer-events-none absolute -inset-[5px] rounded-[7px]"
          style={{ border: '1px solid #5ec27f66', animation: 'pulse-ring 1s ease-in-out infinite' }}
        />
      )}
      {powered && hl === 'blocked' && (
        <div
          className="pointer-events-none absolute -inset-[5px] rounded-[7px]"
          style={{
            border: '1px solid #ef6b5f88',
            animation: 'pulse-ring-red 0.8s ease-in-out infinite',
          }}
        />
      )}

      {/* Loose connection mode lets every one of these ports both start and receive a link, so you can wire
          devices from any side. Each handle has a unique id: without one React Flow cannot tell the four apart
          and snaps every link to the first (the old "edges only attach top/bottom" bug). The rendered edge
          ignores the handle anyway and floats to the side facing the peer (see packet-edge.tsx). They only show
          while the pointer is over the device, so an idle diagram is not dotted with connectors. */}
      {SIDES.map(([hid, pos]) => (
        <Handle
          key={hid}
          id={hid}
          type="source"
          position={pos}
          className="nv-port"
          style={{ cursor: 'crosshair' }}
        />
      ))}

      {hl === 'blocked' && powered && (
        <TraceBadge color="#ef6b5f">
          <X size={10} strokeWidth={3} />
        </TraceBadge>
      )}
      {hl === 'delivered' && powered && (
        <TraceBadge color="#5ec27f">
          <Check size={10} strokeWidth={3} />
        </TraceBadge>
      )}

      <div className="flex items-center gap-2">
        <Icon size={16} color={powered ? m.color : 'var(--text-muted)'} strokeWidth={1.75} />
        <div className="min-w-0 flex-1 truncate font-mono text-[12px] font-semibold leading-tight text-[var(--text-primary)]">
          {d.config.hostname ?? d.label}
        </div>
        <button
          className="nodrag flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border border-[var(--border-strong)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          style={powered ? { color: '#5ec27f', borderColor: '#5ec27f66' } : undefined}
          onClick={togglePower}
          title={powered ? 'Power off' : 'Power on (auto-requests DHCP)'}
          aria-label={powered ? 'Power off' : 'Power on'}
        >
          <Power size={10} strokeWidth={2.5} />
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] leading-tight">
        {!powered ? (
          <span className="text-[var(--text-muted)]">powered off</span>
        ) : ip ? (
          <span style={{ color: traceColor || 'var(--text-secondary)' }}>{ip}</span>
        ) : isDhcpClient(type) ? (
          <span style={{ color: '#e0b040' }}>needs IP</span>
        ) : (
          <span className="text-[var(--text-muted)]">—</span>
        )}
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-[2px]"
          style={{
            background: powered ? '#5ec27f' : 'var(--bg-600)',
            boxShadow: powered ? '0 0 4px #5ec27f99' : 'none',
          }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-0.5 truncate text-[10px] leading-tight text-[var(--text-muted)]">
        {d.config.model ?? m.label}
      </div>
    </div>
  )
}

// Map every device type to the renderer
export const nodeTypes = Object.fromEntries(
  (Object.keys(DEVICE_META) as NodeType[]).map((t) => [t, NetworkNodeComponent]),
)
