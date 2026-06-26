import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, AlertTriangle, XCircle, Info, RefreshCw, X } from 'lucide-react'
import { network } from '../../lib/api/index.ts'
import type { ValidationReport } from '../../lib/api/index.ts'

const ICON = { error: XCircle, warning: AlertTriangle, info: Info }
const COLOR = { error: 'text-red-400', warning: 'text-amber-400', info: 'text-[var(--accent)]' }

// Live "problems" panel — runs the backend design-validation engine against the
// (persisted) topology and lists what a network engineer would flag.
export default function ValidationPanel({ topologyId, onClose, onFocus }: {
  topologyId?: string
  onClose: () => void
  onFocus: (nodeId?: string, edgeId?: string) => void
}) {
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    if (!topologyId) return
    setLoading(true); setError('')
    try {
      const { data } = await network.validate(topologyId)
      setReport(data)
    } catch {
      setError('Validation request failed')
    } finally {
      setLoading(false)
    }
  }, [topologyId])

  useEffect(() => { run() }, [run])

  return (
    <div className="absolute bottom-3 left-3 w-80 max-h-[60%] flex flex-col rounded-lg bg-[var(--bg-900)] border border-[var(--border)] shadow-xl z-20 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <ShieldCheck size={14} className="text-[var(--accent)]" />
        <span className="text-xs font-semibold text-[var(--text-primary)]">Design validation</span>
        <div className="flex-1" />
        <button onClick={run} title="Re-check" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={onClose} title="Close" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <X size={13} />
        </button>
      </div>

      {report && (
        <div className="flex items-center gap-3 px-3 py-1.5 text-[11px] border-b border-[var(--border)]">
          <span className={report.ok ? 'text-[var(--green)]' : 'text-red-400'}>
            {report.ok ? '✓ No errors' : `⛔ ${report.counts.error} error${report.counts.error === 1 ? '' : 's'}`}
          </span>
          <span className="text-[var(--text-muted)]">{report.counts.warning} warn · {report.counts.info} info</span>
          <span className="text-[var(--text-muted)] ml-auto">{report.checks} checks</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {error && <div className="p-3 text-xs text-red-400">{error}</div>}
        {report && report.findings.length === 0 && !error && (
          <div className="p-4 text-xs text-[var(--text-muted)] flex items-center gap-2">
            <ShieldCheck size={14} className="text-[var(--green)]" /> All checks passed — no issues found.
          </div>
        )}
        {report?.findings.map((f) => {
          const Icon = ICON[f.severity]
          return (
            <button
              key={f.id}
              onClick={() => onFocus(f.nodeId, f.edgeId)}
              className="w-full flex items-start gap-2 px-3 py-2 text-left border-b border-[var(--border)]/50 hover:bg-[var(--bg-800)] transition-colors"
            >
              <Icon size={13} className={`mt-0.5 shrink-0 ${COLOR[f.severity]}`} />
              <span className="flex-1 min-w-0">
                <span className="block text-[11px] text-[var(--text-primary)] leading-snug">{f.message}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">{f.category}{f.nodeLabel ? ` · ${f.nodeLabel}` : ''}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
