import type { NodeType } from '../../types/index.ts'
import { PALETTE_CATEGORIES, meta } from './device-catalog.tsx'

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, type: NodeType) => void
}

export default function NodePalette({ onDragStart }: NodePaletteProps) {
  return (
    <div data-tour="palette" className="flex flex-col h-full overflow-hidden bg-[var(--bg-900)] border-r border-[var(--border)] shadow-xl md:shadow-none">
      <div className="panel-header">Devices</div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {PALETTE_CATEGORIES.map(({ category, types }) => (
          <div key={category} className="space-y-1">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-1 pb-0.5">{category}</div>
            {types.map(type => {
              const m = meta(type)
              const Icon = m.Icon
              return (
                <div
                  key={type}
                  draggable
                  onDragStart={e => onDragStart(e, type)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-[var(--bg-700)] transition-colors border border-transparent hover:border-[var(--border)] select-none"
                >
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: m.bg, border: `1px solid ${m.color}55` }}
                  >
                    <Icon size={15} color={m.color} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[var(--text-primary)] truncate">{m.label}</div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{m.hint}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-[var(--border)]">
        <p className="text-[10px] text-[var(--text-muted)] text-center leading-relaxed">
          Drag devices onto the canvas. Connect handles to wire them. Use the ⏻ button to power a device on.
        </p>
      </div>
    </div>
  )
}
