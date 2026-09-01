/**
 * Image color quantization, palette extraction, and contrast calculation logic
 */

export interface SwatchColor {
  hex: string
  rgb: string
  hsl: string
  r: number
  g: number
  b: number
  luminance: number
  contrastWhite: number
  contrastBlack: number
  population: number
}

/**
 * Convert RGB (0-255) to 6-char HEX string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)
        break
      case gNorm:
        h = (bNorm - rNorm) / d + 2
        break
      case bNorm:
        h = (rNorm - gNorm) / d + 4
        break
    }
    h /= 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

/**
 * Calculate relative luminance (WCAG 2.1)
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
}

/**
 * Calculate WCAG contrast ratio between two luminance values
 */
export function calculateContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2))
}

/**
 * Simple fast Color Quantization (K-Means like spatial bucketing)
 */
export function extractDominantColors(
  pixelData: Uint8ClampedArray | number[],
  colorCount = 6
): SwatchColor[] {
  const buckets: Record<string, { r: number; g: number; b: number; count: number }> = {}

  // Sample every 4th pixel for speed while preserving fidelity
  const step = 16
  for (let i = 0; i < pixelData.length; i += step) {
    const a = pixelData[i + 3]
    if (a < 50) continue // Skip transparent

    const r = pixelData[i]
    const g = pixelData[i + 1]
    const b = pixelData[i + 2]

    // Quantize into 32-value buckets (8 levels per channel)
    const qR = Math.floor(r / 32) * 32 + 16
    const qG = Math.floor(g / 32) * 32 + 16
    const qB = Math.floor(b / 32) * 32 + 16

    const key = `${qR},${qG},${qB}`
    if (!buckets[key]) {
      buckets[key] = { r: 0, g: 0, b: 0, count: 0 }
    }
    buckets[key].r += r
    buckets[key].g += g
    buckets[key].b += b
    buckets[key].count++
  }

  // Sort by population
  const sorted = Object.values(buckets)
    .sort((a, b) => b.count - a.count)
    .slice(0, colorCount)

  const whiteLum = calculateLuminance(255, 255, 255)
  const blackLum = calculateLuminance(0, 0, 0)

  return sorted.map((item) => {
    const r = Math.round(item.r / item.count)
    const g = Math.round(item.g / item.count)
    const b = Math.round(item.b / item.count)

    const hex = rgbToHex(r, g, b)
    const hslObj = rgbToHsl(r, g, b)
    const lum = calculateLuminance(r, g, b)

    return {
      hex,
      rgb: `rgb(${r}, ${g}, ${b})`,
      hsl: `hsl(${hslObj.h}, ${hslObj.s}%, ${hslObj.l}%)`,
      r,
      g,
      b,
      luminance: Number(lum.toFixed(3)),
      contrastWhite: calculateContrastRatio(lum, whiteLum),
      contrastBlack: calculateContrastRatio(lum, blackLum),
      population: item.count
    }
  })
}

/**
 * Generate exportable code snippets from swatches
 */
export function generatePaletteCode(
  swatches: SwatchColor[],
  format: 'css' | 'tailwind' | 'json'
): string {
  if (swatches.length === 0) return ''

  if (format === 'css') {
    const vars = swatches
      .map((s, idx) => `  --color-palette-${idx + 1}: ${s.hex}; /* ${s.hsl} */`)
      .join('\n')
    return `:root {\n${vars}\n}`
  }

  if (format === 'tailwind') {
    const colorObj: Record<string, string> = {}
    swatches.forEach((s, idx) => {
      const step = (idx + 1) * 100
      colorObj[String(step)] = s.hex
    })
    return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        brand: ${JSON.stringify(colorObj, null, 10).replace(/}\n/g, '      }\n')}\n      }\n    }\n  }\n};`
  }

  return JSON.stringify(
    swatches.map((s) => ({
      hex: s.hex,
      rgb: s.rgb,
      hsl: s.hsl,
      contrastWhite: s.contrastWhite,
      contrastBlack: s.contrastBlack
    })),
    null,
    2
  )
}
