import { Lock, ShieldX, SearchX, AlertTriangle, ArrowLeft, Home, LogIn } from 'lucide-react'

// The only HTTP errors this page presents (per design): unauthorized, forbidden,
// not-found. Anything else falls through to a neutral message.
export type ErrorCode = 401 | 403 | 404

interface ErrorMeta {
  code: string
  title: string
  message: string
  Icon: typeof Lock
  accent: string
}

const ERRORS: Record<number, ErrorMeta> = {
  401: {
    code: '401',
    title: 'Unauthorized',
    message: 'You need to be signed in to view this page. Please sign in and try again.',
    Icon: Lock,
    accent: 'var(--accent)',
  },
  403: {
    code: '403',
    title: 'Forbidden',
    message: "You don't have permission to access this resource. Ask an administrator if you think this is a mistake.",
    Icon: ShieldX,
    accent: 'var(--red)',
  },
  404: {
    code: '404',
    title: 'Page Not Found',
    message: "Sorry, we couldn't find the page you're looking for. It may have been moved or never existed.",
    Icon: SearchX,
    accent: 'var(--accent)',
  },
}

const GENERIC: ErrorMeta = {
  code: 'Error',
  title: 'Something went wrong',
  message: 'An unexpected error occurred.',
  Icon: AlertTriangle,
  accent: 'var(--accent)',
}

interface ErrorPageProps {
  /** HTTP status to present (defaults to 404). */
  code?: number
  /** Render as a full-screen overlay (used by the global error listener). */
  overlay?: boolean
  /** Called before navigating away, so the overlay can clear itself. */
  onDismiss?: () => void
}

export default function ErrorPage({ code = 404, overlay = false, onDismiss }: ErrorPageProps) {
  const e = ERRORS[code] ?? GENERIC
  const { Icon } = e

  const go = (path: string) => { onDismiss?.(); window.location.assign(path) }
  const back = () => {
    onDismiss?.()
    if (window.history.length > 1) window.history.back()
    else window.location.assign('/')
  }

  return (
    <div
      className="flex flex-col items-center justify-center text-center gap-4 px-6"
      style={
        overlay
          ? { position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--bg-950)' }
          : { minHeight: '70vh', width: '100%' }
      }
    >
      <div
        className="flex items-center justify-center rounded-2xl"
        style={{ width: 72, height: 72, background: 'var(--bg-900)', border: '1px solid var(--border)', color: e.accent }}
      >
        <Icon size={34} />
      </div>

      <p className="font-semibold text-lg" style={{ color: e.accent }}>{e.code} Error</p>
      <h2 className="text-3xl md:text-5xl font-bold text-[var(--text-primary)]">{e.title}</h2>
      <p className="text-sm text-[var(--text-secondary)] max-w-md leading-relaxed">{e.message}</p>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        {code === 401 ? (
          <button
            type="button"
            onClick={() => go('/login')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium text-white transition-all active:scale-95"
            style={{ background: 'var(--accent)' }}
          >
            <LogIn size={15} /> Sign in
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go('/')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium text-white transition-all active:scale-95"
            style={{ background: 'var(--accent)' }}
          >
            <Home size={15} /> Go home
          </button>
        )}
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-800)] hover:bg-[var(--bg-700)] transition-all active:scale-95"
        >
          <ArrowLeft size={15} /> Go back
        </button>
      </div>
    </div>
  )
}
