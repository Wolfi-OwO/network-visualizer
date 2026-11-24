import { useEffect, useState } from 'react'
import { Check, Loader2, Save, TriangleAlert } from 'lucide-react'

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed'

// Shows the state of a save without making a show of it. A save that finishes at once never flashes a spinner: the
// button only turns into "Saving…" when it has taken a moment (a slow connection), and the width stays put so the
// toolbar does not jump around.
export function SaveButton({
  state,
  onClick,
  title,
}: {
  state: SaveState
  onClick: () => void
  title: string
}) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (state !== 'saving') {
      setSlow(false)
      return
    }
    const t = setTimeout(() => setSlow(true), 300)
    return () => clearTimeout(t)
  }, [state])

  const showSaving = state === 'saving' && slow
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'saving'}
      title={title}
      data-save-state={showSaving ? 'saving' : state === 'saving' ? 'idle' : state}
      className="btn-primary save-btn"
      aria-live="polite"
    >
      {showSaving ? (
        <Loader2 size={11} className="save-spin" aria-hidden="true" />
      ) : state === 'saved' ? (
        <Check size={11} aria-hidden="true" />
      ) : state === 'failed' ? (
        <TriangleAlert size={11} aria-hidden="true" />
      ) : (
        <Save size={11} aria-hidden="true" />
      )}
      <span>
        {showSaving
          ? 'Saving…'
          : state === 'saved'
            ? 'Saved'
            : state === 'failed'
              ? 'Retry'
              : 'Save'}
      </span>
    </button>
  )
}
