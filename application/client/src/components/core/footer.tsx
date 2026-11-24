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
  const link =
    'inline-flex min-h-8 items-center gap-2 whitespace-nowrap rounded-lg transition-colors duration-200 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] lg:min-h-0'
  // The same bar in every app (portfolio-webpage is the reference): one row at lg and up with three zones, 13px
  // type throughout, the full width of the window, so it holds on a 34-inch screen as well as a laptop.
  return (
    <footer className="relative z-20 shrink-0 border-t border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="grid w-full grid-cols-2 items-center gap-x-4 text-[13px] lg:h-10 lg:grid-cols-[1fr_auto_1fr]">
        <p className="order-last col-span-2 flex flex-wrap items-center justify-center gap-x-2 justify-self-center pb-1.5 pt-0.5 text-center text-[var(--text-muted)] sm:col-span-1 sm:justify-self-start sm:text-left lg:order-none lg:py-0">
          <span className="whitespace-nowrap">
            <span className="font-mono">© {year}</span> {appConfig.company}
          </span>
          <span className="hidden whitespace-nowrap sm:inline">All Rights Reserved.</span>
        </p>

        {/* Centre: project and version, hover for the full build metadata */}
        <div className="order-last hidden justify-self-end py-3 sm:block lg:order-none lg:justify-self-center lg:py-0">
          <a
            href={appConfig.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={buildInfo}
            className="group inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <span className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-[var(--bg-700)] px-2.5 py-1 font-mono text-[var(--text-muted)] transition-colors duration-200 group-hover:border-[var(--accent)]">
              <Code2 className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="text-[var(--text-primary)]">{appConfig.repoLabel}</span>
              <span className="text-[var(--glass-border)]">·</span>
              <span>
                {appConfig.mode === 'production' ? `v${appConfig.version}` : shortRev || 'dev'}
              </span>
            </span>
          </a>
        </div>

        {/* Links. These are in-app routes, not links to the repo's markdown: § 5 ECG wants the information on the
            service itself, and the documents are converted from the same markdown at build time (tooling/markdown.js). */}
        <ul
          aria-label="Legal and contact"
          className="order-first col-span-2 flex flex-wrap items-center justify-center gap-x-5 justify-self-stretch font-medium text-[var(--text-muted)] lg:order-none lg:col-span-1 lg:gap-4 lg:justify-self-end"
        >
          <li>
            <a
              href="https://status.woofi-developments.at"
              target="_blank"
              rel="noopener noreferrer"
              className={link}
            >
              <span className="animate-live h-1.5 w-1.5 rounded-full bg-[var(--live)]" />
              Status
            </a>
          </li>
          <li>
            <Link to="/impressum" className={link}>
              Impressum
            </Link>
          </li>
          <li>
            <Link to="/privacy" className={link}>
              Privacy Policy
            </Link>
          </li>
          <li>
            <a href="https://www.woofi-developments.at/contact" className={link}>
              Contact
            </a>
          </li>
          <li>
            <Link to="/terms" className={link}>
              Terms of Use
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  )
}
