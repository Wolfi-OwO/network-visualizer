import { useState } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

const QUICK_FILTERS = [
  { label: 'TCP', value: 'TCP' },
  { label: 'UDP', value: 'UDP' },
  { label: 'HTTP', value: 'HTTP' },
  { label: 'DNS', value: 'DNS' },
  { label: 'ICMP', value: 'ICMP' },
  { label: 'ARP', value: 'ARP' },
  { label: 'TLS', value: 'TLS' },
]

interface FilterBarProps {
  value: string
  onChange: (v: string) => void
}

export default function FilterBar({ value, onChange }: FilterBarProps) {
  const [showQuick, setShowQuick] = useState(false)
  const isActive = value.trim().length > 0

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 backdrop-blur-xl bg-[var(--glass-bg)] border-b border-[var(--glass-border)]">
      <div
        className={[
          'flex items-center flex-1 min-w-[140px] gap-2 px-2 py-1 rounded border transition-colors',
          isActive
            ? 'border-[var(--accent)] bg-[var(--bg-800)]'
            : 'border-[var(--border)] bg-[var(--bg-800)]',
        ].join(' ')}
      >
        <Search
          size={12}
          className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}
        />
        <input
          className="flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] font-mono"
          placeholder="Filter… e.g. TCP, DNS, HTTP, 10.0.0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
        {isActive && (
          <button
            onClick={() => onChange('')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setShowQuick((v) => !v)}
          className="btn-ghost flex items-center gap-1"
        >
          Quick filters <ChevronDown size={10} />
        </button>
        {showQuick && (
          <div
            className="rounded-lg p-2 flex flex-col gap-1 shadow-2xl"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              zIndex: 50,
              minWidth: 120,
              background: 'var(--bg-800)',
              border: '1px solid var(--border)',
            }}
          >
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => {
                  onChange(f.value)
                  setShowQuick(false)
                }}
                className={[
                  'text-left px-2 py-1 rounded-md text-xs font-mono hover:bg-white/10 transition-colors',
                  value === f.value ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
            <div className="border-t border-[var(--glass-border)] my-1" />
            <button
              onClick={() => {
                onChange('')
                setShowQuick(false)
              }}
              className="text-left px-2 py-1 rounded-md text-xs text-[var(--text-muted)] hover:bg-white/10 transition-colors"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {isActive && (
        <div className="text-[10px] text-[var(--accent)] font-mono whitespace-nowrap">
          Filter active
        </div>
      )}
    </div>
  )
}
