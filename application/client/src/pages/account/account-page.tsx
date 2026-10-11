import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { account } from '../../lib/api/index.ts'
import { useAuth } from '../../context/auth-context.tsx'

// Art. 12(2) DSGVO: exercising the access, portability and erasure rights has to
// be easy. Both actions were already implemented server-side; this is the only
// place a user can reach them without reading the source.
export default function AccountPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<'export' | 'erase' | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) {
    return (
      <div className="p-6 text-sm text-[var(--text-secondary)]">
        <Link to="/login" className="text-[var(--accent)]">
          Sign in
        </Link>{' '}
        to export or delete your account data.
      </div>
    )
  }

  async function download() {
    setBusy('export')
    setError(null)
    try {
      const { data } = await account.exportData()
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'user_data_export.json'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('The export failed. Try again in a moment.')
    } finally {
      setBusy(null)
    }
  }

  async function erase() {
    setBusy('erase')
    setError(null)
    try {
      await account.erase()
      await signOut()
      navigate('/', { replace: true })
    } catch {
      // The server refuses to remove the last admin so the instance is never locked out.
      setError(
        'The account could not be deleted. If you are the only admin, promote another user first.',
      )
      setConfirming(false)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <header>
        <h1 className="text-base font-semibold text-[var(--text-primary)]">Your account</h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {user.name} · {user.email} · signed in with {user.provider}
        </p>
      </header>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Export your data</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Downloads your profile, all your networks and your audit-log entries as one JSON file
          (Art. 15 and 20 DSGVO).
        </p>
        <button
          onClick={download}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--bg-800)] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-700)] disabled:opacity-50"
        >
          <Download size={13} /> {busy === 'export' ? 'Preparing…' : 'Download my data'}
        </button>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Delete your account</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          Removes your account and every network and version you created, immediately and
          permanently (Art. 17 DSGVO). Audit-log entries are kept for 90 days and then deleted
          automatically, as described in the{' '}
          <Link to="/privacy" className="text-[var(--accent)]">
            privacy policy
          </Link>
          .
        </p>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button
              onClick={erase}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
            >
              <Trash2 size={13} /> {busy === 'erase' ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy !== null}
              className="px-3 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 size={13} /> Delete my account
          </button>
        )}
      </section>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
