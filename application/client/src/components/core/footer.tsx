import { Code2 } from 'lucide-react'
import { Link } from 'react-router-dom'
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

      {/* Right — links. These used to point at the repo's own markdown files on
          GitHub, to keep their content out of the SPA build. That made § 5 ECG
          compliance depend on a third party: the information has to be directly
          and permanently available *on the service*, and off-site links break
          the moment the repo goes private or GitHub is down. They are now in-app
          routes instead. The original concern still holds, so the documents are
          converted from the same markdown at build time and lazy-loaded per
          route — see build/markdown.js — rather than inlined into the bundle. */}
      <nav className="flex items-center gap-4 font-medium text-[var(--text-secondary)] whitespace-nowrap">
        <Link to="/privacy" className="hover:text-[var(--text-primary)] transition-colors">
          Privacy Policy
        </Link>
        <Link to="/impressum" className="hover:text-[var(--text-primary)] transition-colors">
          Impressum
        </Link>
        <Link to="/terms" className="hover:text-[var(--text-primary)] transition-colors">
          Terms of Use
        </Link>
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
