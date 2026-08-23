import { describe, expect, it } from 'vitest'
import {
  clampQuality,
  DEFAULT_QUALITY,
  extensionFor,
  parseExportFormat,
  parseScale,
  paddedPageName
} from './logic'

describe('paddedPageName', () => {
  it('zero-pads page numbers to three digits', () => {
    expect(paddedPageName(1, 'png')).toBe('page-001.png')
    expect(paddedPageName(9, 'png')).toBe('page-009.png')
    expect(paddedPageName(12, 'png')).toBe('page-012.png')
    expect(paddedPageName(123, 'png')).toBe('page-123.png')
  })

  it('maps jpeg to the .jpg extension and keeps png', () => {
    expect(paddedPageName(2, 'jpeg')).toBe('page-002.jpg')
    expect(extensionFor('jpeg')).toBe('.jpg')
    expect(extensionFor('png')).toBe('.png')
  })

  it('grows past three digits without breaking sort order', () => {
    expect(paddedPageName(1000, 'png')).toBe('page-1000.png')
  })

  it('defends against zero or fractional input', () => {
    expect(paddedPageName(0, 'png')).toBe('page-001.png')
    expect(paddedPageName(2.7, 'jpg' as never)).toBeDefined()
  })
})

describe('clampQuality', () => {
  it('keeps values inside the window untouched', () => {
    expect(clampQuality(85)).toBe(85)
    expect(clampQuality(DEFAULT_QUALITY)).toBe(DEFAULT_QUALITY)
    expect(clampQuality(60)).toBe(60)
    expect(clampQuality(100)).toBe(100)
  })

  it('clamps low and high outliers', () => {
    expect(clampQuality(10)).toBe(60)
    expect(clampQuality(59.4)).toBe(60)
    expect(clampQuality(150)).toBe(100)
  })

  it('rounds fractions and rescues NaN with the default', () => {
    expect(clampQuality(82.6)).toBe(83)
    expect(clampQuality(Number.NaN)).toBe(DEFAULT_QUALITY)
  })
})

describe('option parsing', () => {
  it('accepts only known scales, falling back to 1x', () => {
    expect(parseScale(1)).toBe(1)
    expect(parseScale(1.5)).toBe(1.5)
    expect(parseScale(2)).toBe(2)
    expect(parseScale(3)).toBe(1)
    expect(parseScale(undefined)).toBe(1)
    expect(parseScale('two')).toBe(1)
  })

  it('accepts only known formats, falling back to png', () => {
    expect(parseExportFormat('jpeg')).toBe('jpeg')
    expect(parseExportFormat('png')).toBe('png')
    expect(parseExportFormat('webp')).toBe('png')
    expect(parseExportFormat(undefined)).toBe('png')
  })
})
