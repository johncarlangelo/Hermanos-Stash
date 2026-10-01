import { describe, expect, it } from 'vitest'
import { colorDistance, detectBackgroundColor, hexToRgb, removeBackground, rgbToHex } from './logic'

describe('Background Remover Logic', () => {
  it('calculates color distance accurately', () => {
    // Identical colors
    expect(colorDistance(255, 255, 255, 255, 255, 255)).toBe(0)
    expect(colorDistance(0, 0, 0, 0, 0, 0)).toBe(0)

    // Maximum distance (Black vs White)
    expect(colorDistance(0, 0, 0, 255, 255, 255)).toBeCloseTo(100, 1)

    // Small difference
    const smallDist = colorDistance(255, 255, 255, 250, 250, 250)
    expect(smallDist).toBeGreaterThan(0)
    expect(smallDist).toBeLessThan(5)
  })

  it('detects perimeter background color', () => {
    // 6x6 image with green background (0, 255, 0) and red center (255, 0, 0)
    const width = 6
    const height = 6
    const data = new Uint8ClampedArray(width * height * 4)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        // Center 2x2 is red
        if (x >= 2 && x <= 3 && y >= 2 && y <= 3) {
          data[idx] = 255 // R
          data[idx + 1] = 0 // G
          data[idx + 2] = 0 // B
          data[idx + 3] = 255 // A
        } else {
          // Perimeter is pure green
          data[idx] = 0
          data[idx + 1] = 255
          data[idx + 2] = 0
          data[idx + 3] = 255
        }
      }
    }

    const detected = detectBackgroundColor({ data, width, height } as unknown as ImageData)
    expect(detected.r).toBe(0)
    expect(detected.g).toBe(255)
    expect(detected.b).toBe(0)
  })

  it('contiguous mode removes background but protects enclosed inner regions of same color', () => {
    // 7x7 image:
    // Outer border = White (255, 255, 255)
    // Dark barrier ring = Black (0, 0, 0)
    // Inner island = White (255, 255, 255)
    const width = 7
    const height = 7
    const data = new Uint8ClampedArray(width * height * 4)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const isBorder = x === 0 || x === 6 || y === 0 || y === 6
        const isRing = x === 1 || x === 5 || y === 1 || y === 5

        if (isBorder) {
          // Outer white background
          data[idx] = 255
          data[idx + 1] = 255
          data[idx + 2] = 255
          data[idx + 3] = 255
        } else if (isRing) {
          // Dark barrier
          data[idx] = 0
          data[idx + 1] = 0
          data[idx + 2] = 0
          data[idx + 3] = 255
        } else {
          // Inner island white (like teeth or white shirt)
          data[idx] = 255
          data[idx + 1] = 255
          data[idx + 2] = 255
          data[idx + 3] = 255
        }
      }
    }

    const result = removeBackground({ data, width, height } as unknown as ImageData, {
      keyColor: { r: 255, g: 255, b: 255 },
      mode: 'contiguous',
      tolerance: 10,
      feather: 0
    })

    // Outer corner (0, 0) should be transparent (alpha 0)
    expect(result.data[0 + 3]).toBe(0)

    // Barrier ring (1, 1) should remain opaque (alpha 255)
    const ringIdx = (1 * width + 1) * 4
    expect(result.data[ringIdx + 3]).toBe(255)

    // Inner island center (3, 3) must NOT be removed in contiguous mode (alpha 255)
    const centerIdx = (3 * width + 3) * 4
    expect(result.data[centerIdx + 3]).toBe(255)
  })

  it('global mode removes all matching color pixels across entire image', () => {
    // 5x5 image where corners and center are white, middle is dark
    const width = 5
    const height = 5
    const data = new Uint8ClampedArray(width * height * 4)

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4
      data[idx] = 0
      data[idx + 1] = 0
      data[idx + 2] = 0
      data[idx + 3] = 255
    }

    // Set center pixel to white
    const centerIdx = (2 * width + 2) * 4
    data[centerIdx] = 255
    data[centerIdx + 1] = 255
    data[centerIdx + 2] = 255

    const result = removeBackground({ data, width, height } as unknown as ImageData, {
      keyColor: { r: 255, g: 255, b: 255 },
      mode: 'global',
      tolerance: 15,
      feather: 0
    })

    // Center pixel should be transparent in global mode
    expect(result.data[centerIdx + 3]).toBe(0)
  })

  it('converts between RGB and Hex strings accurately', () => {
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#FFFFFF')
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000')
    expect(rgbToHex({ r: 59, g: 130, b: 246 })).toBe('#3B82F6')

    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(hexToRgb('#3B82F6')).toEqual({ r: 59, g: 130, b: 246 })
  })
})
