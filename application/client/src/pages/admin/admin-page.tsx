import { useCallback, useEffect, useState } from 'react'
import { Database, Activity, Cpu, Users, GitBranch, ScrollText, RefreshCw, Download, ShieldAlert, Trash2, ShieldCheck } from 'lucide-react'
import { system, users as usersApi } from '../../lib/api/index.ts'
import type { Metrics, AdminUser, Role } from '../../lib/api/index.ts'
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

const ROLE_OPTIONS: Role[] = ['admin', 'editor', 'viewer']
const ROLE_DESC: Record<Role, string> = {
  admin: 'Full access — manage users, roles, metrics & the audit log',
  editor: 'Create & edit their own networks',
  viewer: 'Read-only — cannot modify data',
}
function apiError(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback
}

// Admin: assign roles to accounts (like a Google Workspace / M365 admin console).
function UsersPanel({ currentUserId }: { currentUserId?: string }) {
  const [list, setList] = useState<AdminUser[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try { const { data } = await usersApi.list(); setList(data.users) }
    catch { setError('Could not load users — administrators only.') }
  }, [])
  useEffect(() => { load() }, [load])

  const changeRole = async (u: AdminUser, role: Role) => {
    if (role === u.role) return
    setBusy(u.id); setError('')
    try { const { data } = await usersApi.setRole(u.id, role); setList(prev => prev.map(x => x.id === u.id ? data : x)) }
    catch (e) { setError(apiError(e, 'Failed to change role')) }
    finally { setBusy(null) }
  }
  const remove = async (u: AdminUser) => {
    if (!window.confirm(`Remove ${u.email}? This cannot be undone.`)) return
    setBusy(u.id); setError('')
    try { await usersApi.remove(u.id); setList(prev => prev.filter(x => x.id !== u.id)) }
    catch (e) { setError(apiError(e, 'Failed to remove user')) }
    finally { setBusy(null) }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={14} className="text-[var(--accent)]" />
        <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Users &amp; roles</div>
        <span className="text-[10px] text-[var(--text-muted)]">{list.length} account(s)</span>
      </div>
      {error && <div className="text-[11px] text-amber-400 mb-2">{error}</div>}
      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-[var(--bg-950)] text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2 font-medium">User</th>
              <th className="text-left px-3 py-2 font-medium">Provider</th>
              <th className="text-left px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map(u => (
              <tr key={u.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <div className="text-[var(--text-primary)] font-medium">{u.name}{u.id === currentUserId && <span className="text-[var(--text-muted)] font-normal"> (you)</span>}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{u.email}</div>
                </td>
                <td className="px-3 py-2 text-[var(--text-secondary)] capitalize">{u.provider}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    disabled={busy === u.id}
                    onChange={e => changeRole(u, e.target.value as Role)}
                    className="input text-[11px] h-7 py-0 px-2"
                    title={ROLE_DESC[u.role]}
                  >
                    {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => remove(u)} disabled={busy === u.id} className="text-[var(--text-muted)] hover:text-[var(--red)] disabled:opacity-40" title="Remove user">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-[var(--text-muted)]">No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[var(--text-muted)] mt-2 leading-relaxed">
        <b>admin</b> — full access (users, roles, metrics, audit). <b>editor</b> — create &amp; edit own networks. <b>viewer</b> — read-only.
        The last administrator can't be demoted or removed.
      </p>
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

      {user?.role === 'admin' && (
        <div className="mt-6">
          <UsersPanel currentUserId={user.id} />
        </div>
      )}
    </div>
  )
}
