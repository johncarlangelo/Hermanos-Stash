/**
 * Pure helpers for the PDF → Images exporter. Renderer-local rendering keeps
 * everything testable without Electron.
 */

export type ExportImageFormat = 'png' | 'jpeg'

export const QUALITY_MIN = 60
export const QUALITY_MAX = 100
export const DEFAULT_QUALITY = 85

export const SCALE_OPTIONS = [1, 1.5, 2] as const
export type ExportScale = (typeof SCALE_OPTIONS)[number]

/** File extension used inside the output archive for each format. */
export function extensionFor(format: ExportImageFormat): string {
  return format === 'jpeg' ? '.jpg' : '.png'
}

/** Zero-padded page filename like "page-001.png" so archives sort naturally. */
export function paddedPageName(pageNumber1based: number, format: ExportImageFormat): string {
  const safeNumber = Math.max(1, Math.floor(pageNumber1based))
  const digits = String(safeNumber).padStart(3, '0')
  return `page-${digits}${extensionFor(format)}`
}

/** Clamp JPEG quality into the supported 60–100 window (integer). */
export function clampQuality(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_QUALITY
  return Math.min(QUALITY_MAX, Math.max(QUALITY_MIN, Math.round(value)))
}

/** Accept only known scale factors; anything else falls back to 1x. */
export function parseScale(value: unknown): ExportScale {
  return (SCALE_OPTIONS as readonly number[]).includes(Number(value))
    ? (Number(value) as ExportScale)
    : 1
}

/** Accept only known formats; anything else falls back to png. */
export function parseExportFormat(value: unknown): ExportImageFormat {
  return value === 'jpeg' ? 'jpeg' : 'png'
}
