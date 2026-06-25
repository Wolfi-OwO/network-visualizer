import type { ReactNode } from 'react'
import Sidebar, { type Page } from './Sidebar'

interface LayoutProps {
  current: Page
  onNavigate: (page: Page) => void
  children: ReactNode
}

export default function Layout({ current, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--bg-950)]">
      <Sidebar current={current} onChange={onNavigate} />
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}
