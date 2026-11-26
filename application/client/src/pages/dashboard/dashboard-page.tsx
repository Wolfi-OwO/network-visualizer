import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Network, Calculator, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../../context/auth-context.tsx'
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

const POLL_MS = 5000 // totals and protocol mix; the rate itself comes from the live stream
const HISTORY = 40 // seconds shown in the graph
const SMOOTH_WINDOW_MS = 2500

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

/**
 * Packets per second over the last HISTORY seconds, built from the individual arrivals so the window slides a
 * little with every frame instead of jumping once per poll. Points are joined with a smooth curve.
 */
function LiveGraph({ arrivals, now }: { arrivals: { t: number; n: number }[]; now: number }) {
  const W = 320
  const H = 56
  const STEP = 1000
  // one value per second, the newest second ending exactly at `now`
  const values: number[] = []
  for (let i = HISTORY; i >= 0; i -= 1) {
    const to = now - i * STEP
    const from = to - STEP
    let n = 0
    for (const a of arrivals) if (a.t > from && a.t <= to) n += a.n
    values.push(n)
  }
  const max = Math.max(10, ...values)
  const x = (i: number) => (i / HISTORY) * W
  const y = (v: number) => H - 4 - (v / max) * (H - 10)
  let d = `M ${x(0).toFixed(1)} ${y(values[0]).toFixed(1)}`
  for (let i = 1; i < values.length; i += 1) {
    const cx = (x(i - 1) + x(i)) / 2
    d += ` C ${cx.toFixed(1)} ${y(values[i - 1]).toFixed(1)}, ${cx.toFixed(1)} ${y(values[i]).toFixed(1)}, ${x(i).toFixed(1)} ${y(values[i]).toFixed(1)}`
  }
  const area = `${d} L ${W} ${H} L 0 ${H} Z`
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-14 w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path d={area} fill="var(--accent)" fillOpacity={0.1} />
      <path
        d={d}
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

const GREETING_LINES = [
  'Wire something up, then send a packet through it.',
  'Every link is a guess until you trace it.',
  'Draw it first, break it second.',
  'See what is actually on the wire.',
  'A /26 holds 62 hosts. Check yours.',
  'Power a device off and watch what notices.',
]

function greetingFor(hour: number): string {
  if (hour < 5) return 'Still up'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const AUTOSAVE_KEY = 'netviz.topology.autosave.v1'

/** Anonymous visitors keep their work in this browser (see the builder's save logic), so the plan shows that. */
function readLocalNetwork(): NetworkTopology | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as Partial<NetworkTopology>
    if (!t.nodes?.length) return null
    return { name: 'Your network', description: 'Saved in this browser', ...t } as NetworkTopology
  } catch {
    return null
  }
}

const TOOLS = [
  { to: '/network', name: 'Network builder', hint: 'Topology, VLANs, routes, ACLs', Icon: Network },
  { to: '/packets', name: 'Packet capture', hint: 'Protocol tree and hex dump', Icon: Activity },
  { to: '/cidr', name: 'CIDR calculator', hint: 'Subnets, supernets, ranges', Icon: Calculator },
]

export default function DashboardPage() {
  const [stats, setStats] = useState<PacketStats | null>(null)
  const [topology, setTopology] = useState<NetworkTopology | null>(null)
  const arrivals = useRef<{ t: number; n: number }[]>([])
  const [tick, setTick] = useState(() => Date.now())
  const [live, setLive] = useState(false)
  const [rate, setRate] = useState(0)
  const [reachable, setReachable] = useState<boolean | null>(null)
  const { user } = useAuth()
  // one line per visit, picked once so it does not change while the page re-renders
  const [line] = useState(() => GREETING_LINES[Math.floor(Math.random() * GREETING_LINES.length)])
  const [local] = useState(readLocalNetwork)
  const shown = !user && local ? local : topology
  const firstName = user?.name?.trim().split(/\s+/)[0]
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
        })
        .catch(() => alive.current && setReachable(false))
    poll()
    const t = setInterval(poll, POLL_MS)
    networkApi
      .getDefault()
      .then((r) => alive.current && setTopology(r.data))
      .catch(() => {})

    // The live feed the capture page uses: every batch of new packets is one arrival. The first message is the
    // backlog already in the buffer, so it is not counted as traffic happening now.
    const es = new EventSource('/api/packets/stream')
    let first = true
    es.onopen = () => alive.current && setLive(true)
    es.onerror = () => alive.current && setLive(false)
    es.onmessage = (ev) => {
      if (first) {
        first = false
        return
      }
      try {
        const batch = JSON.parse(ev.data) as unknown[]
        arrivals.current.push({ t: Date.now(), n: batch.length })
      } catch {
        /* a malformed frame is skipped */
      }
    }

    // ~12 frames a second: slide the graph window and ease the number toward the recent average
    let shown = 0
    const frame = setInterval(() => {
      if (!alive.current) return
      const t = Date.now()
      const keep = t - (HISTORY + 2) * 1000
      while (arrivals.current.length && arrivals.current[0].t < keep) arrivals.current.shift()
      let n = 0
      for (const a of arrivals.current) if (a.t > t - SMOOTH_WINDOW_MS) n += a.n
      const target = n / (SMOOTH_WINDOW_MS / 1000)
      shown += (target - shown) * 0.25
      setTick(t)
      setRate(shown)
    }, 80)

    return () => {
      alive.current = false
      clearInterval(t)
      clearInterval(frame)
      es.close()
    }
  }, [])

  const firewallRules = shown
    ? shown.nodes.reduce((sum, n) => sum + (n.config.firewallRules?.length ?? 0), 0)
    : '–'

  const protocols = stats
    ? Object.entries(stats.byProtocol)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    : []

  const now = new Date()
  const today = now.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 p-4 sm:p-8">
        <header className="flex flex-col gap-3 border-b border-[var(--border)] pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <span>{today}</span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-[7px] w-[7px] rounded-[2px]"
                style={{
                  background:
                    reachable === false
                      ? 'var(--red)'
                      : reachable
                        ? 'var(--green)'
                        : 'var(--bg-600)',
                }}
              />
              {reachable === false
                ? 'backend unreachable'
                : reachable
                  ? 'backend connected'
                  : 'connecting'}
            </span>
          </div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-[34px]">
            {greetingFor(now.getHours())}
            {firstName ? (
              <>
                , <span className="text-[var(--accent)]">{firstName}</span>
              </>
            ) : (
              ''
            )}
            .
          </h1>
          <p className="max-w-[60ch] text-[14px] leading-relaxed text-[var(--text-secondary)]">
            {line}
          </p>
          {!user && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--text-muted)]">
              <span className="rounded-[3px] border border-[var(--border-strong)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]">
                anonymous
              </span>
              Networks you build stay in this browser.
              <Link to="/login" className="text-[var(--accent)] underline-offset-2 hover:underline">
                Sign in to keep them on an account
              </Link>
            </p>
          )}
        </header>

        <div className="grid gap-6 lg:grid-cols-12">
          <section className="flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-900)] lg:col-span-7">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2.5">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  {!user && local ? 'Pick up where you left off' : 'Sample network'}
                </p>
                <h2 className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                  {shown?.name ?? 'Network'}
                </h2>
              </div>
              <Link
                to="/network"
                className="flex shrink-0 items-center gap-1 rounded-[4px] border border-[var(--border-strong)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Open builder <ArrowUpRight size={12} />
              </Link>
            </div>
            <div
              className="aspect-[640/320] w-full"
              style={{
                backgroundImage: 'radial-gradient(#2a302b 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            >
              {shown && shown.nodes.length > 0 ? (
                <TopologyPlan topology={shown} />
              ) : (
                <p className="p-4 text-xs text-[var(--text-muted)]">
                  Nothing drawn yet. Open the builder and drop a device.
                </p>
              )}
            </div>
            <dl className="grid grid-cols-3 gap-4 border-t border-[var(--border)] px-4 py-3">
              <Readout label="Devices" value={shown?.nodes.length ?? '–'} />
              <Readout label="Links" value={shown?.edges.length ?? '–'} />
              <Readout label="ACL rules" value={firewallRules} />
            </dl>
          </section>

          <div className="flex flex-col gap-6 lg:col-span-5">
            <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-900)] p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    On the wire
                    <span
                      className="h-[6px] w-[6px] rounded-[1px]"
                      style={{
                        background: live ? 'var(--green)' : 'var(--bg-600)',
                        animation: live ? 'live-pulse 2.4s ease-in-out infinite' : undefined,
                      }}
                      title={live ? 'Live' : 'Not connected'}
                    />
                  </h2>
                  <p className="mt-1 font-mono text-2xl leading-none tabular-nums text-[var(--text-primary)]">
                    {live ? rate.toFixed(1) : '–'}
                    <span className="ml-1 text-[11px] text-[var(--text-muted)]">pkt/s</span>
                  </p>
                </div>
                <p className="text-right font-mono text-[11px] text-[var(--text-muted)]">
                  {stats ? `${stats.total.toLocaleString()} captured` : ''}
                </p>
              </div>
              <div className="mt-3">
                <LiveGraph arrivals={arrivals.current} now={tick} />
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
                            className="h-[7px] w-[7px] rounded-[1px]"
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
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Start something
              </p>
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
    </div>
  )
}
