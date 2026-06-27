import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radio, LogIn } from 'lucide-react'
import { auth, type ProvidersInfo } from '../../lib/api/index.ts'
import { useAuth } from '../../context/auth-context.tsx'
import { appConfig } from '../../config/index.ts'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, refresh } = useAuth()
  const [info, setInfo] = useState<ProvidersInfo | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { auth.providers().then(r => setInfo(r.data)).catch(() => {}) }, [])
  useEffect(() => { if (user) navigate('/', { replace: true }) }, [user, navigate])
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('error')
    if (fromUrl) setError(fromUrl)
  }, [])

  const devLogin = async () => {
    if (!email.trim()) { setError('Enter an email'); return }
    setBusy(true); setError('')
    try {
      await auth.devLogin(email.trim(), name.trim() || undefined)
      await refresh()
      navigate('/', { replace: true })
    } catch {
      setError('Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full w-full bg-[var(--bg-950)] p-6">
      <div className="w-full max-w-sm rounded-xl bg-[var(--bg-900)] border border-[var(--border)] p-6 shadow-xl">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--accent)]">
            <Radio size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)] leading-none">{appConfig.name}</div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Sign in to your workspace</div>
          </div>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-[11px] text-red-400">
            {error}
          </div>
        )}

        {/* OAuth providers */}
        <div className="space-y-2">
          {info?.providers.includes('google') && (
            <a href={auth.oauthUrl('google')} className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md text-xs font-medium bg-white text-gray-800 hover:opacity-90">
              <span className="font-bold text-[#4285F4]">G</span> Sign in with Google
            </a>
          )}
          {info?.providers.includes('microsoft') && (
            <a href={auth.oauthUrl('microsoft')} className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-md text-xs font-medium bg-[#2f2f2f] text-white hover:opacity-90 border border-[var(--border)]">
              <span className="font-bold text-[#00a4ef]">⊞</span> Sign in with Microsoft
            </a>
          )}
          {info && info.providers.length === 0 && (
            <p className="text-[10px] text-[var(--text-muted)] text-center">
              No OAuth providers configured. Set GOOGLE_CLIENT_ID / MICROSOFT_CLIENT_ID to enable them.
            </p>
          )}
        </div>

        {/* Local dev login */}
        {info?.devLogin && (
          <>
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">or local login</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
            <div className="space-y-2">
              <input className="input w-full text-sm" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && devLogin()} />
              <input className="input w-full text-sm" placeholder="Display name (optional)" value={name}
                onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && devLogin()} />
              {error && <div className="text-[11px] text-red-400">{error}</div>}
              <button onClick={devLogin} disabled={busy} className="btn-primary w-full justify-center">
                <LogIn size={12} /> {busy ? 'Signing in…' : 'Continue'}
              </button>
            </div>
          </>
        )}

        <button onClick={() => navigate('/')} className="mt-4 w-full text-center text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          Continue without signing in (local workspace)
        </button>
      </div>
    </div>
  )
}
