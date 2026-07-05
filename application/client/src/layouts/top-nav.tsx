import { NavLink } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { appConfig } from '../config/index.ts'

interface TopNavItem {
  to: string
  label: string
  end?: boolean
}

// Horizontal navigation bar (used by the admin layout).
export default function TopNav({ items }: { items: TopNavItem[] }) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 sm:px-4 py-1.5 sm:h-12 shrink-0 backdrop-blur-xl bg-[var(--glass-bg)] border-b border-[var(--glass-border)]">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] ring-1 ring-white/15 shadow-[0_0_16px_-3px_var(--glow-accent)]">
          <Radio size={12} className="text-white" />
        </div>
        <span className="text-sm font-bold text-[var(--text-primary)]">{appConfig.name}</span>
      </div>
      <nav className="flex items-center gap-1 flex-wrap">
        {items.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-[0.97]',
                isActive
                  ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white shadow-[0_4px_16px_-6px_var(--glow-accent)] ring-1 ring-white/10'
                  : 'text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-[var(--text-primary)]',
              ].join(' ')
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
