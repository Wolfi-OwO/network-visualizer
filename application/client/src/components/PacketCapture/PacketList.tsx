import { useEffect, useRef } from 'react'
import type { Packet } from '../../types'

const COL_WIDTHS = ['50px', '90px', '140px', '140px', '70px', '65px', 'auto']
const HEADERS = ['No.', 'Time', 'Source', 'Destination', 'Protocol', 'Length', 'Info']

function protoClass(proto: string) {
  const known = ['HTTP', 'HTTPS', 'DNS', 'mDNS', 'TCP', 'UDP', 'ICMP', 'ARP', 'TLS', 'SSH',
    'DHCP', 'STP', 'NTP', 'LLDP', 'SNMP', 'OSPF', 'SSDP', 'SIP']
  return known.includes(proto) ? `proto-${proto}` : 'proto-default'
}

interface PacketListProps {
  packets: Packet[]
  selectedId: number | null
  onSelect: (p: Packet) => void
  autoScroll: boolean
}

export default function PacketList({ packets, selectedId, onSelect, autoScroll }: PacketListProps) {
  const tbodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && tbodyRef.current) {
      tbodyRef.current.scrollTop = tbodyRef.current.scrollHeight
    }
  }, [packets.length, autoScroll])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center bg-[var(--bg-950)] border-b border-[var(--border)] shrink-0">
        {HEADERS.map((h, i) => (
          <div
            key={h}
            className="px-2 py-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider shrink-0 border-r border-[var(--border)] last:border-r-0"
            style={{ width: COL_WIDTHS[i], minWidth: COL_WIDTHS[i], flex: i === 6 ? '1' : undefined }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div ref={tbodyRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {packets.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-xs text-[var(--text-muted)]">
            No packets captured yet
          </div>
        ) : (
          packets.map(p => (
            <div
              key={p.id}
              onClick={() => onSelect(p)}
              className={[
                'flex items-center cursor-pointer transition-colors border-b border-[var(--border)]/30',
                protoClass(p.protocol),
                selectedId === p.id ? 'row-selected' : '',
              ].join(' ')}
            >
              <Cell width={COL_WIDTHS[0]} mono>{p.id}</Cell>
              <Cell width={COL_WIDTHS[1]} mono>{p.relativeTime.toFixed(6)}</Cell>
              <Cell width={COL_WIDTHS[2]} mono>{p.ip?.srcIp ?? p.ethernet?.srcMac ?? '—'}</Cell>
              <Cell width={COL_WIDTHS[3]} mono>{p.ip?.dstIp ?? p.ethernet?.dstMac ?? '—'}</Cell>
              <Cell width={COL_WIDTHS[4]}>
                <span className={[
                  'badge text-[10px]',
                  protoBadgeColor(p.protocol),
                ].join(' ')}>
                  {p.protocol}
                </span>
              </Cell>
              <Cell width={COL_WIDTHS[5]} mono>{p.length}</Cell>
              <Cell flex mono truncate>{p.info}</Cell>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

interface CellProps {
  width?: string
  children: React.ReactNode
  mono?: boolean
  flex?: boolean
  truncate?: boolean
}

function Cell({ width, children, mono, flex, truncate }: CellProps) {
  return (
    <div
      className={[
        'px-2 py-0.5 text-[11px] border-r border-[var(--border)]/20 last:border-r-0 shrink-0',
        mono ? 'font-mono' : '',
        truncate ? 'overflow-hidden text-ellipsis whitespace-nowrap' : 'whitespace-nowrap',
        'text-[var(--text-primary)]',
      ].join(' ')}
      style={{ width: flex ? undefined : width, minWidth: flex ? undefined : width, flex: flex ? 1 : undefined, overflow: truncate ? 'hidden' : undefined }}
    >
      {children}
    </div>
  )
}

function protoBadgeColor(proto: string): string {
  const map: Record<string, string> = {
    HTTP: 'bg-[rgba(63,185,80,0.2)] text-[#3fb950]',
    HTTPS: 'bg-[rgba(63,185,80,0.15)] text-[#2ea043]',
    DNS: 'bg-[rgba(88,166,255,0.2)] text-[#58a6ff]',
    TCP: 'bg-[rgba(139,148,158,0.2)] text-[#8b949e]',
    UDP: 'bg-[rgba(210,153,34,0.2)] text-[#d29922]',
    ICMP: 'bg-[rgba(248,81,73,0.2)] text-[#f85149]',
    ARP: 'bg-[rgba(188,140,255,0.2)] text-[#bc8cff]',
    TLS: 'bg-[rgba(255,166,87,0.2)] text-[#ffa657]',
    SSH: 'bg-[rgba(63,185,80,0.15)] text-[#3fb950]',
    mDNS: 'bg-[rgba(121,192,255,0.2)] text-[#79c0ff]',
    DHCP: 'bg-[rgba(45,212,191,0.2)] text-[#2dd4bf]',
    STP: 'bg-[rgba(227,179,65,0.2)] text-[#e3b341]',
    NTP: 'bg-[rgba(86,212,221,0.2)] text-[#56d4dd]',
    LLDP: 'bg-[rgba(163,113,247,0.2)] text-[#a371f7]',
    SNMP: 'bg-[rgba(247,120,186,0.2)] text-[#f778ba]',
    OSPF: 'bg-[rgba(63,185,80,0.2)] text-[#3fb950]',
    SSDP: 'bg-[rgba(156,163,175,0.2)] text-[#9ca3af]',
    SIP: 'bg-[rgba(255,123,114,0.2)] text-[#ff7b72]',
  }
  return map[proto] ?? 'bg-[rgba(110,118,129,0.2)] text-[#8b949e]'
}
