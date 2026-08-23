import { describe, expect, it } from 'vitest'
import {
  buildExifSections,
  formatExifDate,
  formatExposure,
  formatFNumber,
  formatGpsCoordinate,
  hasUsableExif,
  isSupportedExifExtension
} from './logic'

describe('formatExposure', () => {
  it('renders common shutter speeds as clean fractions', () => {
    expect(formatExposure(1 / 250)).toBe('1/250')
    expect(formatExposure(0.004)).toBe('1/250')
    expect(formatExposure(1 / 60)).toBe('1/60')
  })

  it('renders long exposures as fractions or seconds', () => {
    expect(formatExposure(2)).toBe('2 s')
    expect(formatExposure(0.5)).toBe('1/2')
  })

  it('rejects missing or nonsensical values', () => {
    expect(formatExposure(undefined)).toBeNull()
    expect(formatExposure(Number.NaN)).toBeNull()
    expect(formatExposure(0)).toBeNull()
    expect(formatExposure(-1)).toBeNull()
  })
})

describe('formatFNumber', () => {
  it('formats aperture values', () => {
    expect(formatFNumber(2.8)).toBe('f/2.8')
    expect(formatFNumber(8)).toBe('f/8')
    expect(formatFNumber(undefined)).toBeNull()
  })
})

describe('formatGpsCoordinate', () => {
  it('renders decimal degrees at six places', () => {
    expect(formatGpsCoordinate(52.5200066)).toBe('52.520007')
    expect(formatGpsCoordinate(-1.9)).toBe('-1.900000')
    expect(formatGpsCoordinate('not a number')).toBeNull()
    expect(formatGpsCoordinate(undefined)).toBeNull()
  })
})

describe('formatExifDate', () => {
  const fixedNow = Date.UTC(2024, 5, 15, 12, 0)

  it('formats epoch-ms values deterministically', () => {
    // Date-only assertions stay timezone-independent.
    const ms = Date.UTC(2023, 7, 1, 14, 30)
    expect(formatExifDate(ms, 'en-US', fixedNow)).toMatch(/Aug 1/)
    expect(formatExifDate(ms, 'en-US', fixedNow)).toMatch(/\d{1,2}:\d{2}/)
  })

  it('accepts Date objects too (exifr may revive them)', () => {
    const date = new Date(Date.UTC(2023, 7, 1, 14, 30))
    expect(formatExifDate(date, 'en-US', fixedNow)).toBeTruthy()
  })

  it('rejects missing or unparsable values', () => {
    expect(formatExifDate(undefined, 'en-US', fixedNow)).toBeNull()
    expect(formatExifDate('garbage', 'en-US', fixedNow)).toBeNull()
  })
})

describe('buildExifSections', () => {
  const fullBag = {
    Make: 'Fujifilm',
    Model: 'X-T5',
    LensModel: 'XF35mmF1.4 R',
    ISO: 320,
    FNumber: 1.4,
    ExposureTime: 1 / 250,
    FocalLength: 35,
    DateTimeOriginal: Date.UTC(2023, 7, 1, 14, 30),
    latitude: 41.385063,
    longitude: 2.173404,
    Orientation: 'Horizontal (normal)',
    ColorSpace: 'sRGB',
    Software: 'Capture One'
  }

  it('groups curated tags into Camera / Date / Location / Technical', () => {
    const sections = buildExifSections(fullBag)
    expect(sections.map((section) => section.title)).toEqual([
      'Camera',
      'Date',
      'Location',
      'Technical'
    ])
    const camera = sections[0]!
    expect(camera.rows.map((row) => row.value)).toEqual([
      'Fujifilm',
      'X-T5',
      'XF35mmF1.4 R',
      '320',
      'f/1.4',
      '1/250',
      '35 mm'
    ])
    const location = sections.find((section) => section.title === 'Location')!
    expect(location.rows).toEqual([
      { label: 'Latitude', value: '41.385063' },
      { label: 'Longitude', value: '2.173404' }
    ])
  })

  it('omits whole sections whose tags are absent', () => {
    const sections = buildExifSections({ Model: 'Pixel 8' })
    expect(sections.map((section) => section.title)).toEqual(['Camera'])
  })

  it('returns nothing for empty bags or junk input', () => {
    expect(buildExifSections({})).toEqual([])
    expect(buildExifSections(null)).toEqual([])
    expect(buildExifSections(undefined)).toEqual([])
    expect(hasUsableExif({})).toBe(false)
    expect(hasUsableExif(fullBag)).toBe(true)
  })

  it('falls back to GPS-prefixed coordinate keys when computed ones are absent', () => {
    const sections = buildExifSections({ GPSLatitude: 10.5, GPSLongitude: -20.25 })
    const location = sections.find((section) => section.title === 'Location')!
    expect(location.rows.map((row) => row.value)).toEqual(['10.500000', '-20.250000'])
  })
})

describe('isSupportedExifExtension', () => {
  it('accepts the advertised formats case-insensitively', () => {
    for (const extension of ['.jpg', '.jpeg', '.tiff', '.tif', '.png']) {
      expect(isSupportedExifExtension(extension)).toBe(true)
      expect(isSupportedExifExtension(extension.toUpperCase())).toBe(true)
    }
    expect(isSupportedExifExtension('.gif')).toBe(false)
    expect(isSupportedExifExtension('.webp')).toBe(false)
  })
})
