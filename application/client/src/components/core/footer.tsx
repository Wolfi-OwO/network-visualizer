import { Code2 } from 'lucide-react'
import { appConfig } from '../../config/index.ts'

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
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <footer className="flex items-center justify-between gap-4 px-4 h-9 shrink-0 backdrop-blur-xl bg-[var(--glass-bg)] border-t border-[var(--glass-border)] text-[11px] text-[var(--text-muted)]">
      {/* Left — copyright */}
      <span className="truncate">
        © {year} {appConfig.company}. All Rights Reserved.
      </span>

      {/* Center — project / version (hover for full build metadata) */}
      <a
        href={appConfig.repoUrl}
        target="_blank"
        rel="noreferrer"
        title={buildInfo}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full glass hover:text-[var(--text-primary)] transition-colors"
      >
        <Code2 size={11} className="text-[var(--accent)]" />
        <span className="font-medium text-[var(--text-secondary)]">{appConfig.repoLabel}</span>
        <span>
          · {appConfig.mode === 'production' ? `v${appConfig.version}` : shortRev || 'dev'}
        </span>
      </a>

      {/* Right — links. Privacy/Impressum/Terms point at the repo's own
          markdown files (rendered by GitHub) rather than duplicating their
          content into the SPA build — see PRIVACY.md, IMPRESSUM.md,
          TERMS_OF_USE.md at the repo root. */}
      <nav className="flex items-center gap-4 font-medium text-[var(--text-secondary)] whitespace-nowrap">
        <a
          href={`${appConfig.repoUrl}/blob/main/PRIVACY.md`}
          target="_blank"
          rel="noreferrer"
          className="hover:text-[var(--text-primary)] transition-colors"
        >
          Privacy Policy
        </a>
        <a
          href={`${appConfig.repoUrl}/blob/main/IMPRESSUM.md`}
          target="_blank"
          rel="noreferrer"
          className="hover:text-[var(--text-primary)] transition-colors"
        >
          Impressum
        </a>
        <a
          href={`${appConfig.repoUrl}/blob/main/TERMS_OF_USE.md`}
          target="_blank"
          rel="noreferrer"
          className="hover:text-[var(--text-primary)] transition-colors"
        >
          Terms of Use
        </a>
        <a
          href={appConfig.repoUrl}
          target="_blank"
          rel="noreferrer"
          className="hover:text-[var(--text-primary)] transition-colors"
        >
          About
        </a>
      </nav>
    </footer>
  )
}
