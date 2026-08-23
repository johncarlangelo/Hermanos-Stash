import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type { Sharp } from 'sharp'
import { stashError } from '../../shared/errors'
import type { ImageOutputFormat } from '../../shared/ipc'

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

async function writePipeline(
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
