import { useEffect, useState } from 'react'
import { ACCENT_PRESETS, isAccentVisibleOnBase } from '../settings/accent-theme'
import { setAccentPreference } from '../../accent-runtime'
import { toastError } from '../../stores/toasts'

/**
 * Accent selector (Milestone 7): curated preset swatches + a free color
 * picker. Dark-only stays; only the accent changes. Live-applied and
 * persisted via prefs `ui.accent`.
 */
export function AccentPicker({ current }: { current: string | null }) {
  const [accent, setAccent] = useState<string>(current ?? '#d9a35c')
  const [visible, setVisible] = useState(true)

  // Keep local state in sync when the parent loads the saved pref.
  useEffect(() => {
    if (current) setAccent(current)
  }, [current])

  const choose = async (hex: string) => {
    const normalized = hex.toLowerCase()
    setVisible(isAccentVisibleOnBase(normalized))
    setAccent(normalized)
    const ok = await setAccentPreference(normalized)
    if (!ok) toastError('That color could not be applied.')
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Accent color">
        {ACCENT_PRESETS.map((preset) => {
          const active = accent === preset.hex
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={active}
              title={preset.name}
              onClick={() => void choose(preset.hex)}
              className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2 transition-colors duration-150 ${
                active ? 'border-accent/70 bg-accent-soft' : 'border-line hover:border-line-strong'
              }`}
            >
              <span
                aria-hidden
                className="h-3.5 w-3.5 rounded-full border border-black/20"
                style={{ backgroundColor: preset.hex }}
              />
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
            onChange={(e) => void choose(e.target.value)}
            aria-label="Custom accent color"
            className="h-4 w-4 cursor-pointer border-none bg-transparent p-0"
          />
          <span className="font-mono text-[11px] text-faint tnum">{accent}</span>
        </label>
      </div>

      {!visible && (
        <p role="status" className="mt-2 text-[11.5px] text-warn">
          That accent is too dim against the charcoal background — buttons and highlights may be
          hard to see. Pick something brighter.
        </p>
      )}
      <p className="mt-2 text-[11px] text-faint">
        Hover shade, soft tint and button label contrast are derived automatically.
      </p>
    </div>
  )
}
