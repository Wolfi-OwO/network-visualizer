import { useState } from 'react'
import { Send, ChevronDown, Zap, Gauge, Pause, Play } from 'lucide-react'
import type { NetworkNode, NetworkEdge } from '../../types/index.ts'
import type { Edge } from '@xyflow/react'
import type { TraceResult } from '../../lib/api/index.ts'
import type { PacketEdgeData } from './packet-edge.tsx'
import { send as sendApi, network as networkApi } from '../../lib/api/index.ts'
import SelectMenu from '../../components/core/select-menu.tsx'

const PROTOCOLS = [
  { value: 'icmp', label: 'ICMP (Ping)' },
  { value: 'tcp',  label: 'TCP' },
  { value: 'udp',  label: 'UDP' },
] as const

const PRESET_PORTS = [
  { label: 'HTTP (80)',   port: 80,   proto: 'tcp' as const },
  { label: 'HTTPS (443)', port: 443,  proto: 'tcp' as const },
  { label: 'SSH (22)',    port: 22,   proto: 'tcp' as const },
  { label: 'DNS (53)',    port: 53,   proto: 'udp' as const },
  { label: 'SMTP (25)',   port: 25,   proto: 'tcp' as const },
  { label: 'RDP (3389)', port: 3389, proto: 'tcp' as const },
]

const SPEED_PRESETS = [
  { label: 'Fast',   ms: 1300 },
  { label: 'Normal', ms: 2000 },
  { label: 'Slow',   ms: 5000 },
] as const

interface PacketSenderProps {
  nodes: NetworkNode[]
  topologyId?: string
  currentEdges: Edge<PacketEdgeData>[]
  onTraceResult: (result: TraceResult) => void
  onClear: () => void
  animSpeed: number
  isPaused: boolean
  isAnimating: boolean
  onSpeedChange: (ms: number) => void
  onPauseToggle: () => void
}

export default function PacketSender({
  nodes, topologyId, currentEdges,
  onTraceResult, onClear,
  animSpeed, isPaused, isAnimating,
  onSpeedChange, onPauseToggle,
}: PacketSenderProps) {
  const [srcId, setSrcId] = useState('')
  const [dstId, setDstId] = useState('')
  const [protocol, setProtocol] = useState<'icmp' | 'tcp' | 'udp'>('icmp')
  const [dstPort, setDstPort] = useState<string>('')
  const [ttl, setTtl] = useState('64')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPresets, setShowPresets] = useState(false)

  const handleSend = async () => {
    if (!srcId || !dstId) { setError('Select source and destination'); return }
    if (srcId === dstId) { setError('Source and destination must differ'); return }
    setError('')
    setLoading(true)
    onClear()

    try {
      // Sync current local topology to backend before tracing so new nodes are visible
      if (topologyId) {
        const netNodes = nodes.map(n => ({
          id: n.id, type: n.type, label: n.label, position: n.position, config: n.config,
        }))
        const netEdges: NetworkEdge[] = currentEdges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
          label: (e.data as PacketEdgeData)?.edgeLabel,
          config: {},
        }))
        await networkApi.update(topologyId, { nodes: netNodes, edges: netEdges })
      }

      const { data } = await sendApi.trace({
        srcNodeId: srcId,
        dstNodeId: dstId,
        protocol,
        dstPort: dstPort ? parseInt(dstPort) : undefined,
        ttl: parseInt(ttl) || 64,
        topologyId,
      })
      onTraceResult(data)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Trace failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = (port: number, proto: 'tcp' | 'udp') => {
    setProtocol(proto)
    setDstPort(String(port))
    setShowPresets(false)
  }

  return (
    <div data-tour="sender" className="relative z-20 flex flex-wrap items-center gap-2 px-3 py-2 backdrop-blur-xl bg-[var(--glass-bg)] border-b border-[var(--glass-border)]">
      {/* Field controls: label → source → destination → protocol → port → TTL → send, wrap as one unit */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Label */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Zap size={12} className="text-[var(--yellow)]" />
          <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Send Packet</span>
        </div>

        {/* Source */}
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] text-[var(--text-muted)] shrink-0">From</span>
          <SelectMenu
            className="text-xs w-40"
            value={srcId}
            onChange={setSrcId}
            placeholder="— Source —"
            options={nodes.map(n => ({ value: n.id, label: `${n.config.hostname ?? n.label} (${n.type})` }))}
          />
        </div>

        <span className="text-[var(--text-muted)] shrink-0">→</span>

        {/* Destination */}
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[10px] text-[var(--text-muted)] shrink-0">To</span>
          <SelectMenu
            className="text-xs w-40"
            value={dstId}
            onChange={setDstId}
            placeholder="— Destination —"
            options={nodes.filter(n => n.id !== srcId).map(n => ({ value: n.id, label: `${n.config.hostname ?? n.label} (${n.type})` }))}
          />
        </div>

        {/* Protocol */}
        <SelectMenu
          className="text-xs w-28"
          value={protocol}
          onChange={v => setProtocol(v as 'icmp' | 'tcp' | 'udp')}
          options={PROTOCOLS.map(p => ({ value: p.value, label: p.label }))}
        />

        {/* Port (only TCP/UDP) */}
        {protocol !== 'icmp' && (
          <div className="flex items-center gap-1 relative">
            <input
              className="input h-7 w-20 font-mono text-xs"
              placeholder="Port"
              value={dstPort}
              onChange={e => setDstPort(e.target.value)}
              type="number"
              min={1}
              max={65535}
            />
            <button onClick={() => setShowPresets(v => !v)} className="btn-ghost h-7 px-1.5" title="Preset ports">
              <ChevronDown size={10} />
            </button>
            {showPresets && (
              <div
                className="rounded-lg p-1.5 shadow-2xl"
                style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
                  minWidth: 140, background: 'var(--bg-800)', border: '1px solid var(--border)',
                }}
              >
                {PRESET_PORTS.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p.port, p.proto)}
                    className="block w-full text-left px-2 py-1 rounded-md text-[11px] font-mono text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TTL */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-[var(--text-muted)] shrink-0">TTL</span>
          <input className="input h-7 w-12 font-mono text-xs" value={ttl}
            onChange={e => setTtl(e.target.value)} type="number" min={1} max={255} />
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={loading || !srcId || !dstId}
          className={['shrink-0', loading ? 'btn-ghost' : 'btn-primary'].join(' ')}
        >
          <Send size={11} />
          {loading ? 'Tracing…' : 'Send'}
        </button>
      </div>

      {/* ── Speed control — drops to its own full-width row below `lg` ─── */}
      <div data-tour="speed" className="flex items-center gap-1.5 w-full lg:w-auto border-t lg:border-t-0 lg:border-l border-[var(--border)] pt-2 lg:pt-0 lg:pl-2 lg:ml-1 shrink-0">
        <Gauge size={11} className="text-[var(--text-muted)]" />
        <div className="flex rounded overflow-hidden border border-[var(--border)]">
          {SPEED_PRESETS.map(p => (
            <button
              key={p.ms}
              onClick={() => onSpeedChange(p.ms)}
              className={[
                'px-2 py-0.5 text-[10px] font-medium transition-colors border-r border-[var(--border)] last:border-r-0',
                animSpeed === p.ms
                  ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white'
                  : 'bg-[var(--bg-800)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-700)]',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Pause/Resume — only while animation is running */}
        {isAnimating && (
          <button
            onClick={onPauseToggle}
            className={['btn h-6 px-2 text-[10px]', isPaused ? 'btn-primary' : 'btn-ghost'].join(' ')}
            title={isPaused ? 'Resume animation' : 'Pause animation'}
          >
            {isPaused ? <Play size={10} /> : <Pause size={10} />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        )}
      </div>

      {/* Error */}
      {error && <span className="text-[11px] text-[var(--red)] font-mono">{error}</span>}
    </div>
  )
}
