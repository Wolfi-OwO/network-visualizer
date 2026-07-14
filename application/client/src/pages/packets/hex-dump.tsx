import type { Packet } from '../../types/index.ts'

interface HexDumpProps {
  packet: Packet | null
}

export default function HexDump({ packet }: HexDumpProps) {
  if (!packet) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
        No packet selected
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-2">
      <div className="mb-2 px-1">
        <span className="text-[10px] text-[var(--text-muted)] font-mono">
          {packet.capturedLength} bytes captured
        </span>
      </div>
      {packet.hexDump.map((line, i) => {
        const offset = line.slice(0, 4)
        const rest = line.slice(4)
        const twoSpace = rest.indexOf('  ')
        const hex = rest.slice(0, twoSpace > 0 ? twoSpace : rest.length).trim()
        const ascii = twoSpace > 0 ? rest.slice(twoSpace).trim() : ''

        return (
          <div key={i} className="hex-line hover:bg-[var(--bg-700)] rounded px-1">
            <span className="hex-offset">{offset}</span>
            <span className="text-[var(--text-muted)]"> </span>
            <span className="hex-bytes">{hex.padEnd(47, ' ')}</span>
            <span className="text-[var(--text-muted)]"> </span>
            <span className="hex-ascii">{ascii}</span>
          </div>
        )
      })}
    </div>
  )
}
