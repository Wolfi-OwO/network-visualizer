import { createBrowserRouter, Navigate } from 'react-router-dom'
import RegularLayout from './layouts/regular-layout.tsx'
import AdminLayout from './layouts/admin-layout.tsx'
import ErrorPage from './layouts/error-page.tsx'
import DashboardPage from './pages/dashboard/dashboard-page.tsx'
import PacketCapturePage from './pages/packets/packet-capture-page.tsx'
import NetworkBuilderPage from './pages/network/network-builder-page.tsx'
import CIDRCalculatorPage from './pages/cidr/cidr-calculator-page.tsx'
import AdminPage from './pages/admin/admin-page.tsx'
import LoginPage from './pages/auth/login-page.tsx'
import StatusPage from './pages/status/status-page.tsx'

// URL ↔ layout/page mapping (React Browser Router).
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/status',
    element: <StatusPage />,
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
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    errorElement: <ErrorPage />,
    children: [{ index: true, element: <AdminPage /> }],
  },
])
