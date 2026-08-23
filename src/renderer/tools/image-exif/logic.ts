/**
 * Pure display logic for the EXIF viewer — grouping, curation and value
 * formatting live here so they can be tested without Electron or exifr.
 */

/** Raw tag bag as produced by `exifr.parse(bytes, {…})`. */
export type ExifTagBag = Record<string, unknown>

export interface ExifRow {
  label: string
  value: string
}

export interface ExifSection {
  title: string
  rows: ExifRow[]
}

const EXIF_FILE_EXTENSIONS = ['.jpg', '.jpeg', '.tiff', '.tif', '.png'] as const

/** PNG rarely carries EXIF, but it is technically possible — accept it. */
export function isSupportedExifExtension(extension: string): boolean {
  return (EXIF_FILE_EXTENSIONS as readonly string[]).includes(extension.toLowerCase())
}

function trimZeros(value: number): string {
  return String(Number(value.toFixed(4))).replace(/\.0+$/, '')
}

function round4(value: number): string {
  return String(Math.round(value * 10000) / 10000)
}

/** Exposure like 1/250 rendered as an exact fraction where plausible. */
export function formatExposure(seconds: unknown): string | null {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return null
  if (value < 1) {
    const denominator = Math.round(1 / value)
    // Only claim a clean fraction when it really rounds back cleanly.
    if (denominator > 1 && Math.abs(1 / denominator - value) / value < 0.02) {
      return `1/${denominator}`
    }
    return `${round4(value)} s`
  }
  return `${trimZeros(value)} s`
}

export function formatFNumber(value: unknown): string | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return `f/${trimZeros(parsed)}`
}

/** Decimal degrees at six places — enough precision for street level. */
export function formatGpsCoordinate(value: unknown): string | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed.toFixed(6)
}

/** EXIF timestamps arrive as epoch-ms numbers (exifr revives values). */
export function formatExifDate(
  value: unknown,
  locale = 'en-US',
  nowMs = Date.now()
): string | null {
  const ms =
    typeof value === 'number'
      ? value
      : value instanceof Date
        ? value.getTime()
        : typeof value === 'string'
          ? Date.parse(value)
          : Number.NaN
  if (!Number.isFinite(ms)) return null
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return null
  const includeYear = Math.abs(nowMs - ms) > 330 * 24 * 60 * 60 * 1000
  return new Intl.DateTimeFormat(locale, {
    ...(includeYear ? { year: 'numeric' } : {}),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function firstNumber(bag: ExifTagBag, keys: string[]): unknown {
  for (const key of keys) {
    if (bag[key] !== undefined && Number.isFinite(Number(bag[key]))) return bag[key]
  }
  return undefined
}

function firstString(bag: ExifTagBag, keys: string[]): string | null {
  for (const key of keys) {
    const value = bag[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

/**
 * Curated sections (~15 of the most useful tags). A section whose every tag
 * is missing is omitted entirely; a fully empty result means no usable EXIF.
 */
export function buildExifSections(bag: ExifTagBag | null | undefined): ExifSection[] {
  if (!bag || typeof bag !== 'object') return []
  const sections: ExifSection[] = []

  const cameraRows: ExifRow[] = []
  const make = firstString(bag, ['Make'])
  if (make) cameraRows.push({ label: 'Maker', value: make })
  const model = firstString(bag, ['Model'])
  if (model) cameraRows.push({ label: 'Model', value: model })
  const lens = firstString(bag, ['LensModel'])
  if (lens) cameraRows.push({ label: 'Lens', value: lens })
  const iso = firstNumber(bag, ['ISO', 'ISOSpeedRatings'])
  if (iso !== undefined) {
    cameraRows.push({ label: 'ISO', value: String(Math.round(Number(iso))) })
  }
  const fNumber = formatFNumber(firstNumber(bag, ['FNumber', 'fNumber']))
  if (fNumber) cameraRows.push({ label: 'Aperture', value: fNumber })
  const exposure = formatExposure(firstNumber(bag, ['ExposureTime']))
  if (exposure) cameraRows.push({ label: 'Shutter', value: exposure })
  const focal = firstNumber(bag, ['FocalLength'])
  if (focal !== undefined) {
    cameraRows.push({ label: 'Focal length', value: `${trimZeros(Number(focal))} mm` })
  }
  if (cameraRows.length > 0) sections.push({ title: 'Camera', rows: cameraRows })

  const capturedAt = formatExifDate(bag['DateTimeOriginal'] ?? bag['CreateDate'])
  if (capturedAt) {
    sections.push({ title: 'Date', rows: [{ label: 'Captured', value: capturedAt }] })
  }

  const locationRows: ExifRow[] = []
  const lat = formatGpsCoordinate(firstNumber(bag, ['latitude', 'GPSLatitude']))
  const lng = formatGpsCoordinate(firstNumber(bag, ['longitude', 'GPSLongitude']))
  if (lat) locationRows.push({ label: 'Latitude', value: lat })
  if (lng) locationRows.push({ label: 'Longitude', value: lng })
  if (locationRows.length > 0) sections.push({ title: 'Location', rows: locationRows })

  const technicalRows: ExifRow[] = []
  const orientation = firstString(bag, ['Orientation'])
  if (orientation) technicalRows.push({ label: 'Orientation', value: orientation })
  const colorSpace = firstString(bag, ['ColorSpace'])
  if (colorSpace) technicalRows.push({ label: 'Color space', value: colorSpace })
  const software = firstString(bag, ['Software'])
  if (software) technicalRows.push({ label: 'Software', value: software })
  if (technicalRows.length > 0) sections.push({ title: 'Technical', rows: technicalRows })

  return sections
}

/** True when at least one curated tag was present in any section. */
export function hasUsableExif(bag: ExifTagBag | null | undefined): boolean {
  return buildExifSections(bag).length > 0
}
