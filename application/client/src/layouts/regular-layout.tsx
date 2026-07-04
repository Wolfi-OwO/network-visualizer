import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Radio } from 'lucide-react'
import Sidebar from './sidebar.tsx'
import Footer from '../components/core/footer.tsx'
import { appConfig } from '../config/index.ts'

// Default layout for the app: sidebar navigation + page content + persistent footer.
// Below `md`, the sidebar becomes a slide-in drawer opened from this bar's hamburger button.
export default function RegularLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[var(--bg-950)]">
      <header className="flex md:hidden items-center gap-2.5 px-3 h-12 shrink-0 backdrop-blur-md bg-[var(--glass-bg)] border-b border-[var(--border)]">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="p-1.5 -ml-1 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-800)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)]">
          <Radio size={12} className="text-white" />
        </div>
        <span className="text-sm font-bold text-[var(--text-primary)]">{appConfig.name}</span>
      </header>

      {/* Sidebar + page content share the remaining height; the footer is always visible below. */}
      <div className="flex flex-1 min-h-0 relative">
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            aria-hidden="true"
          />
        )}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}
