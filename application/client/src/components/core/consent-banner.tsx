import { useEffect, useState } from 'react'
import { appConfig } from '../../config/index.ts'
import { getAnalyticsConsent, setAnalyticsConsent } from '../../lib/consent.ts'

// Preventive: NetViz loads no analytics or tracking script today (PRIVACY.md
// §9). This exists so that whenever one is added, it has a consent decision
// to check instead of shipping unconditionally on day one.
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(getAnalyticsConsent() === null)
  }, [])

  if (!visible) return null

  const decide = (accepted: boolean) => {
    setAnalyticsConsent(accepted)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 text-sm text-[var(--text-secondary)] backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>
          We don&apos;t use analytics cookies today. If that changes, your choice here decides
          whether they load.{' '}
          <a
            href={`${appConfig.repoUrl}/blob/main/PRIVACY.md`}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-[var(--text-primary)]"
          >
            Learn more
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide(false)}
            className="rounded border border-[var(--border-strong)] px-3 py-1.5 font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-800)] hover:text-[var(--text-primary)] transition-colors"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className="rounded bg-[var(--accent)] px-3 py-1.5 font-medium text-[var(--bg-800)] hover:opacity-90 transition-opacity"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
