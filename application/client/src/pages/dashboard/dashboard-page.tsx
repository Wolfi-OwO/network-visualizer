import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PacketStats, NetworkTopology } from '../../types/index.ts'
import { capture as captureApi, network as networkApi } from '../../lib/api/index.ts'
import { meta as deviceMeta } from '../network/device-catalog.tsx'

const PROTO_COLORS: Record<string, string> = {
  HTTP: '#3fb950',
  DNS: '#58a6ff',
  TCP: '#8b949e',
  UDP: '#d29922',
  ICMP: '#f85149',
  ARP: '#bc8cff',
  TLS: '#ffa657',
}

const TOOLS = [
  {
    to: '/packets',
    name: 'Packet capture',
    desc: 'Live packet table with protocol tree and hex dump',
  },
  {
    to: '/network',
    name: 'Network builder',
    desc: 'Drag devices into a topology, set VLANs, routes and firewall rules',
  },
  { to: '/cidr', name: 'CIDR calculator', desc: 'Subnets, supernets and private range checks' },
]

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 pr-6 mr-6 border-r border-[var(--border)] last:border-r-0 last:mr-0">
      <dt className="text-[11px] text-[var(--text-muted)]">{label}</dt>
      <dd className="font-mono text-xl tabular-nums text-[var(--text-primary)]">{value}</dd>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<PacketStats | null>(null)
  const [topology, setTopology] = useState<NetworkTopology | null>(null)

  useEffect(() => {
    captureApi
      .get()
      .then((r) => setStats(r.data.stats))
      .catch(() => {})
    networkApi
      .getDefault()
      .then((r) => setTopology(r.data))
      .catch(() => {})
  }, [])

  const nodeTypes = topology
    ? topology.nodes.reduce<Record<string, number>>((acc, n) => {
        acc[n.type] = (acc[n.type] ?? 0) + 1
        return acc
      }, {})
    : {}

  const protoData = stats
    ? Object.entries(stats.byProtocol)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    : []

  const firewallRules = topology
    ? topology.nodes.reduce((sum, n) => sum + (n.config.firewallRules?.length ?? 0), 0)
    : '–'

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 gap-8 max-w-5xl">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">
          Overview
        </h1>
        <span className="text-[11px] text-[var(--text-muted)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--green)] mr-1.5" />
          Backend connected
        </span>
      </header>

      <dl className="flex flex-wrap gap-y-4">
        <Figure label="Nodes" value={topology?.nodes.length ?? '–'} />
        <Figure label="Links" value={topology?.edges.length ?? '–'} />
        <Figure label="Firewall rules" value={firewallRules} />
        <Figure label="Packets captured" value={stats?.total.toLocaleString() ?? '–'} />
        <Figure label="Rate" value={stats ? `${stats.packetsPerSecond.toFixed(1)} pkt/s` : '–'} />
      </dl>

      <section>
        <h2 className="text-[11px] text-[var(--text-muted)] mb-2">Tools</h2>
        <ul className="border-t border-[var(--border)]">
          {TOOLS.map((t) => (
            <li key={t.to} className="border-b border-[var(--border)]">
              <button
                onClick={() => navigate(t.to)}
                className="w-full flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-3 text-left hover:bg-[var(--bg-800)] transition-colors"
              >
                <span className="w-40 text-sm font-medium text-[var(--text-primary)]">
                  {t.name}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{t.desc}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section>
          <h2 className="text-[11px] text-[var(--text-muted)] mb-2">
            {topology?.name ?? 'Topology'}
          </h2>
          {topology ? (
            <>
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(nodeTypes).map(([type, count]) => (
                    <tr key={type} className="border-b border-[var(--border)]">
                      <td className="py-1.5 text-[var(--text-secondary)]">
                        {deviceMeta(type).label}
                      </td>
                      <td className="py-1.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                        {count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {topology.description && (
                <p className="text-[11px] text-[var(--text-muted)] mt-3">{topology.description}</p>
              )}
            </>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">No topology loaded.</p>
          )}
        </section>

        <section>
          <h2 className="text-[11px] text-[var(--text-muted)] mb-2">
            Protocols in the current capture
          </h2>
          {protoData.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              Nothing captured yet. Start a capture in Packet capture.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {protoData.map(([proto, count]) => {
                const pct = stats ? (count / stats.total) * 100 : 0
                return (
                  <li key={proto}>
                    <div className="flex items-center justify-between mb-1 font-mono text-[11px]">
                      <span className="text-[var(--text-secondary)]">{proto}</span>
                      <span className="tabular-nums text-[var(--text-muted)]">
                        {count} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-1 bg-[var(--bg-800)] overflow-hidden">
                      <div
                        className="h-full"
                        style={{ width: `${pct}%`, background: PROTO_COLORS[proto] ?? '#6e7681' }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
