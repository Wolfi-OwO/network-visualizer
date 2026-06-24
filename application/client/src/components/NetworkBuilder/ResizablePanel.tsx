import { useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_KEY = 'netviz.inspector.width'
const MIN = 280
const MAX = 720
const DEFAULT = 320

/**
 * Right-docked panel the user can resize by dragging its left edge.
 * Width persists across sessions. Children should fill it (w-full h-full).
 */
export default function ResizablePanel({ children }: { children: React.ReactNode }) {
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
      // Panel is docked on the right → width grows as the pointer moves left
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
    <div className="relative shrink-0 h-full" style={{ width }}>
      {/* Drag handle on the left edge */}
      <div
        onPointerDown={onPointerDown}
        onDoubleClick={() => setWidth(DEFAULT)}
        title="Drag to resize · double-click to reset"
        className="absolute left-0 top-0 h-full z-10 group"
        style={{ width: 6, marginLeft: -3, cursor: 'col-resize' }}
      >
        <div className="w-px h-full mx-auto bg-transparent group-hover:bg-[var(--accent)] transition-colors" />
      </div>
      {children}
    </div>
  )
}
