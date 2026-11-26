import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Network, Calculator, ArrowUpRight } from 'lucide-react'
import type { PacketStats, NetworkTopology } from '../../types/index.ts'
import { capture as captureApi, network as networkApi } from '../../lib/api/index.ts'
import { meta as deviceMeta } from '../network/device-catalog.tsx'

const PROTO_COLORS: Record<string, string> = {
  HTTP: '#5ec27f',
  DNS: '#58a6ff',
  TCP: '#a29f94',
  UDP: '#e0b040',
  ICMP: '#ef6b5f',
  ARP: '#bc8cff',
  TLS: '#ffa657',
}

const POLL_MS = 3000
const HISTORY = 40

/** The saved network drawn to scale from its own coordinates: the page shows what was built, not a count of it. */
function TopologyPlan({ topology }: { topology: NetworkTopology }) {
  const W = 640
  const H = 300
  const PAD = 34
  const plan = useMemo(() => {
    const xs = topology.nodes.map((n) => n.position.x)
    const ys = topology.nodes.map((n) => n.position.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const spanX = Math.max(1, Math.max(...xs) - minX)
    const spanY = Math.max(1, Math.max(...ys) - minY)
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY)
    const offX = (W - spanX * scale) / 2
    const offY = (H - spanY * scale) / 2
    const at = new Map(
      topology.nodes.map((n) => [
        n.id,
        { x: offX + (n.position.x - minX) * scale, y: offY + (n.position.y - minY) * scale },
      ]),
    )
    return at
  }, [topology])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Plan of ${topology.name}: ${topology.nodes.length} devices, ${topology.edges.length} links`}
      className="h-full w-full"
    >
      {topology.edges.map((e) => {
        const a = plan.get(e.source)
        const b = plan.get(e.target)
        if (!a || !b) return null
        return (
          <line
            key={e.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--text-muted)"
            strokeOpacity={e.config.status === 'down' ? 0.25 : 0.7}
            strokeDasharray={e.config.status === 'down' ? '3 4' : undefined}
          />
        )
      })}
      {topology.nodes.map((n) => {
        const p = plan.get(n.id)!
        const m = deviceMeta(n.type)
        return (
          <g key={n.id} transform={`translate(${p.x} ${p.y})`}>
            <rect
              x={-5}
              y={-5}
              width={10}
              height={10}
              rx={2}
              fill="var(--bg-950)"
              stroke={m.color}
              strokeWidth={1.5}
            />
            <text
              y={19}
              textAnchor="middle"
              fontSize={8.5}
              fontFamily="JetBrains Mono, monospace"
              fill="var(--text-secondary)"
              stroke="var(--bg-900)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {n.config.hostname ?? n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Packets per second, newest on the right, kept in the page while it is open. */
function Sparkline({ values }: { values: number[] }) {
  const W = 220
  const H = 44
  if (values.length < 2)
    return <div className="h-11 text-[11px] text-[var(--text-muted)]">collecting…</div>
  const max = Math.max(1, ...values)
  const step = W / (HISTORY - 1)
  const pts = values.map(
    (v, i) =>
      `${(W - (values.length - 1 - i) * step).toFixed(1)},${(H - 3 - (v / max) * (H - 8)).toFixed(1)}`,
  )
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-11 w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function Readout({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-lg tabular-nums leading-none text-[var(--text-primary)]">
        {value}
      </dd>
    </div>
  )
}

const TOOLS = [
  { to: '/network', name: 'Network builder', hint: 'Topology, VLANs, routes, ACLs', Icon: Network },
  { to: '/packets', name: 'Packet capture', hint: 'Protocol tree and hex dump', Icon: Activity },
  { to: '/cidr', name: 'CIDR calculator', hint: 'Subnets, supernets, ranges', Icon: Calculator },
]

export default function DashboardPage() {
  const [stats, setStats] = useState<PacketStats | null>(null)
  const [topology, setTopology] = useState<NetworkTopology | null>(null)
  const [rates, setRates] = useState<number[]>([])
  const [reachable, setReachable] = useState<boolean | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const poll = () =>
      captureApi
        .get()
        .then((r) => {
          if (!alive.current) return
          setStats(r.data.stats)
          setReachable(true)
          setRates((prev) => [...prev, r.data.stats.packetsPerSecond].slice(-HISTORY))
        })
        .catch(() => alive.current && setReachable(false))
    poll()
    const t = setInterval(poll, POLL_MS)
    networkApi
      .getDefault()
      .then((r) => alive.current && setTopology(r.data))
      .catch(() => {})
    return () => {
      alive.current = false
      clearInterval(t)
    }
  }, [])

  const firewallRules = topology
    ? topology.nodes.reduce((sum, n) => sum + (n.config.firewallRules?.length ?? 0), 0)
    : '–'

  const protocols = stats
    ? Object.entries(stats.byProtocol)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    : []

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-5">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
          Overview
        </h1>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
          <span
            className="h-[7px] w-[7px] rounded-[2px]"
            style={{
              background:
                reachable === false ? 'var(--red)' : reachable ? 'var(--green)' : 'var(--bg-600)',
            }}
          />
          {reachable === false
            ? 'backend unreachable'
            : reachable
              ? 'backend connected'
              : 'connecting'}
        </span>
      </header>

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <section className="flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-900)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                {topology?.name ?? 'Saved network'}
              </h2>
              {topology?.description && (
                <p className="truncate text-[11px] text-[var(--text-muted)]">
                  {topology.description}
                </p>
              )}
            </div>
            <Link
              to="/network"
              className="flex shrink-0 items-center gap-1 rounded-[4px] border border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Open <ArrowUpRight size={12} />
            </Link>
          </div>
          <div
            className="aspect-[640/300] w-full"
            style={{
              backgroundImage: 'radial-gradient(#2a302b 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            {topology && topology.nodes.length > 0 ? (
              <TopologyPlan topology={topology} />
            ) : (
              <p className="p-4 text-xs text-[var(--text-muted)]">
                No network yet. Open the builder and drop a device.
              </p>
            )}
          </div>
          <dl className="grid grid-cols-3 gap-4 border-t border-[var(--border)] px-4 py-3">
            <Readout label="Devices" value={topology?.nodes.length ?? '–'} />
            <Readout label="Links" value={topology?.edges.length ?? '–'} />
            <Readout label="ACL rules" value={firewallRules} />
          </dl>
        </section>

        <div className="flex min-h-0 flex-col gap-4">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-900)] p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Capture rate
                </h2>
                <p className="mt-1 font-mono text-2xl tabular-nums leading-none text-[var(--text-primary)]">
                  {stats ? stats.packetsPerSecond.toFixed(1) : '–'}
                  <span className="ml-1 text-[11px] text-[var(--text-muted)]">pkt/s</span>
                </p>
              </div>
              <p className="text-right font-mono text-[11px] text-[var(--text-muted)]">
                {stats ? `${stats.total.toLocaleString()} packets` : ''}
              </p>
            </div>
            <div className="mt-3">
              <Sparkline values={rates} />
            </div>
            {protocols.length > 0 && stats && (
              <>
                <div
                  className="mt-4 flex h-2 overflow-hidden rounded-[2px] bg-[var(--bg-800)]"
                  aria-hidden="true"
                >
                  {protocols.map(([proto, count]) => (
                    <div
                      key={proto}
                      style={{
                        width: `${(count / stats.total) * 100}%`,
                        background: PROTO_COLORS[proto] ?? '#8a887e',
                      }}
                    />
                  ))}
                </div>
                <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                  {protocols.map(([proto, count]) => (
                    <li
                      key={proto}
                      className="flex items-center justify-between font-mono text-[11px]"
                    >
                      <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <span
                          className="h-[7px] w-[7px] rounded-[2px]"
                          style={{ background: PROTO_COLORS[proto] ?? '#8a887e' }}
                        />
                        {proto}
                      </span>
                      <span className="tabular-nums text-[var(--text-muted)]">
                        {((count / stats.total) * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <nav aria-label="Tools" className="grid gap-2">
            {TOOLS.map(({ to, name, hint, Icon }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-900)] px-3.5 py-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-800)]"
              >
                <Icon size={16} className="shrink-0 text-[var(--accent)]" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-[var(--text-primary)]">
                    {name}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--text-muted)]">
                    {hint}
                  </span>
                </span>
                <ArrowUpRight
                  size={14}
                  className="shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent)]"
                />
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}
