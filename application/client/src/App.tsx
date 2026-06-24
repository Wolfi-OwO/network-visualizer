import { useState } from 'react'
import Layout from './components/Layout/Layout'
import type { Page } from './components/Layout/Sidebar'
import DashboardPage from './components/Dashboard/DashboardPage'
import PacketCapturePage from './components/PacketCapture/PacketCapturePage'
import NetworkBuilderPage from './components/NetworkBuilder/NetworkBuilderPage'
import CIDRCalculatorPage from './components/CIDRCalculator/CIDRCalculatorPage'

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <Layout current={page} onNavigate={setPage}>
      {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
      {page === 'packets' && <PacketCapturePage />}
      {page === 'network' && <NetworkBuilderPage />}
      {page === 'cidr' && <CIDRCalculatorPage />}
    </Layout>
  )
}
