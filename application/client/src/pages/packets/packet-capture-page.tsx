import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Play, Square, Trash2, Download, BarChart2, AlignLeft, Code } from 'lucide-react'
import type { Packet, PacketStats } from '../../types/index.ts'
import { packets as packetsApi, capture as captureApi } from '../../lib/api/index.ts'
import FilterBar from './filter-bar.tsx'
import ProtocolFilter, { PROTOCOLS } from './protocol-filter.tsx'
import PacketList from './packet-list.tsx'
import PacketDetail from './packet-detail.tsx'
import HexDump from './hex-dump.tsx'
import StatsPanel from './stats-panel.tsx'

type BottomTab = 'detail' | 'hex' | 'stats'

export default function PacketCapturePage() {
  const [capturing, setCapturing] = useState(false)
  const [packetList, setPacketList] = useState<Packet[]>([])
  const [selected, setSelected] = useState<Packet | null>(null)
  const [filter, setFilter] = useState('')
  const [hiddenProtocols, setHiddenProtocols] = useState<Set<string>>(new Set())
  const [bottomTab, setBottomTab] = useState<BottomTab>('detail')
  const [stats, setStats] = useState<PacketStats | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const esRef = useRef<EventSource | null>(null)
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef = useRef(false)

  const stopStream = useCallback(() => {
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await captureApi.get()
      setStats(data.stats)
    } catch {
      /* ignore */
    }
  }, [])

  const startCapture = useCallback(async () => {
    await captureApi.start()
    setCapturing(true)
    setAutoScroll(true)

    const es = new EventSource('/api/packets/stream')
    esRef.current = es
    es.onmessage = (e: MessageEvent) => {
      const newPkts: Packet[] = JSON.parse(e.data as string)
      setPacketList((prev) => {
        const combined = [...prev, ...newPkts]
        return combined.slice(-5000)
      })
    }
    es.onerror = () => {
      es.close()
      esRef.current = null
    }

    statsTimerRef.current = setInterval(fetchStats, 2000)
  }, [fetchStats])

  const stopCapture = useCallback(async () => {
    await captureApi.stop()
    setCapturing(false)
    stopStream()
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current)
      statsTimerRef.current = null
    }
    fetchStats()
  }, [stopStream, fetchStats])

  const clearCapture = useCallback(async () => {
    await packetsApi.clear()
    setPacketList([])
    setSelected(null)
    setStats(null)
  }, [])

  const exportPcap = useCallback(() => {
    const data = JSON.stringify(packetList, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `capture_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [packetList])

  // Auto-start capturing on first mount so the user immediately sees all traffic
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    startCapture()
  }, [startCapture])

  useEffect(
    () => () => {
      stopStream()
      if (statsTimerRef.current) clearInterval(statsTimerRef.current)
    },
    [stopStream],
  )

  // Live per-protocol counts from the captured buffer
  const protocolCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const p of packetList) c[p.protocol] = (c[p.protocol] ?? 0) + 1
    return c
  }, [packetList])

  const toggleProtocol = useCallback((proto: string) => {
    setHiddenProtocols((prev) => {
      const next = new Set(prev)
      if (next.has(proto)) next.delete(proto)
      else next.add(proto)
      return next
    })
  }, [])

  const showAllProtocols = useCallback(() => setHiddenProtocols(new Set()), [])
  const hideAllProtocols = useCallback(
    () =>
      setHiddenProtocols(new Set([...PROTOCOLS.map((p) => p.id), ...Object.keys(protocolCounts)])),
    [protocolCounts],
  )

  const filtered = useMemo(() => {
    const f = filter.trim().toUpperCase()
    return packetList.filter((p) => {
      if (hiddenProtocols.has(p.protocol)) return false
      if (!f) return true
      return (
        p.protocol.toUpperCase().includes(f) ||
        (p.ip?.srcIp ?? '').includes(f) ||
        (p.ip?.dstIp ?? '').includes(f) ||
        (p.ethernet?.srcMac ?? '').toUpperCase().includes(f) ||
        (p.ethernet?.dstMac ?? '').toUpperCase().includes(f) ||
        p.info.toUpperCase().includes(f)
      )
    })
  }, [packetList, filter, hiddenProtocols])

  const bottomTabs: { id: BottomTab; label: string; icon: React.ReactNode }[] = [
    { id: 'detail', label: 'Packet Details', icon: <AlignLeft size={11} /> },
    { id: 'hex', label: 'Hex Dump', icon: <Code size={11} /> },
    { id: 'stats', label: 'Statistics', icon: <BarChart2 size={11} /> },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 gap-y-1.5 px-4 py-2 backdrop-blur-xl bg-[var(--glass-bg)] border-b border-[var(--glass-border)] shrink-0">
        <div className="flex items-center gap-1.5 mr-2">
          <div
            className={[
              'w-2 h-2 rounded-full',
              capturing ? 'bg-[var(--red)] animate-pulse' : 'bg-[var(--bg-600)]',
            ].join(' ')}
          />
          <span className="text-xs font-semibold text-[var(--text-primary)]">Packet Capture</span>
        </div>

        {!capturing ? (
          <button onClick={startCapture} className="btn-success">
            <Play size={11} /> Start
          </button>
        ) : (
          <button onClick={stopCapture} className="btn-danger">
            <Square size={11} /> Stop
          </button>
        )}
        <button onClick={clearCapture} className="btn-ghost">
          <Trash2 size={11} /> Clear
        </button>
        <button onClick={exportPcap} className="btn-ghost" disabled={packetList.length === 0}>
          <Download size={11} /> Export
        </button>

        <div className="flex-1" />

        <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="w-3 h-3 accent-[var(--accent)]"
          />
          Auto-scroll
        </label>

        <div className="text-xs text-[var(--text-muted)] font-mono">
          {filtered.length.toLocaleString()} / {packetList.length.toLocaleString()} packets
        </div>
      </div>

      {/* Protocol on/off toggles */}
      <ProtocolFilter
        counts={protocolCounts}
        hidden={hiddenProtocols}
        onToggle={toggleProtocol}
        onAll={showAllProtocols}
        onNone={hideAllProtocols}
      />

      {/* Filter bar */}
      <FilterBar value={filter} onChange={setFilter} />

      {/* Main area: packet list (top 60%) + bottom panel (40%) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Packet list */}
        <div
          className="flex-1 overflow-hidden border-b border-[var(--border)]"
          style={{ minHeight: 0 }}
        >
          <PacketList
            packets={filtered}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            autoScroll={autoScroll && !filter && hiddenProtocols.size === 0}
          />
        </div>

        {/* Bottom panel */}
        <div className="flex flex-col overflow-hidden h-[45%] md:h-[38%]" style={{ minHeight: 0 }}>
          {/* Bottom tabs */}
          <div className="flex items-center border-b border-[var(--border)] bg-[var(--bg-950)] shrink-0">
            {bottomTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setBottomTab(t.id)}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors',
                  bottomTab === t.id
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                ].join(' ')}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Bottom content - split: detail + hex */}
          <div className="flex-1 overflow-hidden">
            {bottomTab === 'detail' && (
              <div className="flex flex-col md:flex-row h-full">
                <div className="flex-1 overflow-hidden border-b md:border-b-0 md:border-r border-[var(--border)]">
                  <PacketDetail packet={selected} />
                </div>
                <div className="w-full h-48 shrink-0 md:h-auto md:w-96 overflow-hidden">
                  <HexDump packet={selected} />
                </div>
              </div>
            )}
            {bottomTab === 'hex' && <HexDump packet={selected} />}
            {bottomTab === 'stats' && <StatsPanel stats={stats} />}
          </div>
        </div>
      </div>
    </div>
  )
}
