import { describe, expect, it } from 'vitest'
import {
  adjustLuminance,
  convertPixelsToAscii,
  DEFAULT_ASCII_OPTIONS,
  pixelToChar,
  type PixelData
} from './logic'

describe('image-to-ascii logic', () => {
  it('adjusts luminance with brightness and contrast', () => {
    expect(adjustLuminance(100, 0, 0)).toBe(100)
    expect(adjustLuminance(100, 20, 0)).toBe(151)
    expect(adjustLuminance(100, -20, 0)).toBe(49)
  })

  it('converts dark pixel to dense character in standard charset', () => {
    const darkPixel: PixelData = { r: 10, g: 10, b: 10, a: 255 }
    const res = pixelToChar(darkPixel, '@%#*+=-:. ', false, 0, 0)
    expect(res.char).toBe('@')
  })

  it('converts white pixel to space character in standard charset', () => {
    const whitePixel: PixelData = { r: 255, g: 255, b: 255, a: 255 }
    const res = pixelToChar(whitePixel, '@%#*+=-:. ', false, 0, 0)
    expect(res.char).toBe(' ')
  })

  it('inverts character mapping when invert is true', () => {
    const darkPixel: PixelData = { r: 10, g: 10, b: 10, a: 255 }
    const res = pixelToChar(darkPixel, '@%#*+=-:. ', true, 0, 0)
    expect(res.char).toBe(' ')
  })

  it('processes grid of pixels to text, html, and ansi', () => {
    const grid: PixelData[][] = [
      [
        { r: 0, g: 0, b: 0, a: 255 },
        { r: 255, g: 255, b: 255, a: 255 }
      ],
      [
        { r: 255, g: 255, b: 255, a: 255 },
        { r: 0, g: 0, b: 0, a: 255 }
      ]
    ]

    const out = convertPixelsToAscii(grid, DEFAULT_ASCII_OPTIONS)
    expect(out.text.split('\n').length).toBe(2)
    expect(out.html).toContain('<span style="color:rgb')
    expect(out.ansi).toContain('\x1b[38;2;')
  })
})
