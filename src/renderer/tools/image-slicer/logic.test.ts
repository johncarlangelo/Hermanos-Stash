import { describe, expect, it } from 'vitest'
import { calculateSlices, DEFAULT_SLICE_CONFIG } from './logic'

describe('image-slicer logic', () => {
  it('calculates 3x3 grid slices for a 900x900 image', () => {
    const slices = calculateSlices(900, 900, DEFAULT_SLICE_CONFIG, 'banner.png')
    expect(slices.length).toBe(9)
    expect(slices[0].width).toBe(300)
    expect(slices[0].height).toBe(300)
    expect(slices[0].filename).toBe('banner_r1_c1.png')
    expect(slices[8].filename).toBe('banner_r3_c3.png')
  })

  it('calculates 2x1 horizontal split', () => {
    const slices = calculateSlices(1200, 600, {
      ...DEFAULT_SLICE_CONFIG,
      cols: 2,
      rows: 1,
      format: 'jpeg'
    })
    expect(slices.length).toBe(2)
    expect(slices[0].width).toBe(600)
    expect(slices[0].filename).toBe('image_r1_c1.jpg')
    expect(slices[1].filename).toBe('image_r1_c2.jpg')
  })

  it('handles fixed-size tile slicing', () => {
    const slices = calculateSlices(500, 500, {
      ...DEFAULT_SLICE_CONFIG,
      mode: 'fixed-size',
      tileWidth: 200,
      tileHeight: 200,
      namingPattern: 'sequential'
    })
    // 3 cols x 3 rows = 9 tiles with clamped edges
    expect(slices.length).toBe(9)
    expect(slices[0].filename).toBe('image_01.png')
    expect(slices[8].width).toBe(100)
  })
})
