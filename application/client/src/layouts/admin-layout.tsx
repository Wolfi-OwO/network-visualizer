import { Outlet } from 'react-router-dom'
import TopNav from './top-nav.tsx'
import Footer from '../components/core/footer.tsx'

const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/', label: 'Back to App' },
]

// Layout for the administration area: horizontal top navigation instead of a sidebar.
export default function AdminLayout() {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <TopNav items={ADMIN_NAV} />
      <main className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
