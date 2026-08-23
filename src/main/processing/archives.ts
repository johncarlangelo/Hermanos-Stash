import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { isStashError, stashError } from '../../shared/errors'

/**
 * ZIP creation/extraction over JSZip. Extraction is hardened against
 * zip-slip: entries escaping the output directory are skipped, not followed.
 */

/** Total uncompressed input accepted for one archive (MVP guard). */
export const ZIP_INPUT_LIMIT_BYTES = 512 * 1024 * 1024

export function zipEntryName(basename: string, usedNames: Set<string>): string {
  const dot = basename.lastIndexOf('.')
  const stem = dot <= 0 ? basename : basename.slice(0, dot)
  const extension = dot <= 0 ? '' : basename.slice(dot)
  let candidate = basename
  let counter = 1
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${stem}-${counter}${extension}`
    counter += 1
  }
  usedNames.add(candidate.toLowerCase())
  return candidate
}

export async function createZipArchive(
  paths: string[],
  targetZip: string
): Promise<{ bytesWritten: number; fileCount: number }> {
  const zip = new JSZip()
  const usedNames = new Set<string>()
  let totalBytes = 0
  try {
    for (const filePath of paths) {
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) {
        throw stashError('VALIDATION', `"${path.basename(filePath)}" is not a regular file.`)
      }
      totalBytes += stat.size
      if (totalBytes > ZIP_INPUT_LIMIT_BYTES) {
        throw stashError(
          'VALIDATION',
          'The selected files are too large to pack into one archive (limit is 512 MB total).',
          { technicalMessage: `totalBytes=${totalBytes}` }
        )
      }
      const entryName = zipEntryName(path.basename(filePath), usedNames)
      zip.file(entryName, await fs.readFile(filePath))
    }
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
    await fs.writeFile(targetZip, buffer)
    return { bytesWritten: buffer.byteLength, fileCount: paths.length }
  } catch (err) {
    if (isStashError(err)) throw err
    throw stashError('FS_WRITE', `Could not create "${path.basename(targetZip)}".`, {
      technicalMessage: String((err as Error)?.message ?? err)
    })
  }
}

/**
 * Reject entries that would escape `outputDir` when joined (zip-slip):
 * absolute paths, drive letters, and any '..' segment.
 */
export function isUnsafeEntryName(name: string): boolean {
  if (name.startsWith('/') || name.startsWith('\\')) return true
  if (/^[a-zA-Z]:[\\/]/.test(name)) return true
  return name.split(/[\\/]/).includes('..')
}

export async function extractZipArchive(
  zipPath: string,
  outputDir: string
): Promise<{ extractedCount: number; skipped: string[]; topLevelCount: number }> {
  let raw: Buffer
  try {
    raw = await fs.readFile(zipPath)
  } catch (err) {
    throw stashError('FS_READ', `"${path.basename(zipPath)}" could not be opened.`, {
      technicalMessage: String((err as Error)?.message ?? err)
    })
  }

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(raw)
  } catch {
    throw stashError('UNSUPPORTED', `"${path.basename(zipPath)}" isn't a valid ZIP archive.`)
  }

  await fs.mkdir(outputDir, { recursive: true })
  const resolvedRoot = path.resolve(outputDir) + path.sep
  const skipped: string[] = []
  const topLevel = new Set<string>()
  let extractedCount = 0

  const entries = Object.values(zip.files).filter((entry) => !entry.dir)
  for (const entry of entries) {
    if (isUnsafeEntryName(entry.name)) {
      skipped.push(entry.name)
      continue
    }
    const segments = entry.name.split('/')
    topLevel.add(segments[0] ?? '')
    const dest = path.resolve(outputDir, ...segments)
    // Defense in depth alongside isUnsafeEntryName.
    if (dest !== resolvedRoot.slice(0, -1) && !dest.startsWith(resolvedRoot)) {
      skipped.push(entry.name)
      continue
    }
    const bytes = Buffer.from(await entry.async('arraybuffer'))
    await fs.mkdir(path.dirname(dest), { recursive: true })
    await fs.writeFile(dest, bytes)
    extractedCount += 1
  }
  return { extractedCount, skipped, topLevelCount: topLevel.size }
}
