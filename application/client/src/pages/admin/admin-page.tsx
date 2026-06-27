import { useCallback, useEffect, useState } from 'react'
import { Database, Activity, Cpu, Users, GitBranch, ScrollText, RefreshCw, Download, ShieldAlert } from 'lucide-react'
import { system } from '../../lib/api/index.ts'
import type { Metrics } from '../../lib/api/index.ts'
import { useAuth } from '../../context/auth-context.tsx'

function fmtUptime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Cpu; label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-[var(--bg-900)] border border-[var(--border)]">
      <Icon size={18} className="text-[var(--accent)] shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
        <div className="text-sm font-medium text-[var(--text-primary)] truncate">{value}</div>
        {sub && <div className="text-[10px] text-[var(--text-muted)]">{sub}</div>}
      </div>
    </div>
  )
}

// Admin observability dashboard — live runtime + application metrics.
export default function AdminPage() {
  const { user } = useAuth()
  const [m, setM] = useState<Metrics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await system.metrics()
      setM(data)
    } catch {
      setError('Metrics are available to administrators only.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 5000)   // live refresh
    return () => clearInterval(iv)
  }, [load])

  const download = () => {
    if (!m) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = `netviz-metrics-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Administration</h1>
        <div className="flex-1" />
        <button onClick={load} className="btn-ghost text-xs"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} />Refresh</button>
        {m && <button onClick={download} className="btn-ghost text-xs"><Download size={12} />Report</button>}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-[var(--bg-900)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
          <ShieldAlert size={16} className="text-amber-400" />
          {error} {!user && <span>Sign in as an admin to view system metrics.</span>}
        </div>
      )}

      {m && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={Activity} label="Status" value={m.status === 'ok' ? 'Healthy' : m.status} sub={`up ${fmtUptime(m.uptimeSeconds)}`} />
            <Stat icon={Cpu} label="Memory (heap)" value={`${m.process.memoryMB.heapUsed} MB`} sub={`rss ${m.process.memoryMB.rss} MB · ${m.process.node}`} />
            <Stat icon={ScrollText} label="API requests" value={m.requests.toLocaleString()} />
            <Stat icon={Database} label="Database" value={m.database.state} />
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Stored data</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={GitBranch} label="Topologies" value={m.database.topologies} />
              <Stat icon={Users} label="Users" value={m.database.users} />
              <Stat icon={GitBranch} label="Versions" value={m.database.versions} />
              <Stat icon={ScrollText} label="Audit entries" value={m.database.auditEntries} />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Packet capture</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={Activity} label="Capturing" value={m.capture.capturing ? 'Yes ●' : 'No'} />
              <Stat icon={Activity} label="Packets" value={m.capture.packets.toLocaleString()} />
              <Stat icon={Activity} label="Packets/s" value={m.capture.packetsPerSecond} />
              <Stat icon={Activity} label="Auth providers" value={m.auth.providers.join(', ') || 'local only'} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
