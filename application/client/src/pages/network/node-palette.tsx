import { Power } from 'lucide-react'
import type { NodeType } from '../../types/index.ts'
import { PALETTE_CATEGORIES, meta } from './device-catalog.tsx'

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, type: NodeType) => void
  /** Click or Enter/Space on a palette entry — the only way a keyboard-only
   *  user can add a device, since dragging has no keyboard equivalent. */
  onActivate: (type: NodeType) => void
}

export default function NodePalette({ onDragStart, onActivate }: NodePaletteProps) {
  return (
    <div
      data-tour="palette"
      className="flex flex-col h-full overflow-hidden backdrop-blur-xl bg-[var(--glass-bg)] border-r border-[var(--glass-border)] shadow-xl md:shadow-none"
    >
      <div className="panel-header">Devices</div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {PALETTE_CATEGORIES.map(({ category, types }) => (
          <div key={category} className="space-y-1">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-1 pb-0.5">
              {category}
            </div>
            {types.map((type) => {
              const m = meta(type)
              const Icon = m.Icon
              return (
                <div
                  key={type}
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label={`Add ${m.label} to canvas — ${m.hint}`}
                  onDragStart={(e) => onDragStart(e, type)}
                  onClick={() => onActivate(type)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onActivate(type)
                    }
                  }}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white/[0.06] hover:translate-x-0.5 transition-all duration-200 border border-transparent hover:border-white/10 select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
                >
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{
                      background: m.bg,
                      border: `1px solid ${m.color}55`,
                      boxShadow: `0 0 14px -6px ${m.color}`,
                    }}
                  >
                    <Icon size={15} color={m.color} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                      {m.label}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{m.hint}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-[var(--glass-border)]">
        <p className="text-[10px] text-[var(--text-muted)] text-center leading-relaxed">
          Drag devices onto the canvas, or focus one and press Enter. Connect handles to wire
          them. Use the <Power size={10} className="inline -mt-0.5" /> button to power a device
          on.
        </p>
      </div>
    </div>
  )
}
