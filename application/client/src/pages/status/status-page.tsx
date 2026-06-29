import { useCallback, useEffect, useState } from 'react'
import { Radio, CheckCircle, AlertTriangle, XCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { system } from '../../lib/api/index.ts'
import type { StatusReport, StatusComponent } from '../../lib/api/index.ts'
import { appConfig } from '../../config/index.ts'

function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const BADGE: Record<string, { label: string; cls: string; Icon: typeof CheckCircle }> = {
  operational: { label: 'Operational', cls: 'text-[var(--green)]', Icon: CheckCircle },
  degraded: { label: 'Degraded', cls: 'text-amber-400', Icon: AlertTriangle },
  down: { label: 'Down', cls: 'text-red-400', Icon: XCircle },
  idle: { label: 'Idle', cls: 'text-[var(--text-muted)]', Icon: CheckCircle },
}

function UptimeBar({ history }: { history: { ok: boolean; db: boolean }[] }) {
  // Pad to 90 segments (Discord-style 90-bar history).
  const bars = Array.from({ length: 90 }, (_, i) => history[history.length - 90 + i])
  return (
    <div className="flex gap-[2px] h-7 items-stretch">
      {bars.map((b, i) => (
        <div
          key={i}
          title={b ? (b.ok ? 'Operational' : 'Down') : 'No data'}
          className={`flex-1 rounded-[1px] ${b ? (b.ok && b.db ? 'bg-[var(--green)]' : 'bg-red-400') : 'bg-[var(--bg-700)]'}`}
        />
      ))}
    </div>
  )
}

// Public, Discord-style status page with live uptime tracking.
export default function StatusPage() {
  const [report, setReport] = useState<StatusReport | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await system.status()
      setReport(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    const iv = setInterval(load, 15000)
    return () => clearInterval(iv)
  }, [load])

  const overall = report ? (BADGE[report.status] ?? BADGE.operational) : BADGE.operational

  return (
    <div className="h-full w-full overflow-y-auto bg-[var(--bg-950)]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--accent)]">
            <Radio size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold text-[var(--text-primary)]">{appConfig.name} Status</span>
          <div className="flex-1" />
          <button onClick={load} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Overall banner */}
        <div className={`flex items-center gap-3 p-5 rounded-xl border mb-6 ${
          report?.status === 'operational' || !report
            ? 'bg-[var(--green)]/10 border-[var(--green)]/30'
            : report.status === 'degraded' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'
        }`}>
          <overall.Icon size={26} className={overall.cls} />
          <div>
            <div className="text-base font-bold text-[var(--text-primary)]">
              {report?.status === 'operational' || !report ? 'All Systems Operational' : overall.label}
            </div>
            {report && (
              <div className="text-[11px] text-[var(--text-muted)]">
                Current uptime: {fmtUptime(report.currentUptimeSeconds)} · sampling every {report.sampleIntervalMs / 1000}s
              </div>
            )}
          </div>
        </div>

        {/* Components */}
        <div className="rounded-xl bg-[var(--bg-900)] border border-[var(--border)] px-5">
          {report?.components.map((c) => (
            <ComponentRowWithHistory key={c.key} c={c} history={report.history} />
          ))}
          {!report && <div className="py-6 text-xs text-[var(--text-muted)]">Loading status…</div>}
        </div>

        <a
          href={`${location.protocol}//${location.host.replace(/^status\./, '')}`}
          className="inline-flex items-center gap-1.5 mt-6 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={12} /> Back to {appConfig.name}
        </a>
      </div>
    </div>
  )
}

// The overall history applies to api/db components; idle capture has no bar.
function ComponentRowWithHistory({ c, history }: { c: StatusComponent; history: StatusReport['history'] }) {
  const badge = BADGE[c.status] ?? BADGE.idle
  return (
    <div className="py-3 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-[var(--text-primary)]">{c.name}</span>
        <span className={`flex items-center gap-1.5 text-xs ${badge.cls}`}>
          <badge.Icon size={13} /> {badge.label}
        </span>
      </div>
      {c.uptime && (
        <>
          <UptimeBar history={history} />
          <div className="text-[10px] text-[var(--text-muted)] flex justify-between mt-1 font-mono">
            <span>{c.uptime.d30}% · 30 days</span>
            <span>{c.uptime.d7}% · 7d</span>
            <span>{c.uptime.h24}% · 24h</span>
          </div>
        </>
      )}
    </div>
  )
}
