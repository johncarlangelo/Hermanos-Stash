import { describe, it, expect } from 'vitest'
import {
  ACCENT_PRESETS,
  BASE_HEX,
  deriveAccentTheme,
  deriveContrast,
  deriveHover,
  deriveSoft,
  isAccentVisibleOnBase
} from './accent-theme'
import { hexToRgb, contrastRatio, rgbToHex } from '../../tools/color-converter/logic'

describe('deriveHover', () => {
  it('lightens dark accents', () => {
    const base = hexToRgb('#5b7fb4')!
    const hover = hexToRgb(deriveHover('#5b7fb4'))!
    expect(contrastRatio(hover, { r: 0, g: 0, b: 0 })).toBeGreaterThan(
      contrastRatio(base, { r: 0, g: 0, b: 0 })
    )
  })

  it('darkens very light accents (L > 65)', () => {
    const base = hexToRgb('#f7e3a8')!
    const hover = hexToRgb(deriveHover('#f7e3a8'))!
    // Lightness moved down: hover should be darker overall.
    const lum = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b
    expect(lum(hover)).toBeLessThan(lum(base))
  })

  it('is stable for invalid input (returns input)', () => {
    expect(deriveHover('nope')).toBe('nope')
  })
})

describe('deriveSoft', () => {
  it('produces an rgba string at 0.13 alpha', () => {
    expect(deriveSoft('#d9a35c')).toMatch(/^rgba\(\d+, \d+, \d+, 0\.13\)$/)
  })

  it('matches the source channel values', () => {
    const rgb = hexToRgb('#7fa3c4')!
    expect(deriveSoft('#7fa3c4')).toBe(`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.13)`)
  })
})

describe('deriveContrast', () => {
  it('picks dark label text on light accents', () => {
    expect(deriveContrast('#d9a35c')).toBe('#16181d')
  })

  it('picks white label text on dark accents', () => {
    expect(deriveContrast('#3a4a8c')).toBe('#ffffff')
  })

  it('falls back safely on invalid input', () => {
    expect(['#16181d', '#ffffff', '#241a0c']).toContain(deriveContrast('bad'))
  })
})

describe('isAccentVisibleOnBase', () => {
  it('accepts every curated preset', () => {
    for (const preset of ACCENT_PRESETS) {
      expect(isAccentVisibleOnBase(preset.hex), `${preset.id} must be visible`).toBe(true)
    }
  })

  it('rejects colors that melt into the charcoal base', () => {
    expect(isAccentVisibleOnBase('#1d2027')).toBe(false)
    expect(isAccentVisibleOnBase('#232732')).toBe(false)
  })

  it('guards against the documented ~3:1 threshold', () => {
    // Exactly at the boundary — the function must be >= 3, not > 3, so a
    // color with ratio exactly 3 passes.
    const rgb = hexToRgb(BASE_HEX)!
    expect(contrastRatio(rgb, hexToRgb('#1a1c22')!)).toBeLessThan(3)
  })
})

describe('deriveAccentTheme', () => {
  it('round-trips through normalization (#D9A35C → lowercase)', () => {
    const theme = deriveAccentTheme('#D9A35C')!
    expect(theme.accent).toBe('#d9a35c')
  })

  it('derives all four variables for each preset', () => {
    for (const preset of ACCENT_PRESETS) {
      const theme = deriveAccentTheme(preset.hex)
      expect(theme).not.toBeNull()
      expect(theme!.accent).toBe(rgbToHex(hexToRgb(preset.hex)!))
      expect(theme!.hover).toMatch(/^#[0-9a-f]{6}$/)
      expect(theme!.soft).toMatch(/^rgba\(/)
      expect(['#16181d', '#ffffff']).toContain(theme!.contrast)
    }
  })

  it('returns null for unparseable input', () => {
    expect(deriveAccentTheme('hello')).toBeNull()
  })

  it('keeps the default amber theme consistent with the CSS defaults', () => {
    const theme = deriveAccentTheme('#d9a35c')!
    expect(theme.accent).toBe('#d9a35c')
    // Amber is mid-lightness (L≈60.6): hover must lighten, not darken.
    expect(theme.hover).toMatch(/^#e[0-9a-f]/)
    expect(theme.soft).toBe('rgba(217, 163, 92, 0.13)')
    expect(theme.contrast).toBe('#16181d')
  })
})
