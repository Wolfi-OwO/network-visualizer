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
    <header className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 sm:px-4 py-1.5 sm:h-12 shrink-0 backdrop-blur-md bg-[var(--glass-bg)] border-b border-[var(--border)]">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)]">
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
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                isActive
                  ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-800)] hover:text-[var(--text-primary)]',
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
