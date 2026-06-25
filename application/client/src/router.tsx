import { createBrowserRouter, Navigate } from 'react-router-dom'
import Layout from './layouts/Layout'
import DashboardPage from './pages/DashboardPage'
import PacketCapturePage from './pages/PacketCapturePage'
import NetworkBuilderPage from './pages/NetworkBuilderPage'
import CIDRCalculatorPage from './pages/CIDRCalculatorPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'packets', element: <PacketCapturePage /> },
      { path: 'network', element: <NetworkBuilderPage /> },
      { path: 'cidr', element: <CIDRCalculatorPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
