import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectMenuOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectMenuProps {
  value: string
  onChange: (value: string) => void
  options: SelectMenuOption[]
  placeholder?: string
  className?: string
}

/**
 * Dropdown styled to match the app's dark/glass theme.
 *
 * Native <select> popups are rendered by the OS/browser widget toolkit (e.g.
 * Linux Chrome always shows a plain white GTK listbox) and largely ignore our
 * CSS, so anywhere a select needs to look right we build the list ourselves.
 */
export default function SelectMenu({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
}: SelectMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    return () => window.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div ref={ref} className={['relative', className].join(' ')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="select flex items-center justify-between gap-1.5 w-full text-left"
      >
        <span
          className={[
            'truncate',
            current ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]',
          ].join(' ')}
        >
          {current ? current.label : placeholder}
        </span>
        <ChevronDown
          size={11}
          className={[
            'shrink-0 text-[var(--text-muted)] transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>
      {open && (
        // Plain inline styles for position/size/background here — deliberately
        // avoiding Tailwind arbitrary-value width tricks (min/max/calc), which
        // have proven unreliable for this popup in some rendering setups.
        <div
          className="rounded-lg p-1 shadow-2xl"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 50,
            width: 256,
            maxHeight: 256,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'var(--bg-800)',
            border: '1px solid var(--border)',
          }}
        >
          {options.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-[var(--text-muted)]">No options</div>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={o.disabled}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className={[
                'block text-left px-2 py-1.5 rounded-md text-xs truncate transition-colors disabled:opacity-40',
                o.value === value
                  ? 'bg-white/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-white/10 hover:text-[var(--text-primary)]',
              ].join(' ')}
              style={{ width: '100%', display: 'block' }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
