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
      className="flex flex-col h-full overflow-hidden bg-[var(--glass-bg)] border-r border-[var(--glass-border)]"
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
                  className="group relative flex items-center gap-2.5 rounded-[4px] border border-transparent py-1.5 pl-3 pr-2 cursor-grab select-none transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-800)] active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2"
                >
                  {/* the device-type colour is a stripe, the same mark the device carries on the canvas */}
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-[2px]"
                    style={{ background: m.color }}
                    aria-hidden="true"
                  />
                  <Icon size={16} color={m.color} strokeWidth={1.75} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="font-mono text-[11.5px] font-medium text-[var(--text-primary)] truncate">
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
          Drag devices onto the canvas, or focus one and press Enter. Connect handles to wire them.
          Use the <Power size={10} className="inline -mt-0.5" /> button to power a device on.
        </p>
      </div>
    </div>
  )
}
