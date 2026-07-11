import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Network, Calculator, Server, Shield, Wifi, ArrowRight } from 'lucide-react'
import type { PacketStats, NetworkTopology } from '../../types/index.ts'
import { capture as captureApi, network as networkApi } from '../../lib/api/index.ts'
import { meta as deviceMeta } from '../network/device-catalog.tsx'

const PROTO_COLORS: Record<string, string> = {
  HTTP: '#3fb950', DNS: '#58a6ff', TCP: '#8b949e',
  UDP: '#d29922', ICMP: '#f85149', ARP: '#bc8cff', TLS: '#ffa657',
}

// A small tinted chip for an icon — flat fill + hairline border in the accent
// color. No glow: it should read as a printed label, not a light source.
function IconChip({ color, children, size = 9 }: { color: string; children: React.ReactNode; size?: number }) {
  const dim = size * 4 // tailwind unit -> px, kept in sync with w-/h- below
  return (
    <div
      className="flex items-center justify-center rounded-md shrink-0"
      style={{ width: dim, height: dim, background: color + '14', border: `1px solid ${color}33`, color }}
    >
      {children}
    </div>
  )
}

// Section heading — a short accent tick + label. The tick is the only structural
// flourish, and it encodes "new section" rather than decorating one.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="h-3.5 w-0.5 rounded-full bg-[var(--accent)]" />
      <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{children}</span>
    </div>
  )
}

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; color: string
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
        <IconChip color={color} size={7}>{icon}</IconChip>
      </div>
      <div className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)] leading-none">
        {value}
      </div>
      {sub && <div className="text-[11px] text-[var(--text-muted)] mt-1.5 truncate">{sub}</div>}
    </div>
  )
}

function QuickAction({ label, desc, icon, color, onClick }: {
  label: string; desc: string; icon: React.ReactNode; color: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card card-hover p-3 flex items-center gap-3 text-left w-full group active:scale-[0.99]"
    >
      <IconChip color={color} size={9}>{icon}</IconChip>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-[var(--text-primary)]">{label}</div>
        <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{desc}</div>
      </div>
      <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors shrink-0" />
    </button>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<PacketStats | null>(null)
  const [topology, setTopology] = useState<NetworkTopology | null>(null)

  useEffect(() => {
    captureApi.get().then(r => setStats(r.data.stats)).catch(() => {})
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

  const features = [
    {
      icon: <Activity size={15} />, color: '#58a6ff', title: 'Packet Capture',
      items: ['Live SSE packet stream', 'Wireshark-style packet table', 'Protocol tree / hex dump', 'Filter by IP, protocol, port', 'Export as JSON'],
    },
    {
      icon: <Network size={15} />, color: '#3fb950', title: 'Network Builder',
      items: ['Drag-and-drop topology', 'Routers, switches, firewalls', 'VLAN configuration', 'Routing table editor', 'Firewall rule manager'],
    },
    {
      icon: <Calculator size={15} />, color: '#d29922', title: 'CIDR Calculator',
      items: ['Network / broadcast / hosts', 'Binary representation', 'Subnet splitter', 'Supernet calculator', 'Private range detection'],
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-5 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Dashboard</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Network visualization, packet analysis and subnet tools
          </p>
        </div>
        <div className="glass flex items-center gap-2 px-2.5 py-1.5 rounded-md">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
          <span className="text-[11px] text-[var(--text-secondary)]">Backend connected</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Packets captured"
          value={stats?.total.toLocaleString() ?? '—'}
          sub={stats ? `${stats.packetsPerSecond.toFixed(1)} pkt/s` : 'Start capture to begin'}
          icon={<Activity size={13} />}
          color="#58a6ff"
        />
        <StatCard
          label="Network nodes"
          value={topology?.nodes.length ?? '—'}
          sub={topology ? `${topology.edges.length} connections` : 'No topology loaded'}
          icon={<Server size={13} />}
          color="#3fb950"
        />
        <StatCard
          label="Network links"
          value={topology?.edges.length ?? '—'}
          sub="Active connections"
          icon={<Wifi size={13} />}
          color="#d29922"
        />
        <StatCard
          label="Firewall rules"
          value={topology?.nodes.reduce((s, n) => s + (n.config.firewallRules?.length ?? 0), 0) ?? '—'}
          sub="Across all devices"
          icon={<Shield size={13} />}
          color="#f85149"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick actions */}
        <div className="lg:col-span-1">
          <SectionLabel>Quick access</SectionLabel>
          <div className="space-y-2">
            <QuickAction
              label="Packet Capture"
              desc="Wireshark-like live capture"
              icon={<Activity size={16} />}
              color="#58a6ff"
              onClick={() => navigate('/packets')}
            />
            <QuickAction
              label="Network Builder"
              desc="Design and configure topologies"
              icon={<Network size={16} />}
              color="#3fb950"
              onClick={() => navigate('/network')}
            />
            <QuickAction
              label="CIDR Calculator"
              desc="Subnet and supernet calculator"
              icon={<Calculator size={16} />}
              color="#d29922"
              onClick={() => navigate('/cidr')}
            />
          </div>
        </div>

        {/* Protocol distribution */}
        <div className="card p-4">
          <SectionLabel>Protocol distribution</SectionLabel>
          {protoData.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-xs text-[var(--text-muted)]">
              Start packet capture to see protocol stats
            </div>
          ) : (
            <div className="space-y-2.5">
              {protoData.map(([proto, count]) => {
                const pct = stats ? (count / stats.total) * 100 : 0
                return (
                  <div key={proto}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-mono text-[var(--text-secondary)]">{proto}</span>
                      <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)]">{count} ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-800)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: PROTO_COLORS[proto] ?? '#6e7681' }}
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
          <SectionLabel>{topology?.name ?? 'Network topology'}</SectionLabel>
          {topology ? (
            <div className="space-y-2">
              {Object.entries(nodeTypes).map(([type, count]) => {
                const { Icon, color, label } = deviceMeta(type)
                return (
                  <div key={type} className="flex items-center gap-2">
                    <IconChip color={color} size={5}><Icon size={12} /></IconChip>
                    <span className="text-[11px] text-[var(--text-secondary)] flex-1">{label}</span>
                    <span className="text-[11px] font-mono tabular-nums text-[var(--text-primary)]">{count}</span>
                  </div>
                )
              })}
              {topology.description && (
                <p className="text-[11px] text-[var(--text-muted)] pt-2 border-t border-[var(--border)] mt-2">
                  {topology.description}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-24 text-xs text-[var(--text-muted)]">
              No topology loaded
            </div>
          )}
        </div>
      </div>

      {/* Feature overview */}
      <div className="card p-5">
        <SectionLabel>What you can do</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5">
          {features.map(({ icon, color, title, items }) => (
            <div key={title}>
              <div className="flex items-center gap-2 mb-2.5">
                <IconChip color={color} size={7}>{icon}</IconChip>
                <span className="text-xs font-semibold text-[var(--text-primary)]">{title}</span>
              </div>
              <ul className="space-y-1.5">
                {items.map(item => (
                  <li key={item} className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    <span className="h-1 w-1 rounded-full bg-[var(--text-muted)] shrink-0" /> {item}
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
