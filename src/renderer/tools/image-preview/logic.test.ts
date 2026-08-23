import { describe, expect, it } from 'vitest'
import { ACCEPTED_IMAGE_EXTENSIONS, stepZoom, ZOOM_MAX_PERCENT, ZOOM_MIN_PERCENT } from './logic'

describe('stepZoom', () => {
  it('starts stepping from 100% when the image is currently fitted', () => {
    expect(stepZoom('fit', 1)).toBe(125)
    expect(stepZoom('fit', -1)).toBe(75)
  })

  it('steps by exactly one increment in either direction', () => {
    expect(stepZoom(200, 1)).toBe(225)
    expect(stepZoom(200, -1)).toBe(175)
  })

  it('clamps at the configured bounds instead of overshooting them', () => {
    expect(stepZoom(ZOOM_MAX_PERCENT, 1)).toBe(ZOOM_MAX_PERCENT)
    expect(stepZoom(ZOOM_MIN_PERCENT, -1)).toBe(ZOOM_MIN_PERCENT)
    expect(stepZoom(ZOOM_MIN_PERCENT + 5, -1)).toBe(ZOOM_MIN_PERCENT)
  })
})

describe('ACCEPTED_IMAGE_EXTENSIONS', () => {
  it('covers the common raster and vector formats without duplicates', () => {
    expect(new Set(ACCEPTED_IMAGE_EXTENSIONS).size).toBe(ACCEPTED_IMAGE_EXTENSIONS.length)
    for (const ext of ACCEPTED_IMAGE_EXTENSIONS) expect(ext.startsWith('.')).toBe(true)
  })
})
