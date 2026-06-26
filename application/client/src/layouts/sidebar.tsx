import { NavLink, useNavigate } from 'react-router-dom'
import { Activity, Network, Calculator, LayoutDashboard, Radio, LogIn, LogOut, User } from 'lucide-react'
import { useAuth } from '../context/auth-context.tsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/packets', label: 'Packet Capture', icon: Activity },
  { to: '/network', label: 'Network Builder', icon: Network },
  { to: '/cidr', label: 'CIDR Calculator', icon: Calculator },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
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
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => [
              'flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-xs font-medium transition-all text-left',
              isActive
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-800)] hover:text-[var(--text-primary)]',
            ].join(' ')}
          >
            <Icon size={14} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Account */}
      <div className="p-3 border-t border-[var(--border)]">
        {user ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--bg-800)]">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] shrink-0">
              <User size={12} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-medium text-[var(--text-primary)] truncate">{user.name}</div>
              <div className="text-[10px] text-[var(--text-muted)] truncate">{user.role}</div>
            </div>
            <button onClick={() => signOut()} title="Sign out" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0">
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md bg-[var(--bg-800)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <LogIn size={13} className="text-[var(--accent)]" />
            <span className="text-[10px] font-medium">Sign in</span>
            <span className="text-[10px] text-[var(--text-muted)] ml-auto">local workspace</span>
          </button>
        )}
      </div>
    </aside>
  )
}
