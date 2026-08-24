import { createBrowserRouter } from 'react-router-dom'
import RegularLayout from './layouts/regular-layout.tsx'
import AdminLayout from './layouts/admin-layout.tsx'
import ErrorPage from './layouts/error-page.tsx'
import DashboardPage from './pages/dashboard/dashboard-page.tsx'
import PacketCapturePage from './pages/packets/packet-capture-page.tsx'
import NetworkBuilderPage from './pages/network/network-builder-page.tsx'
import CIDRCalculatorPage from './pages/cidr/cidr-calculator-page.tsx'
import AdminPage from './pages/admin/admin-page.tsx'
import LoginPage from './pages/auth/login-page.tsx'
import LegalPage from './pages/legal/legal-page.tsx'

// § 5 ECG requires the legal information to be available on the service itself,
// so each document gets an in-app route. The HTML is produced from the repo-root
// markdown at build time and lazy-loaded, so it costs the main bundle nothing.
const legalRoute = (path: string, load: () => Promise<{ title: string; html: string }>) => ({
  path,
  lazy: async () => {
    const { title, html } = await load()
    return { Component: () => <LegalPage title={title} html={html} /> }
  },
})

// URL <-> layout/page mapping (React Browser Router).
// NOTE: the status page is not a route here — it is served on its own `status.`
// subdomain (see main.tsx), the way status.discord.com / status.anthropic.com do.
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/',
    element: <RegularLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'packets', element: <PacketCapturePage /> },
      { path: 'network', element: <NetworkBuilderPage /> },
      { path: 'cidr', element: <CIDRCalculatorPage /> },
      legalRoute('privacy', () => import('virtual:legal/privacy')),
      legalRoute('impressum', () => import('virtual:legal/impressum')),
      legalRoute('terms', () => import('virtual:legal/terms')),
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    errorElement: <ErrorPage />,
    children: [{ index: true, element: <AdminPage /> }],
  },
])
