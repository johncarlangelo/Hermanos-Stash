import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Sharp } from 'sharp'
import { stashError } from '../../shared/errors'
import type { ImageOutputFormat, WatermarkPosition } from '../../shared/ipc'
import type { SocialPreset } from '../../shared/utils/social-presets'

/**
 * Pure-ish sharp wrappers for batch image tools. Each function takes a file
 * path in, writes a file out, and reports the written byte size so callers
 * never need a second stat pass.
 */

export const SUPPORTED_FORMATS: readonly ImageOutputFormat[] = [
  'png',
  'jpeg',
  'webp',
  'avif',
  'tiff'
]

/** Extensions sharp can encode; used to infer output format when compressing. */
const FORMAT_BY_EXTENSION: Record<string, ImageOutputFormat> = {
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.webp': 'webp',
  '.avif': 'avif',
  '.tiff': 'tiff',
  '.tif': 'tiff'
}

export function formatForExtension(extension: string): ImageOutputFormat | null {
  return FORMAT_BY_EXTENSION[extension.toLowerCase()] ?? null
}

export function clampQuality(value: number): number {
  return Math.round(Math.min(100, Math.max(1, value)))
}

function encodeAs(pipeline: Sharp, format: ImageOutputFormat, quality: number): Sharp {
  switch (format) {
    case 'png':
      return pipeline.png({ compressionLevel: 9, palette: true })
    case 'jpeg':
      return pipeline.jpeg({ quality, mozjpeg: true })
    case 'webp':
      return pipeline.webp({ quality })
    case 'avif':
      return pipeline.avif({ quality })
    case 'tiff':
      return pipeline.tiff({ quality })
  }
}

/** Shared error-mapped file writer — also used by the icon-pack processor. */
export async function writePipeline(
  pipeline: Sharp,
  outputPath: string,
  sourceName: string
): Promise<number> {
  try {
    await pipeline.toFile(outputPath)
  } catch (err) {
    const message = String((err as Error)?.message ?? err)
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || /missing|no such file/i.test(message)) {
      throw stashError('FS_READ', `"${sourceName}" could not be found or opened.`, {
        technicalMessage: message
      })
    }
    if (code === 'EACCES' || code === 'EPERM') {
      throw stashError('FS_WRITE', `"${sourceName}" could not be processed — check permissions.`, {
        technicalMessage: message
      })
    }
    throw stashError('UNSUPPORTED', `"${sourceName}" isn't a supported or uncorrupted image.`, {
      technicalMessage: message
    })
  }
  const stat = await fs.stat(outputPath)
  return stat.size
}

export async function convertImage(
  inputPath: string,
  outputPath: string,
  opts: { format: ImageOutputFormat; quality?: number }
): Promise<{ bytesWritten: number }> {
  const quality = opts.quality === undefined ? 80 : clampQuality(opts.quality)
  const pipeline = sharp(inputPath)
  // Quality only applies to lossy formats; PNG ignores it and stays lossless.
  const bytesWritten = await writePipeline(
    encodeAs(pipeline, opts.format, quality),
    outputPath,
    path.basename(inputPath)
  )
  return { bytesWritten }
}

export async function compressImage(
  inputPath: string,
  outputPath: string,
  opts: { quality: number; maxDimension?: number }
): Promise<{ bytesWritten: number }> {
  const format = formatForExtension(path.extname(outputPath))
  if (!format) {
    throw stashError(
      'UNSUPPORTED',
      `"${path.basename(inputPath)}" has an extension Stash can't compress.`,
      { technicalMessage: `ext=${path.extname(outputPath)}` }
    )
  }
  let pipeline = sharp(inputPath)
  if (opts.maxDimension !== undefined && opts.maxDimension > 0) {
    pipeline = pipeline.resize({
      width: opts.maxDimension,
      height: opts.maxDimension,
      fit: 'inside',
      withoutEnlargement: true
    })
  }
  const bytesWritten = await writePipeline(
    encodeAs(pipeline, format, clampQuality(opts.quality)),
    outputPath,
    path.basename(inputPath)
  )
  return { bytesWritten }
}

// --- Text watermarking ---------------------------------------------------------

export const WATERMARK_POSITIONS: readonly WatermarkPosition[] = [
  'bottom-right',
  'bottom-center',
  'bottom-left',
  'top-right',
  'top-center',
  'top-left',
  'center'
]

export const WATERMARK_FONT_SIZE_RANGE = { min: 12, max: 144 } as const
export const WATERMARK_OPACITY_RANGE = { min: 0.05, max: 1 } as const
export const WATERMARK_MARGIN_RATIO_RANGE = { min: 0.02, max: 0.15 } as const
export const WATERMARK_TEXT_MAX_LENGTH = 60

/** Strip control characters, collapse whitespace, cap length. */
export function normalizeWatermarkText(text: string): string {
  let stripped = ''
  for (const character of text) {
    if (character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127) continue
    stripped += character
  }
  return stripped.replace(/\s+/g, ' ').trim().slice(0, WATERMARK_TEXT_MAX_LENGTH)
}

/** Accepts #rgb and #rrggbb hex colors only — no names, no alpha. */
export function isValidWatermarkColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
}

export function clampWatermarkFontSize(value: number): number {
  return Math.round(
    Math.min(WATERMARK_FONT_SIZE_RANGE.max, Math.max(WATERMARK_FONT_SIZE_RANGE.min, value))
  )
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

interface WatermarkLayout {
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
}

/**
 * Baseline math without dominant-baseline (librsvg support varies):
 * bottom rows sit on the baseline above the margin; top rows add ~0.8em
 * ascent; the center row offsets by ~0.35em for visual middle.
 */
function watermarkLayout(
  width: number,
  height: number,
  margin: number,
  fontSize: number,
  position: WatermarkPosition
): WatermarkLayout {
  const vertical = position.startsWith('top') ? margin + fontSize * 0.8 : undefined
  const y = vertical ?? (position === 'center' ? height / 2 + fontSize * 0.35 : height - margin)
  const horizontal = position.endsWith('left')
    ? margin
    : position.endsWith('right')
      ? width - margin
      : width / 2
  const anchor = position.endsWith('left') ? 'start' : position.endsWith('right') ? 'end' : 'middle'
  return { x: horizontal, y, anchor }
}

export interface WatermarkOptions {
  text: string
  position: WatermarkPosition
  fontSize?: number
  color?: string
  opacity?: number
  marginRatio?: number
}

export async function watermarkImage(
  inputPath: string,
  outputPath: string,
  opts: WatermarkOptions
): Promise<{ bytesWritten: number }> {
  const sourceName = path.basename(inputPath)
  const metadata = await sharp(inputPath).metadata()
  const width = metadata.width
  const height = metadata.height
  if (!width || !height) {
    throw stashError('UNSUPPORTED', `"${sourceName}" isn't a supported or uncorrupted image.`, {
      technicalMessage: `no dimensions for ${sourceName}`
    })
  }

  const fontSize = opts.fontSize === undefined ? 32 : clampWatermarkFontSize(opts.fontSize)
  const color = opts.color === undefined ? '#ffffff' : opts.color.toLowerCase()
  if (!isValidWatermarkColor(color)) {
    throw stashError(
      'VALIDATION',
      'Invalid request: "color" must be a #rgb or #rrggbb hex color.',
      {
        technicalMessage: `color=${JSON.stringify(opts.color)}`
      }
    )
  }
  const opacity = opts.opacity === undefined ? 0.5 : Math.min(1, Math.max(0.05, opts.opacity))
  const marginRatio =
    opts.marginRatio === undefined ? 0.04 : Math.min(0.15, Math.max(0.02, opts.marginRatio))
  const margin = Math.round(Math.min(width, height) * marginRatio)

  const layout = watermarkLayout(width, height, margin, fontSize, opts.position)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<text x="${layout.x}" y="${layout.y}" font-family="Segoe UI, Arial, sans-serif"` +
    ` font-size="${fontSize}" fill="${color}" fill-opacity="${opacity}"` +
    ` text-anchor="${layout.anchor}">${escapeXml(opts.text)}</text></svg>`

  const bytesWritten = await writePipeline(
    sharp(inputPath).composite([{ input: Buffer.from(svg) }]),
    outputPath,
    sourceName
  )
  return { bytesWritten }
}

// --- Social preset resizing ----------------------------------------------------

export async function socialResizeImage(
  inputPath: string,
  outputPath: string,
  preset: Pick<SocialPreset, 'w' | 'h'>
): Promise<{ bytesWritten: number }> {
  const bytesWritten = await writePipeline(
    sharp(inputPath).resize({
      width: preset.w,
      height: preset.h,
      fit: 'cover',
      position: 'attention'
    }),
    outputPath,
    path.basename(inputPath)
  )
  return { bytesWritten }
}
