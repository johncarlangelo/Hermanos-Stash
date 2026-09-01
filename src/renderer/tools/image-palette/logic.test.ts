import { describe, expect, it } from 'vitest'
import {
  calculateContrastRatio,
  calculateLuminance,
  extractDominantColors,
  generatePaletteCode,
  rgbToHex,
  rgbToHsl
} from './logic'

describe('image-palette logic', () => {
  it('converts RGB to HEX correctly', () => {
    expect(rgbToHex(255, 255, 255)).toBe('#FFFFFF')
    expect(rgbToHex(0, 0, 0)).toBe('#000000')
    expect(rgbToHex(245, 158, 11)).toBe('#F59E0B')
  })

  it('converts RGB to HSL correctly', () => {
    const hsl = rgbToHsl(255, 0, 0)
    expect(hsl.h).toBe(0)
    expect(hsl.s).toBe(100)
    expect(hsl.l).toBe(50)
  })

  it('calculates WCAG contrast ratios', () => {
    const whiteLum = calculateLuminance(255, 255, 255)
    const blackLum = calculateLuminance(0, 0, 0)
    expect(calculateContrastRatio(whiteLum, blackLum)).toBe(21)
  })

  it('extracts dominant color swatches from pixel array', () => {
    // 4 red pixels and 4 blue pixels (RGBA)
    const pixels = [
      255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255,
      255, 0, 0, 255, 255, 0, 0, 255, 255
    ]
    const swatches = extractDominantColors(pixels, 2)
    expect(swatches.length).toBeGreaterThanOrEqual(1)
  })

  it('generates CSS variables and Tailwind config snippets', () => {
    const swatches = [
      {
        hex: '#F59E0B',
        rgb: 'rgb(245, 158, 11)',
        hsl: 'hsl(38, 92%, 50%)',
        r: 245,
        g: 158,
        b: 11,
        luminance: 0.45,
        contrastWhite: 2.1,
        contrastBlack: 9.5,
        population: 100
      }
    ]
    const css = generatePaletteCode(swatches, 'css')
    expect(css).toContain('--color-palette-1: #F59E0B')

    const tailwind = generatePaletteCode(swatches, 'tailwind')
    expect(tailwind).toContain('brand')
  })
})
