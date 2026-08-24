/**
 * Pure color math for the Color Converter: parsing, space conversion
 * (HEX ⇄ RGB ⇄ HSL), WCAG contrast, and palette generation.
 * All functions are deterministic and side-effect free so they can be
 * exhaustively tested without a DOM.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Hsl {
  h: number
  s: number
  l: number
}

export type ParsedColor = { rgb: Rgb } | { error: string }

const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const HEX_LONG = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const RGB_FN = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i
const HSL_FN =
  /^hsla?\(\s*([+-]?\d+(?:\.\d+)?)\s*(?:deg)?\s*,\s*([+-]?\d+(?:\.\d+)?)%\s*,\s*([+-]?\d+(?:\.\d+)?)%\s*\)$/i

/** Parse `#rgb`, `#rrggbb`, `rgb(r,g,b)` or `hsl(h,s%,l%)` (spacing/case tolerant). */
export function parseColor(input: string): ParsedColor {
  const text = input.trim()
  if (!text) return { error: 'Enter a color like #2563eb, rgb(37, 99, 235) or hsl(217, 91%, 53%).' }

  const long = HEX_LONG.exec(text)
  if (long) return { rgb: hexToRgb(text) as Rgb }

  const short = HEX_SHORT.exec(text)
  if (short) {
    const expanded = '#' + [...short.slice(1)].map((c) => c + c).join('')
    return { rgb: hexToRgb(expanded) as Rgb }
  }

  const rgbMatch = RGB_FN.exec(text)
  if (rgbMatch) {
    const [r, g, b] = rgbMatch.slice(1).map(Number)
    if ([r, g, b].some((v) => v > 255)) {
      return { error: 'RGB channels must be between 0 and 255.' }
    }
    return { rgb: { r: r as number, g: g as number, b: b as number } }
  }

  const hslMatch = HSL_FN.exec(text)
  if (hslMatch) {
    const h = Number(hslMatch[1])
    const s = Number(hslMatch[2])
    const l = Number(hslMatch[3])
    if (s < 0 || s > 100 || l < 0 || l > 100) {
      return { error: 'HSL saturation and lightness must be between 0% and 100%.' }
    }
    return { rgb: hslToRgb({ h: ((h % 360) + 360) % 360, s, l }) }
  }

  return { error: 'Not a recognized color — try #rgb, #rrggbb, rgb(r, g, b) or hsl(h, s%, l%).' }
}

export function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

export function hexToRgb(hex: string): Rgb | null {
  const long = HEX_LONG.exec(hex.trim())
  if (!long) {
    const short = HEX_SHORT.exec(hex.trim())
    if (!short) return null
    const expanded = '#' + [...short.slice(1)].map((c) => c + c).join('')
    const parts = HEX_LONG.exec(expanded)!
    return channelsFromHexParts(parts)
  }
  return channelsFromHexParts(long)
}

function channelsFromHexParts(match: RegExpExecArray): Rgb {
  return {
    r: parseInt(match[1]!, 16),
    g: parseInt(match[2]!, 16),
    b: parseInt(match[3]!, 16)
  }
}

export function rgbToHex(rgb: Rgb): string {
  const part = (v: number) =>
    Math.min(255, Math.max(0, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`
}

export function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const l = (max + min) / 2

  let h = 0
  let s = 0
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    if (max === r) h = 60 * (((g - b) / delta) % 6)
    else if (max === g) h = 60 * ((b - r) / delta + 2)
    else h = 60 * ((r - g) / delta + 4)
  }
  return { h: ((h % 360) + 360) % 360, s: s * 100, l: l * 100 }
}

export function hslToRgb(hsl: Hsl): Rgb {
  const h = (((hsl.h % 360) + 360) % 360) / 60
  const s = Math.min(1, Math.max(0, hsl.s / 100))
  const l = Math.min(1, Math.max(0, hsl.l / 100))

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = l - c / 2

  const sectors: Array<[number, number, number]> = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x]
  ]
  const [rp, gp, bp] = sectors[Math.min(5, Math.max(0, Math.floor(h)))]!

  return {
    r: clampChannel((rp + m) * 255),
    g: clampChannel((gp + m) * 255),
    b: clampChannel((bp + m) * 255)
  }
}

/** WCAG relative luminance of an RGB color (linearized sRGB). */
export function relativeLuminance(rgb: Rgb): number {
  const linear = (channel: number) => {
    const v = channel / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b)
}

/** WCAG contrast ratio between two colors, 1–21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function contrastAgainstWhite(rgb: Rgb): number {
  return contrastRatio(rgb, { r: 255, g: 255, b: 255 })
}

export function contrastAgainstBlack(rgb: Rgb): number {
  return contrastRatio(rgb, { r: 0, g: 0, b: 0 })
}

/** Best readable foreground on a background: 'black' or 'white'. */
export function bestTextOn(bg: Rgb): 'black' | 'white' {
  return contrastAgainstBlack(bg) >= contrastAgainstWhite(bg) ? 'black' : 'white'
}

/**
 * Evenly spaced darker→lighter scale built from HSL lightness, clamped to a
 * usable range so extreme bases still produce visible steps.
 */
export function shadesAndTints(hex: string, steps = 8): string[] {
  const base = hexToRgb(hex)
  if (!base || steps < 2) return []
  const count = Math.min(16, Math.floor(steps))
  const baseHsl = rgbToHsl(base)
  const low = Math.max(6, Math.min(baseHsl.l - 24, 50))
  const high = Math.min(96, Math.max(baseHsl.l + 24, 52))
  const colors: string[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    colors.push(rgbToHex(hslToRgb({ ...baseHsl, l: low + t * (high - low) })))
  }
  return colors
}

function rotateHue(hex: string, degrees: number): string | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const hsl = rgbToHsl(rgb)
  return rgbToHex(
    hslToRgb({ ...hsl, h: (((hsl.h + degrees) % 360) + 360) % 360, s: hsl.s, l: hsl.l })
  )
}

export interface Harmonies {
  complementary: string | null
  analogous: [string | null, string | null]
  triadic: [string | null, string | null]
  splitComplementary: [string | null, string | null]
}

/** Classic hue-wheel harmonies at ±30/120/240/150/210 degrees from the base. */
export function harmonies(hex: string): Harmonies {
  return {
    complementary: rotateHue(hex, 180),
    analogous: [rotateHue(hex, -30), rotateHue(hex, 30)],
    triadic: [rotateHue(hex, 120), rotateHue(hex, 240)],
    splitComplementary: [rotateHue(hex, 150), rotateHue(hex, 210)]
  }
}
