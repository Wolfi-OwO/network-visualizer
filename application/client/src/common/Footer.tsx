import { Code2 } from 'lucide-react'
import { appConfig } from '../config'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="flex items-center justify-between gap-4 px-4 h-9 shrink-0 bg-[var(--bg-950)] border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
      {/* Left — copyright */}
      <span className="truncate">© {year} {appConfig.company}. All Rights Reserved.</span>

      {/* Center — project / version */}
      <a
        href={appConfig.repoUrl}
        target="_blank"
        rel="noreferrer"
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-800)] border border-[var(--border)] hover:text-[var(--text-primary)] transition-colors"
      >
        <Code2 size={11} className="text-[var(--accent)]" />
        <span className="font-medium text-[var(--text-secondary)]">{appConfig.repoLabel}</span>
        <span>· v{appConfig.version}</span>
      </a>

      {/* Right — links */}
      <nav className="flex items-center gap-4 font-medium text-[var(--text-secondary)] whitespace-nowrap">
        <a href={appConfig.repoUrl} target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)] transition-colors">About</a>
      </nav>
    </footer>
  )
}
