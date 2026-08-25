import { useEffect, useState } from 'react'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { getIcon } from '../../components/icons'
import { useLibrary } from '../../stores/library'
import { useNav } from '../../stores/nav'

const SWITCH_LIMIT = 8

/**
 * Quick-Switch (Milestone 8): Alt-Tab for tools.
 *
 * Hold Ctrl and tap Tab to cycle the last ~8 used tools in a centered
 * overlay; release Ctrl to jump to the highlighted tool. Shift+Tab
 * reverses direction. Purely keyboard-driven.
 */
export function QuickSwitch() {
  const recents = useLibrary((s) => s.recents)
  const openTool = useNav((s) => s.openTool)

  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)

  const candidates = recents
    .slice(0, Math.min(recents.length, SWITCH_LIMIT))
    .map((r) => toolRegistry.get(r.toolId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  // Activation: Ctrl held + Tab pressed opens the overlay.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab' && !active && candidates.length > 1) {
        e.preventDefault()
        setIndex(1 % candidates.length) // start on the second-most-recent
        setActive(true)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [active, candidates.length])

  // While active: Tab cycles, releasing Ctrl jumps.
  useEffect(() => {
    if (!active) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key === 'Tab') {
        e.preventDefault()
        setIndex((i) => {
          const next = e.shiftKey ? i - 1 : i + 1
          return (next + candidates.length) % candidates.length
        })
      }
    }
    window.addEventListener('keydown', onKeyDown, true)

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        e.preventDefault()
        setActive(false)
      }
    }
    window.addEventListener('keyup', onKeyUp, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [active, candidates.length])

  // Jump when the overlay closes.
  useEffect(() => {
    if (active) return
    if (index <= 0) {
      setIndex(0)
      return
    }
    const target = candidates[index]
    if (target) openTool(target.id)
    setIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  if (!active || candidates.length === 0) return null
  const safeIndex = index % candidates.length

  return (
    <div className="anim-fade-in fixed inset-0 z-[42] flex items-center justify-center bg-base/75">
      <div
        role="dialog"
        aria-label="Quick switch tools"
        aria-live="polite"
        className="glass-strong anim-modal-in w-[420px] overflow-hidden rounded-md border border-line-strong shadow-2xl shadow-black/50"
      >
        <p className="border-b border-line px-4 py-2.5 text-[10.5px] font-semibold tracking-[0.1em] text-faint uppercase select-none">
          Quick switch · hold Ctrl · tap Tab · release to jump
        </p>
        <ul>
          {candidates.map((tool, i) => {
            const Icon = getIcon(tool.icon)
            const selected = i === safeIndex
            return (
              <li key={tool.id}>
                <div
                  data-selected={selected}
                  className={`flex items-center gap-3 px-4 py-2 transition-colors duration-100 ${
                    selected ? 'bg-surface shadow-[inset_2px_0_0_var(--color-accent)]' : ''
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} className="shrink-0 text-dim" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{tool.name}</span>
                  {i === 0 && (
                    <span className="shrink-0 font-mono text-[10px] text-faint">last</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
