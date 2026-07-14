import { NavLink, useNavigate } from 'react-router-dom'
import {
  Activity,
  Network,
  Calculator,
  LayoutDashboard,
  Radio,
  LogIn,
  LogOut,
  User,
} from 'lucide-react'
import { useAuth } from '../context/auth-context.tsx'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/packets', label: 'Packet Capture', icon: Activity },
  { to: '/network', label: 'Network Builder', icon: Network },
  { to: '/cidr', label: 'CIDR Calculator', icon: Calculator },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <aside
      className={[
        'flex flex-col w-64 max-w-[80vw] shrink-0 bg-[var(--glass-bg)] border-r border-[var(--glass-border)]',
        'fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        open ? 'translate-x-0' : '-translate-x-full',
        'md:static md:z-auto md:w-52 md:max-w-none md:translate-x-0',
      ].join(' ')}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--glass-border)]">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--bg-800)] border border-[var(--border-strong)]">
          <Radio size={14} className="text-[var(--accent)]" />
        </div>
        <div>
          <div className="text-sm font-bold text-[var(--text-primary)] leading-none">NetViz</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Network Visualizer</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        <div className="px-2 py-1.5 mb-1">
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Tools
          </span>
        </div>
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              [
                'group relative flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-xs font-medium text-left',
                'transition-colors duration-150',
                isActive
                  ? 'bg-[var(--bg-800)] text-[var(--text-primary)] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-800)]/60 hover:text-[var(--text-primary)]',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={14} className={isActive ? 'text-[var(--accent)]' : ''} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Account */}
      <div className="p-3 border-t border-[var(--glass-border)]">
        {user ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--bg-800)] border border-[var(--border)]">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bg-700)] border border-[var(--border-strong)] shrink-0">
              <User size={12} className="text-[var(--accent)]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-medium text-[var(--text-primary)] truncate">
                {user.name}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] truncate">{user.role}</div>
            </div>
            <button
              onClick={() => signOut()}
              title="Sign out"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              navigate('/login')
              onClose?.()
            }}
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md bg-[var(--bg-800)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-700)] transition-colors"
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
