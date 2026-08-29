import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { isStashError, stashError } from '../../shared/errors'

/**
 * ZIP creation/extraction over JSZip and tar.exe. Extraction is hardened against
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

/**
 * Checks if a zip buffer contains encrypted entries by scanning central directory flags.
 */
function isZipBufferEncrypted(buffer: Buffer): boolean {
  if (buffer.length < 22) return false
  const maxSearch = Math.min(buffer.length - 22, 65557)
  let eocdOffset = -1
  for (let i = buffer.length - 22; i >= buffer.length - 22 - maxSearch && i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset === -1) return false

  const cdSize = buffer.readUInt32LE(eocdOffset + 12)
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16)
  let pos = cdOffset
  const end = Math.min(buffer.length, cdOffset + cdSize)

  while (pos + 46 <= end) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) break
    const flags = buffer.readUInt16LE(pos + 8)
    const method = buffer.readUInt16LE(pos + 10)
    if ((flags & 1) !== 0 || method === 99) return true

    const nameLen = buffer.readUInt16LE(pos + 28)
    const extraLen = buffer.readUInt16LE(pos + 30)
    const commentLen = buffer.readUInt16LE(pos + 32)
    pos += 46 + nameLen + extraLen + commentLen
  }
  return false
}

async function countExtractedFiles(dir: string): Promise<{ total: number; topLevel: number }> {
  const topLevel = await fs.readdir(dir)
  let total = 0
  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(path.join(current, entry.name))
      } else {
        total++
      }
    }
  }
  await walk(dir)
  return { total, topLevel: topLevel.length }
}

export async function extractZipArchive(
  zipPath: string,
  outputDir: string,
  password?: string
): Promise<{ extractedCount: number; skipped: string[]; topLevelCount: number }> {
  let raw: Buffer
  try {
    raw = await fs.readFile(zipPath)
  } catch (err) {
    throw stashError('FS_READ', `"${path.basename(zipPath)}" could not be opened.`, {
      technicalMessage: String((err as Error)?.message ?? err)
    })
  }

  const isEncrypted = isZipBufferEncrypted(raw)
  if (isEncrypted && !password) {
    throw stashError(
      'VALIDATION',
      `"${path.basename(zipPath)}" is password-protected. Please enter a password to extract.`
    )
  }

  await fs.mkdir(outputDir, { recursive: true })

  // If password provided or encrypted, extract with tar.exe
  if (isEncrypted || password) {
    try {
      await new Promise<void>((resolve, reject) => {
        const args = ['-x', '-f', zipPath, '-C', outputDir]
        if (password) args.push('--passphrase', password)

        execFile('tar.exe', args, (err, _stdout, stderr) => {
          if (err) {
            const errMsg = String(stderr || err.message)
            if (
              errMsg.toLowerCase().includes('passphrase') ||
              errMsg.toLowerCase().includes('password') ||
              errMsg.toLowerCase().includes('bad') ||
              errMsg.toLowerCase().includes('header')
            ) {
              reject(
                stashError('VALIDATION', 'Incorrect password for archive.', {
                  technicalMessage: errMsg
                })
              )
            } else {
              reject(
                stashError('FS_READ', `Could not extract archive: ${errMsg}`, {
                  technicalMessage: errMsg
                })
              )
            }
            return
          }
          resolve()
        })
      })

      // Count extracted items
      const countStats = await countExtractedFiles(outputDir)
      return {
        extractedCount: countStats.total,
        skipped: [],
        topLevelCount: countStats.topLevel
      }
    } catch (err) {
      if (isStashError(err)) throw err
    }
  }

  // Standard unencrypted extraction with JSZip
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(raw)
  } catch {
    throw stashError('UNSUPPORTED', `"${path.basename(zipPath)}" isn't a valid ZIP archive.`)
  }

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
