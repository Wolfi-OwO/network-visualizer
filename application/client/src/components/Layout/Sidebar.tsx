import { Activity, Network, Calculator, LayoutDashboard, Shield, Radio } from 'lucide-react'

export type Page = 'dashboard' | 'packets' | 'network' | 'cidr'

const navItems = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'packets' as Page, label: 'Packet Capture', icon: Activity },
  { id: 'network' as Page, label: 'Network Builder', icon: Network },
  { id: 'cidr' as Page, label: 'CIDR Calculator', icon: Calculator },
]

interface SidebarProps {
  current: Page
  onChange: (page: Page) => void
}

export default function Sidebar({ current, onChange }: SidebarProps) {
  return (
    <aside className="flex flex-col w-52 shrink-0 bg-[var(--bg-900)] border-r border-[var(--border)]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--accent)]">
          <Radio size={14} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-[var(--text-primary)] leading-none">NetViz</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Network Visualizer</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        <div className="px-2 py-1.5 mb-1">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Tools</span>
        </div>
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={[
              'flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-xs font-medium transition-all text-left',
              current === id
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-800)] hover:text-[var(--text-primary)]',
            ].join(' ')}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--bg-800)]">
          <Shield size={12} className="text-[var(--green)] shrink-0" />
          <div>
            <div className="text-[10px] font-medium text-[var(--text-primary)]">Backend Connected</div>
            <div className="text-[10px] text-[var(--text-muted)]">localhost:3001</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
