import { Code2, Activity } from 'lucide-react'
import { appConfig } from '../../config/index.ts'

// The status page lives on its own `status.` subdomain (like status.discord.com).
const statusUrl = `${location.protocol}//status.${location.host}`

export default function Footer() {
  const year = new Date().getFullYear()
  const shortRev = appConfig.revision ? appConfig.revision.slice(0, 7) : ''
  // Full build metadata shown on hover (OCI image annotations).
  const buildInfo = [
    appConfig.description,
    shortRev && `rev ${shortRev}`,
    appConfig.created && `built ${appConfig.created}`,
    `by ${appConfig.authors}`,
    appConfig.licenses && `${appConfig.licenses} license`,
  ].filter(Boolean).join(' · ')
  return (
    <footer className="flex items-center justify-between gap-4 px-4 h-9 shrink-0 bg-[var(--bg-950)] border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
      {/* Left — copyright */}
      <span className="truncate">© {year} {appConfig.company}. All Rights Reserved.</span>

      {/* Center — project / version (hover for full build metadata) */}
      <a
        href={appConfig.repoUrl}
        target="_blank"
        rel="noreferrer"
        title={buildInfo}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-800)] border border-[var(--border)] hover:text-[var(--text-primary)] transition-colors"
      >
        <Code2 size={11} className="text-[var(--accent)]" />
        <span className="font-medium text-[var(--text-secondary)]">{appConfig.repoLabel}</span>
        <span>· {appConfig.mode === 'production' ? `v${appConfig.version}` : (shortRev || 'dev')}</span>
      </a>

      {/* Right — links */}
      <nav className="flex items-center gap-4 font-medium text-[var(--text-secondary)] whitespace-nowrap">
        <a href={statusUrl} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
          <Activity size={11} className="text-[var(--green)]" /> Status
        </a>
        <a href={appConfig.repoUrl} target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)] transition-colors">About</a>
      </nav>
    </footer>
  )
}
