/**
 * Accent theme runtime application (Milestone 7).
 *
 * Reads `ui.accent` from prefs and applies the derived variables to :root
 * before first paint, exactly like `ui.zoom`. Also exposes a live setter
 * used by the Settings picker.
 */

import { deriveAccentTheme } from './features/settings/accent-theme'

export const ACCENT_PREF_KEY = 'ui.accent'
export const DENSITY_PREF_KEY = 'ui.density'

export type Density = 'comfortable' | 'compact'

/** Apply an accent color to the document. Returns false for invalid colors. */
export function applyAccent(hex: string | null | undefined): boolean {
  if (!hex) return false
  const theme = deriveAccentTheme(hex)
  if (!theme) return false
  const root = document.documentElement
  root.style.setProperty('--color-accent', theme.accent)
  root.style.setProperty('--color-accent-hover', theme.hover)
  root.style.setProperty('--color-accent-soft', theme.soft)
  root.style.setProperty('--color-accent-contrast', theme.contrast)
  // shadcn bridge variables point at these via var(), so they follow along.
  return true
}

/** Apply a density preference to the document. Unknown values are ignored. */
export function applyDensity(value: string | null | undefined): void {
  if (value === 'compact') {
    document.documentElement.setAttribute('data-density', 'compact')
  } else if (value === 'comfortable') {
    document.documentElement.removeAttribute('data-density')
  }
}

/** Startup hook: read prefs and apply before the app paints content. */
export async function initAccentFromPrefs(): Promise<void> {
  try {
    const saved = await window.stash.prefs.get<string>(ACCENT_PREF_KEY)
    if (typeof saved === 'string') applyAccent(saved)
    const density = await window.stash.prefs.get<string>(DENSITY_PREF_KEY)
    applyDensity(density)
  } catch {
    // Prefs unavailable (e.g. smoke mode) — keep CSS defaults.
  }
}

/** Persist and live-apply a new accent. */
export async function setAccentPreference(hex: string): Promise<boolean> {
  const applied = applyAccent(hex)
  if (!applied) return false
  try {
    await window.stash.prefs.set(ACCENT_PREF_KEY, hex.toLowerCase())
    return true
  } catch {
    // Applied visually even if persistence failed; caller can toast.
    return false
  }
}

/** Persist and live-apply a density preference. */
export async function setDensityPreference(value: Density): Promise<void> {
  applyDensity(value)
  try {
    await window.stash.prefs.set(DENSITY_PREF_KEY, value)
  } catch {
    // Applied visually even if persistence failed.
  }
}
