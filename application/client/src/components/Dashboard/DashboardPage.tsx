import { useEffect, useState } from 'react'
import { Activity, Network, Calculator, Server, Shield, Wifi, ArrowRight } from 'lucide-react'
import type { PacketStats, NetworkTopology } from '../../types'
import { packets as packetsApi, network as networkApi } from '../../api/client'
import type { Page } from '../Layout/Sidebar'

const PROTO_COLORS: Record<string, string> = {
  HTTP: '#3fb950', DNS: '#58a6ff', TCP: '#8b949e',
  UDP: '#d29922', ICMP: '#f85149', ARP: '#bc8cff', TLS: '#ffa657',
}

interface DashboardPageProps {
  onNavigate: (page: Page) => void
}

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; color: string
}) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + '22' }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <div className="text-xl font-bold text-[var(--text-primary)] leading-none">{value}</div>
        <div className="text-xs text-[var(--text-secondary)] mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

function QuickAction({ label, desc, icon, color, onClick }: {
  label: string; desc: string; icon: React.ReactNode; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card p-4 flex items-center gap-3 hover:border-[var(--accent)] transition-all text-left w-full group"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '22' }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex-1">
        <div className="text-xs font-semibold text-[var(--text-primary)]">{label}</div>
        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{desc}</div>
      </div>
      <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors shrink-0" />
    </button>
  )
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [stats, setStats] = useState<PacketStats | null>(null)
  const [topology, setTopology] = useState<NetworkTopology | null>(null)

  useEffect(() => {
    packetsApi.stats().then(r => setStats(r.data)).catch(() => {})
    networkApi.getDefault().then(r => setTopology(r.data)).catch(() => {})
  }, [])

  const nodeTypes = topology
    ? topology.nodes.reduce<Record<string, number>>((acc, n) => {
        acc[n.type] = (acc[n.type] ?? 0) + 1
        return acc
      }, {})
    : {}

  const protoData = stats
    ? Object.entries(stats.byProtocol).sort((a, b) => b[1] - a[1]).slice(0, 6)
    : []

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 space-y-5">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">NetViz Dashboard</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Network visualization, packet analysis & subnet tools
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-800)] border border-[var(--border)]">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse" />
          <span className="text-[11px] text-[var(--text-secondary)]">Backend connected</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Packets Captured"
          value={stats?.total.toLocaleString() ?? '—'}
          sub={stats ? `${stats.packetsPerSecond.toFixed(1)} pkt/s` : 'start capture to begin'}
          icon={<Activity size={18} />}
          color="#58a6ff"
        />
        <StatCard
          label="Network Nodes"
          value={topology?.nodes.length ?? '—'}
          sub={topology ? `${topology.edges.length} connections` : undefined}
          icon={<Server size={18} />}
          color="#3fb950"
        />
        <StatCard
          label="Network Links"
          value={topology?.edges.length ?? '—'}
          sub="active connections"
          icon={<Wifi size={18} />}
          color="#d29922"
        />
        <StatCard
          label="Firewall Rules"
          value={topology?.nodes.reduce((s, n) => s + (n.config.firewallRules?.length ?? 0), 0) ?? '—'}
          sub="across all devices"
          icon={<Shield size={18} />}
          color="#f85149"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Quick actions */}
        <div className="col-span-1 space-y-2">
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Quick Access</div>
          <QuickAction
            label="Packet Capture"
            desc="Wireshark-like live capture"
            icon={<Activity size={18} />}
            color="#58a6ff"
            onClick={() => onNavigate('packets')}
          />
          <QuickAction
            label="Network Builder"
            desc="Design & configure topologies"
            icon={<Network size={18} />}
            color="#3fb950"
            onClick={() => onNavigate('network')}
          />
          <QuickAction
            label="CIDR Calculator"
            desc="Subnet & supernet calculator"
            icon={<Calculator size={18} />}
            color="#d29922"
            onClick={() => onNavigate('cidr')}
          />
        </div>

        {/* Protocol distribution */}
        <div className="card p-4">
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Protocol Distribution</div>
          {protoData.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-[var(--text-muted)]">
              Start packet capture to see stats
            </div>
          ) : (
            <div className="space-y-2">
              {protoData.map(([proto, count]) => {
                const pct = stats ? (count / stats.total) * 100 : 0
                return (
                  <div key={proto}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-mono text-[var(--text-secondary)]">{proto}</span>
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">{count} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-700)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: PROTO_COLORS[proto] ?? '#484f58' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Topology summary */}
        <div className="card p-4">
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            {topology?.name ?? 'Network Topology'}
          </div>
          {topology ? (
            <div className="space-y-2">
              {Object.entries(nodeTypes).map(([type, count]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-sm">
                    {{ router: '🔀', switch: '🔌', firewall: '🛡️', pc: '💻', server: '🖥️',
                       hub: '⭕', cloud: '☁️', wifiap: '📡', phone: '📱', printer: '🖨️' }[type] ?? '📦'}
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)] flex-1 capitalize">{type}</span>
                  <span className="text-[11px] font-mono text-[var(--text-primary)]">{count}</span>
                </div>
              ))}
              {topology.description && (
                <p className="text-[10px] text-[var(--text-muted)] pt-2 border-t border-[var(--border)] mt-2">
                  {topology.description}
                </p>
              )}
            </div>
          ) : (
            <div className="text-xs text-[var(--text-muted)]">Loading topology…</div>
          )}
        </div>
      </div>

      {/* Feature overview */}
      <div className="card p-5">
        <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Features</div>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              icon: '🦈',
              title: 'Packet Capture',
              items: ['Live SSE packet stream', 'Wireshark-style packet table', 'Protocol tree / hex dump', 'Filter by IP, protocol, port', 'Export as JSON'],
            },
            {
              icon: '🗺️',
              title: 'Network Builder',
              items: ['Drag-and-drop topology', 'Routers, switches, firewalls', 'VLAN configuration', 'Routing table editor', 'Firewall rule manager'],
            },
            {
              icon: '🧮',
              title: 'CIDR Calculator',
              items: ['Network / broadcast / hosts', 'Binary representation', 'Subnet splitter', 'Supernet calculator', 'Private range detection'],
            },
          ].map(({ icon, title, items }) => (
            <div key={title}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{icon}</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">{title}</span>
              </div>
              <ul className="space-y-1">
                {items.map(item => (
                  <li key={item} className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                    <span className="text-[var(--green)] text-[10px]">✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
