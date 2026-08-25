import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { ACCENT_PRESETS, isAccentVisibleOnBase, BASE_HEX } from '../settings/accent-theme'
import { applyAccent, setAccentPreference } from '../../accent-runtime'
import { toastError } from '../../stores/toasts'

const DEFAULT_ACCENT = ACCENT_PRESETS[0].hex

/**
 * Accent selector (Milestone 7): curated preset swatches + a free color
 * picker. Dark-only stays; only the accent changes.
 *
 * Review-driven behavior (M7 fixes):
 * - dim accents (<3:1 vs base) are BLOCKED: applied visually so the user can
 *   preview, but not persisted, with an inline warning and auto-revert;
 * - free-picker drags apply live but persist debounced (300ms) instead of an
 *   IPC write per tick.
 */
export function AccentPicker({ current }: { current: string | null }) {
  const [accent, setAccent] = useState<string>(current ?? DEFAULT_ACCENT)
  const [tooDim, setTooDim] = useState(false)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep local state in sync when the parent loads the saved pref, and
  // re-evaluate the visibility warning for previously-saved colors.
  useEffect(() => {
    if (!current) return
    setAccent(current)
    setTooDim(!isAccentVisibleOnBase(current))
  }, [current])

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    }
  }, [])

  const choose = (hex: string) => {
    const normalized = hex.toLowerCase()
    setAccent(normalized)
    applyAccent(normalized) // live preview

    if (!isAccentVisibleOnBase(normalized)) {
      // Preview only — do not persist an unreadable theme. Snap back after
      // a beat so the UI never rests in a broken-looking state.
      setTooDim(true)
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        setAccent(current ?? DEFAULT_ACCENT)
        applyAccent(current ?? DEFAULT_ACCENT)
        setTooDim(false)
      }, 2500)
      return
    }

    setTooDim(false)
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      void setAccentPreference(normalized).then((ok) => {
        if (!ok) toastError('That color could not be saved.')
      })
    }, 300)
  }

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Accent color">
        {ACCENT_PRESETS.map((preset) => {
          const active = accent === preset.hex
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              title={preset.name}
              onClick={() => choose(preset.hex)}
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2 transition-colors duration-150 ${
                active ? 'border-accent/70 bg-accent-soft' : 'border-line hover:border-line-strong'
              }`}
            >
              <span className="relative" aria-hidden>
                <span
                  className="block h-3.5 w-3.5 rounded-full border border-black/20"
                  style={{ backgroundColor: preset.hex }}
                />
                {active && (
                  <Check
                    size={9}
                    strokeWidth={3}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-base drop-shadow"
                  />
                )}
              </span>
              <span className={`text-[11.5px] ${active ? 'text-accent' : 'text-dim'}`}>
                {preset.name.replace(' (default)', '')}
              </span>
            </button>
          )
        })}

        {/* Free color picker */}
        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line px-2 transition-colors duration-150 hover:border-line-strong">
          <input
            type="color"
            value={accent}
            onChange={(e) => choose(e.target.value)}
            aria-label={`Custom accent color (${BASE_HEX} background)`}
            className="h-4 w-4 cursor-pointer border-none bg-transparent p-0"
          />
          <span className="tnum font-mono text-[11px] text-faint">{accent}</span>
        </label>
      </div>

      {tooDim && (
        <p role="alert" className="mt-2 text-[11.5px] text-warn">
          That accent is too dim against the charcoal background to save — it was only previewed.
          Pick something brighter.
        </p>
      )}
      <p className="mt-2 text-[11px] text-faint">
        Hover shade, soft tint and button label contrast are derived automatically.
      </p>
    </div>
  )
}
