import { describe, expect, it } from 'vitest'
import {
  bestTextOn,
  contrastAgainstBlack,
  contrastAgainstWhite,
  contrastRatio,
  harmonies,
  hexToRgb,
  hslToRgb,
  parseColor,
  relativeLuminance,
  rgbToHex,
  rgbToHsl,
  shadesAndTints
} from './logic'

describe('parseColor', () => {
  it('accepts every supported syntax', () => {
    expect(parseColor('#f00')).toEqual({ rgb: { r: 255, g: 0, b: 0 } })
    expect(parseColor('#ff0000')).toEqual({ rgb: { r: 255, g: 0, b: 0 } })
    expect(parseColor('  #FF0000 ')).toEqual({ rgb: { r: 255, g: 0, b: 0 } })
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ rgb: { r: 255, g: 0, b: 0 } })
    expect(parseColor('RGB(255,0,0)')).toEqual({ rgb: { r: 255, g: 0, b: 0 } })
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ rgb: { r: 255, g: 0, b: 0 } })
    const spacedHsl = parseColor('HSL(120 , 50% , 25%)')
    expect('rgb' in spacedHsl && spacedHsl.rgb).toEqual(hslToRgb({ h: 120, s: 50, l: 25 }))
  })

  it('wraps hue outside 0–360', () => {
    const parsed = parseColor('hsl(420, 100%, 50%)')
    expect(parsed).toEqual({ rgb: hslToRgb({ h: 60, s: 100, l: 50 }) })
  })

  it('rejects invalid input with a helpful message', () => {
    expect('error' in parseColor('')).toBe(true)
    expect('error' in parseColor('#12345')).toBe(true)
    expect('error' in parseColor('#gggggg')).toBe(true)
    expect('error' in parseColor('not a color')).toBe(true)
    expect('error' in parseColor('rgb(300, 0, 0)')).toBe(true)
    expect('error' in parseColor('hsl(0, 101%, 50%)')).toBe(true)
    expect('error' in parseColor('hsl(0, 100)')).toBe(true)
  })
})

describe('hex ⇄ rgb ⇄ hsl round trips', () => {
  const SAMPLES = ['#000000', '#ffffff', '#ff0000', '#2563eb', '#7c3aed', '#eab308', '#10b981']

  it('hex → rgb → hex is exact', () => {
    for (const hex of SAMPLES) {
      const rgb = hexToRgb(hex)!
      expect(rgbToHex(rgb)).toBe(hex.toLowerCase())
    }
  })

  it('hex → hsl → hex is stable within tolerance', () => {
    for (const hex of SAMPLES) {
      const back = rgbToHex(hslToRgb(rgbToHsl(hexToRgb(hex)!)))
      expectChannelClose(back, hex.toLowerCase())
    }
  })

  it('rgb → hsl → rgb is stable within tolerance', () => {
    const source = hexToRgb('#3b82f6')!
    const back = hslToRgb(rgbToHsl(source))
    expect(Math.abs(back.r - source.r)).toBeLessThanOrEqual(1)
    expect(Math.abs(back.g - source.g)).toBeLessThanOrEqual(1)
    expect(Math.abs(back.b - source.b)).toBeLessThanOrEqual(1)
  })

  function expectChannelClose(actual: string, expected: string): void {
    const a = hexToRgb(actual)!
    const e = hexToRgb(expected)!
    expect(Math.abs(a.r - e.r)).toBeLessThanOrEqual(2)
    expect(Math.abs(a.g - e.g)).toBeLessThanOrEqual(2)
    expect(Math.abs(a.b - e.b)).toBeLessThanOrEqual(2)
  }
})

describe('relativeLuminance', () => {
  it('returns known anchor values', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0)
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5)
    expect(relativeLuminance({ r: 255, g: 0, b: 0 })).toBeCloseTo(0.2126, 4)
  })
})

describe('contrastRatio', () => {
  it('gives 21 for pure black vs white and is symmetric', () => {
    const black = { r: 0, g: 0, b: 0 }
    const white = { r: 255, g: 255, b: 255 }
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5)
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5)
  })

  it('gives 1 for identical colors', () => {
    expect(contrastRatio(hexToRgb('#3498db')!, hexToRgb('#3498db')!)).toBeCloseTo(1, 5)
  })

  it('exposes white/black helpers consistent with contrastRatio', () => {
    const mid = hexToRgb('#808080')!
    expect(contrastAgainstWhite(mid)).toBeCloseTo(contrastRatio(mid, { r: 255, g: 255, b: 255 }), 6)
    expect(contrastAgainstBlack(mid)).toBeCloseTo(contrastRatio(mid, { r: 0, g: 0, b: 0 }), 6)
  })
})

describe('bestTextOn', () => {
  it('picks black on white and white on black', () => {
    expect(bestTextOn({ r: 255, g: 255, b: 255 })).toBe('black')
    expect(bestTextOn({ r: 0, g: 0, b: 0 })).toBe('white')
    expect(bestTextOn(hexToRgb('#ffff00')!)).toBe('black')
    expect(bestTextOn(hexToRgb('#1e293b')!)).toBe('white')
  })
})

describe('shadesAndTints', () => {
  it('produces the requested number of steps', () => {
    expect(shadesAndTints('#2563eb')).toHaveLength(8)
    expect(shadesAndTints('#2563eb', 5)).toHaveLength(5)
    expect(shadesAndTints('#2563eb', 99)).toHaveLength(16)
  })

  it('orders darker → lighter by lightness', () => {
    const scale = shadesAndTints('#e11d48')
    for (let i = 1; i < scale.length; i++) {
      expect(rgbToHsl(hexToRgb(scale[i]!)!).l).toBeGreaterThan(rgbToHsl(hexToRgb(scale[i - 1]!)!).l)
    }
  })

  it('returns empty for invalid hex', () => {
    expect(shadesAndTints('nope')).toEqual([])
  })
})

describe('harmonies', () => {
  it('rotates red to the classic harmony hues', () => {
    const h = harmonies('#ff0000')
    expect(h.complementary).toBe('#00ffff')
    expect(h.analogous).toEqual(['#ff0080', '#ff8000'])
    expect(h.triadic).toEqual(['#00ff00', '#0000ff'])
    expect(h.splitComplementary).toEqual(['#00ff80', '#0080ff'])
  })

  it('keeps the base lightness/saturation while rotating hue only', () => {
    const base = rgbToHsl(hexToRgb('#2563eb')!)
    const rotated = rgbToHsl(hexToRgb(harmonies('#2563eb').complementary!)!)
    expect(Math.abs(rotated.h - ((base.h + 180) % 360))).toBeLessThan(2)
    expect(rotated.s).toBeCloseTo(base.s, 0)
    expect(rotated.l).toBeCloseTo(base.l, 0)
  })

  it('handles invalid input gracefully', () => {
    expect(harmonies('nope').complementary).toBeNull()
    expect(harmonies('nope').triadic).toEqual([null, null])
  })
})
