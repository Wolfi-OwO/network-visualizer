import { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_KEY = 'netviz.inspector.width'
const MIN = 280
const MAX = 720
const DEFAULT = 320

interface ResizablePanelProps {
  children: React.ReactNode
  /** Called when the mobile backdrop is tapped — parents should close the panel. */
  onBackdropClick?: () => void
}

/**
 * Right-docked panel the user can resize by dragging its left edge (`md` and up).
 * Width persists across sessions. Children should fill it (w-full h-full).
 *
 * Below `md` there isn't room for a palette + canvas + a wide side column, so
 * instead of squeezing the canvas to near-zero it becomes a fixed overlay
 * drawer with a backdrop; drag-to-resize stays a desktop-only affordance.
 */
export default function ResizablePanel({ children, onBackdropClick }: ResizablePanelProps) {
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    return saved >= MIN && saved <= MAX ? saved : DEFAULT
  })
  const dragging = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return
      // Panel is docked on the right -> width grows as the pointer moves left
      const next = Math.min(MAX, Math.max(MIN, window.innerWidth - e.clientX))
      setWidth(next)
    }
    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(STORAGE_KEY, String(width))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [width])

  return (
    <>
      {/* Mobile-only backdrop — the panel becomes a fixed overlay below `md` */}
      <div
        onClick={onBackdropClick}
        aria-hidden="true"
        className="fixed inset-0 bg-black/40 z-30 md:hidden"
      />
      <div
        className="fixed inset-y-0 right-0 z-40 md:relative md:inset-auto md:z-auto shrink-0 h-full w-[min(92vw,24rem)] md:w-[var(--panel-w)]"
        style={{ ['--panel-w' as string]: `min(${width}px, calc(100% - 1rem))` }}
      >
        {/* Drag handle on the left edge (desktop only — mouse-drag resizing isn't meaningful on the mobile overlay) */}
        <div
          onPointerDown={onPointerDown}
          onDoubleClick={() => setWidth(DEFAULT)}
          title="Drag to resize · double-click to reset"
          className="hidden md:block absolute left-0 top-0 h-full z-10 group"
          style={{ width: 6, marginLeft: -3, cursor: 'col-resize' }}
        >
          <div className="w-px h-full mx-auto bg-transparent group-hover:bg-[var(--accent)] transition-colors" />
        </div>
        {children}
      </div>
    </>
  )
}
