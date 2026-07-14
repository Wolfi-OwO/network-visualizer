import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { PacketStats } from '../../types/index.ts'

const PROTO_COLORS: Record<string, string> = {
  HTTP: '#3fb950',
  HTTPS: '#2ea043',
  DNS: '#58a6ff',
  TCP: '#8b949e',
  UDP: '#d29922',
  ICMP: '#f85149',
  ARP: '#bc8cff',
  TLS: '#ffa657',
  SSH: '#3fb950',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

interface StatsPanelProps {
  stats: PacketStats | null
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
        No data
      </div>
    )
  }

  const chartData = Object.entries(stats.byProtocol).map(([name, value]) => ({ name, value }))

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Total Packets', value: stats.total.toLocaleString() },
          { label: 'Total Bytes', value: formatBytes(stats.bytesTotal) },
          { label: 'Packets/sec', value: stats.packetsPerSecond.toFixed(1) },
          { label: 'Throughput', value: `${formatBytes(stats.bytesPerSecond)}/s` },
        ].map(({ label, value }) => (
          <div key={label} className="card p-2">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-0.5">
              {label}
            </div>
            <div className="text-sm font-mono font-semibold text-[var(--text-primary)]">
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Protocol chart */}
      {chartData.length > 0 && (
        <div>
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Protocol Distribution
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={PROTO_COLORS[entry.name] ?? '#484f58'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-800)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    fontSize: 11,
                    color: 'var(--text-primary)',
                  }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="space-y-1 mt-1">
            {chartData
              .sort((a, b) => b.value - a.value)
              .map(({ name, value }) => (
                <div key={name} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ background: PROTO_COLORS[name] ?? '#484f58' }}
                  />
                  <span className="text-[11px] font-mono text-[var(--text-secondary)] flex-1">
                    {name}
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-primary)]">{value}</span>
                  <span className="text-[10px] text-[var(--text-muted)] w-10 text-right">
                    {stats.total > 0 ? ((value / stats.total) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
