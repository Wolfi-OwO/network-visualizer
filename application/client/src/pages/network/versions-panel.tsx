import { useCallback, useEffect, useState } from 'react'
import { History, RefreshCw, X, Save, RotateCcw } from 'lucide-react'
import { network } from '../../lib/api/index.ts'
import type { VersionSummary } from '../../lib/api/index.ts'
import type { NetworkTopology } from '../../types/index.ts'

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

// Snapshot history for the current topology: save, list and restore versions.
export default function VersionsPanel({
  topologyId,
  onClose,
  onRestored,
}: {
  topologyId?: string
  onClose: () => void
  onRestored: (topology: NetworkTopology) => void
}) {
  const [items, setItems] = useState<VersionSummary[]>([])
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!topologyId) return
    setLoading(true)
    setError('')
    try {
      const { data } = await network.versions(topologyId)
      setItems(data.items)
    } catch {
      setError('Could not load versions (save the topology first).')
    } finally {
      setLoading(false)
    }
  }, [topologyId])

  useEffect(() => {
    load()
  }, [load])

  const snapshot = async () => {
    if (!topologyId) return
    setBusy(true)
    try {
      await network.createVersion(topologyId, label.trim() || undefined)
      setLabel('')
      await load()
    } catch {
      setError('Snapshot failed')
    } finally {
      setBusy(false)
    }
  }

  const restore = async (versionId: string) => {
    if (!topologyId) return
    setBusy(true)
    try {
      const { data } = await network.restoreVersion(topologyId, versionId)
      onRestored(data)
      await load()
    } catch {
      setError('Restore failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="absolute top-3 right-3 w-[min(20rem,calc(100%-1.5rem))] max-h-[70%] flex flex-col rounded-lg popover shadow-xl z-20 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <History size={14} className="text-[var(--accent)]" />
        <span className="text-xs font-semibold text-[var(--text-primary)]">Version history</span>
        <div className="flex-1" />
        <button
          onClick={load}
          title="Refresh"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={onClose}
          title="Close"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X size={13} />
        </button>
      </div>

      {/* Save snapshot */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <input
          className="input flex-1 text-xs h-7"
          placeholder="Snapshot label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && snapshot()}
        />
        <button onClick={snapshot} disabled={busy} className="btn-primary h-7 px-2 text-xs">
          <Save size={11} /> Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && <div className="p-3 text-xs text-red-400">{error}</div>}
        {!error && items.length === 0 && (
          <div className="p-4 text-xs text-[var(--text-muted)]">
            No snapshots yet — save one to start a history.
          </div>
        )}
        {items.map((v) => (
          <div
            key={v.id}
            className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]/50"
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--bg-800)] text-[11px] font-mono text-[var(--accent)] shrink-0">
              v{v.version}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-[var(--text-primary)] truncate">
                {v.label || v.name}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono">
                {v.nodeCount} nodes · {v.edgeCount} links · {ago(v.createdAt)}
              </div>
            </div>
            <button
              onClick={() => restore(v.id)}
              disabled={busy}
              title="Restore this snapshot"
              className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent)] shrink-0"
            >
              <RotateCcw size={11} /> Restore
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
