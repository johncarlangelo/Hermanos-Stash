import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const COACH_KEY = 'onboarding.done'

interface Hint {
  id: string
  text: string
}

const HINTS: Hint[] = [
  { id: 'palette', text: 'Ctrl K searches all 50 tools from anywhere' },
  { id: 'drop', text: 'Drop any file on the window to find tools that handle it' },
  { id: 'pin', text: 'Pin your daily drivers so they live at the top of the sidebar' }
]

/**
 * First-run coach marks (Milestone 8): a single dismissible strip showing up
 * to three hints. One-time — once dismissed, prefs `onboarding.done` is set
 * and this never renders again.
 */
export function CoachMarks() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let active = true
    window.stash.prefs
      .get<boolean>(COACH_KEY)
      .then((done) => {
        if (!active && done) return
        if (active && done !== true) setVisible(true)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const dismiss = (): void => {
    setVisible(false)
    void window.stash.prefs.set(COACH_KEY, true).catch(() => {})
  }

  if (!visible) return null

  return (
    <div
      role="note"
      aria-label="Getting started tips"
      className="anim-slide-up mx-auto mb-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-accent/30 bg-accent-soft/60 px-4 py-2.5"
    >
      <span className="font-mono text-[9.5px] tracking-[0.1em] text-accent uppercase select-none">
        Start here
      </span>
      <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
        {HINTS.map((hint) => (
          <li key={hint.id} className="flex items-center gap-1.5 text-[11.5px] text-dim">
            <span className="h-1 w-1 rounded-full bg-accent/70" aria-hidden />
            {hint.text}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss getting started tips"
        className="cursor-pointer rounded-xs p-1 text-faint transition-colors duration-150 hover:bg-surface hover:text-ink"
      >
        <X size={13} />
      </button>
    </div>
  )
}
