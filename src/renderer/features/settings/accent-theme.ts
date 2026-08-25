/**
 * Accent theme engine (Milestone 7).
 *
 * Pure logic: given an accent color, compute every derived CSS-variable value
 * the app needs — hover shade, soft tint, label contrast, and a visibility
 * guard against the charcoal base. Deterministic and side-effect free.
 */

import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  contrastRatio,
  bestTextOn
} from '../../tools/color-converter/logic'

export const BASE_HEX = '#0d0f13'

/** Curated presets shown as swatches in Settings → Appearance. */
export const ACCENT_PRESETS: Array<{ id: string; name: string; hex: string }> = [
  { id: 'amber', name: 'Amber (default)', hex: '#d9a35c' },
  { id: 'sage', name: 'Sage', hex: '#9db88a' },
  { id: 'steel', name: 'Steel Blue', hex: '#7fa3c4' },
  { id: 'rose', name: 'Rose', hex: '#cf8a96' },
  { id: 'violet', name: 'Violet', hex: '#a48fc9' },
  { id: 'teal', name: 'Teal', hex: '#7fb8ae' }
]

export interface AccentTheme {
  accent: string
  hover: string
  soft: string
  contrast: string
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/**
 * Hover shade: lighten dark accents slightly, darken very light ones — keeps
 * hover feedback visible in both directions. Pure HSL lightness shift.
 */
export function deriveHover(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const hsl = rgbToHsl(rgb)
  // Only very light accents (above 70% lightness, where hover must stay
  // visible against near-white text uses) get darker on hover; everything
  // else lightens. The amber default (L≈60.6) lands here → +7 ≈ #e0b379.
  const delta = hsl.l > 70 ? -6 : 7
  return rgbToHex(hslToRgb({ ...hsl, l: clamp01((hsl.l + delta) / 100) * 100 }))
}

/** Soft tint background string at fixed 0.13 alpha. */
export function deriveSoft(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return 'rgba(217, 163, 92, 0.13)'
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.13)`
}

/** Label color for buttons filled with the accent: black or white text by luminance. */
export function deriveContrast(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#241a0c'
  return bestTextOn(rgb) === 'black' ? '#16181d' : '#ffffff'
}

/**
 * Visibility guard: the accent must stay clearly visible against the charcoal
 * base. Below ~3:1 the UI loses its primary affordance color.
 */
export function isAccentVisibleOnBase(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false
  return contrastRatio(rgb, hexToRgb(BASE_HEX)!) >= 3
}

/** Full derivation in one call — what the picker applies to :root. */
export function deriveAccentTheme(hex: string): AccentTheme | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const normalized = rgbToHex(rgb)
  const hover = deriveHover(normalized)
  const r = rgb.r
  const g = rgb.g
  const b = rgb.b
  return {
    accent: normalized,
    hover,
    soft: `rgba(${r}, ${g}, ${b}, 0.13)`,
    contrast: deriveContrast(normalized)
  }
}
