import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import unzipper from 'unzipper'
import JSZip from 'jszip'
import { isStashError, stashError } from '../../shared/errors'
import type {
  ArchiveEntryInfo,
  ArchiveExtractEntryRequest,
  ArchiveExtractEntryResult,
  ArchiveInspectRequest,
  ArchiveInspectResult,
  ArchiveReadEntryRequest,
  ArchiveReadEntryResult
} from '../../shared/ipc'
import { isUnsafeEntryName } from './archives'

const MAX_PREVIEW_BYTES = 64 * 1024 * 1024 // 64 MB preview buffer limit

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  pdf: 'application/pdf',
  json: 'application/json',
  csv: 'text/csv',
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  ts: 'text/plain',
  tsx: 'text/plain',
  jsx: 'text/plain',
  xml: 'application/xml',
  yml: 'text/yaml',
  yaml: 'text/yaml',
  log: 'text/plain',
  ini: 'text/plain',
  env: 'text/plain'
}

export function detectMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return MIME_MAP[ext] || 'application/octet-stream'
}

/**
 * Inspects all entries and metadata within an archive without extracting to disk.
 */
export async function inspectArchive(req: ArchiveInspectRequest): Promise<ArchiveInspectResult> {
  if (!fs.existsSync(req.path)) {
    throw stashError('FS_READ', `Archive file not found: ${req.path}`)
  }

  try {
    const directory = await unzipper.Open.file(req.path)
    const entries: ArchiveEntryInfo[] = []
    let totalUncompressed = 0
    let totalCompressed = 0
    let fileCount = 0
    let directoryCount = 0
    let hasEncrypted = false

    for (const file of directory.files) {
      const isDir = file.type === 'Directory' || file.path.endsWith('/')
      if (isDir) {
        directoryCount++
      } else {
        fileCount++
      }

      const uncompressed = file.uncompressedSize ?? 0
      const compressed = file.compressedSize ?? 0
      totalUncompressed += uncompressed
      totalCompressed += compressed

      const rawFile = file as unknown as { isEncrypted?: boolean; vars?: { flags?: number } }
      const isEncrypted = Boolean(
        rawFile.isEncrypted || (rawFile.vars?.flags !== undefined && (rawFile.vars.flags & 1) !== 0)
      )
      if (isEncrypted) {
        hasEncrypted = true
      }

      let lastModifiedMs: number | undefined
      if (file.lastModifiedDateTime) {
        lastModifiedMs = new Date(file.lastModifiedDateTime).getTime()
      }

      entries.push({
        path: file.path,
        name: path.basename(file.path) || file.path,
        isDirectory: isDir,
        uncompressedSize: uncompressed,
        compressedSize: compressed,
        lastModifiedMs,
        isEncrypted,
        crc32: file.crc32
      })
    }

    return {
      path: req.path,
      totalEntries: entries.length,
      fileCount,
      directoryCount,
      totalUncompressedSize: totalUncompressed,
      totalCompressedSize: totalCompressed,
      isEncrypted: hasEncrypted,
      entries
    }
  } catch (unzipperErr) {
    // Fallback to JSZip for non-encrypted or alternative ZIP structures
    try {
      const buffer = await fsp.readFile(req.path)
      const zip = await JSZip.loadAsync(buffer)
      const entries: ArchiveEntryInfo[] = []
      let totalUncompressed = 0
      let totalCompressed = 0
      let fileCount = 0
      let directoryCount = 0

      for (const [relativePath, entry] of Object.entries(zip.files)) {
        const isDir = entry.dir || relativePath.endsWith('/')
        if (isDir) {
          directoryCount++
        } else {
          fileCount++
        }

        const rawData = (
          entry as unknown as { _data?: { uncompressedSize?: number; compressedSize?: number } }
        )._data
        const uncompressed = rawData?.uncompressedSize ?? 0
        const compressed = rawData?.compressedSize ?? 0
        totalUncompressed += uncompressed
        totalCompressed += compressed

        entries.push({
          path: relativePath,
          name: path.basename(relativePath) || relativePath,
          isDirectory: isDir,
          uncompressedSize: uncompressed,
          compressedSize: compressed,
          lastModifiedMs: entry.date ? new Date(entry.date).getTime() : undefined,
          isEncrypted: false
        })
      }

      return {
        path: req.path,
        totalEntries: entries.length,
        fileCount,
        directoryCount,
        totalUncompressedSize: totalUncompressed,
        totalCompressedSize: totalCompressed,
        isEncrypted: false,
        entries
      }
    } catch {
      throw stashError(
        'UNSUPPORTED',
        `"${path.basename(req.path)}" is not a valid or readable ZIP archive.`,
        { technicalMessage: String((unzipperErr as Error)?.message ?? unzipperErr) }
      )
    }
  }
}

/**
 * Reads a single entry from the archive directly into memory for live preview.
 */
export async function readArchiveEntry(
  req: ArchiveReadEntryRequest
): Promise<ArchiveReadEntryResult> {
  if (!fs.existsSync(req.archivePath)) {
    throw stashError('FS_READ', `Archive not found: ${req.archivePath}`)
  }

  if (isUnsafeEntryName(req.entryPath)) {
    throw stashError('VALIDATION', `Unsafe entry path: ${req.entryPath}`)
  }

  try {
    const directory = await unzipper.Open.file(req.archivePath)
    const file = directory.files.find((f) => f.path === req.entryPath)

    if (!file) {
      throw stashError('FS_READ', `Entry "${req.entryPath}" not found in archive.`)
    }

    if (file.type === 'Directory' || file.path.endsWith('/')) {
      throw stashError('VALIDATION', `Cannot preview a directory entry.`)
    }

    const maxBytes = req.maxBytes || MAX_PREVIEW_BYTES
    if (file.uncompressedSize && file.uncompressedSize > maxBytes) {
      throw stashError(
        'VALIDATION',
        `File is too large for live preview (${Math.round(file.uncompressedSize / 1024 / 1024)} MB). Use "Extract File" to view it.`
      )
    }

    let buffer: Buffer
    try {
      buffer = await file.buffer(req.password)
    } catch (decryptErr) {
      const msg = String((decryptErr as Error)?.message ?? decryptErr)
      if (
        msg.toLowerCase().includes('password') ||
        msg.toLowerCase().includes('bad password') ||
        msg.toLowerCase().includes('crc') ||
        msg.toLowerCase().includes('encrypted')
      ) {
        throw stashError('VALIDATION', 'Incorrect password or corrupted encrypted entry.', {
          technicalMessage: msg
        })
      }
      throw decryptErr
    }

    return {
      bytes: new Uint8Array(buffer),
      mimeType: detectMimeType(req.entryPath),
      isTruncated: false
    }
  } catch (err) {
    if (isStashError(err)) throw err
    // Fallback: try JSZip if unzipper had an issue on unencrypted archive
    try {
      const raw = await fsp.readFile(req.archivePath)
      const zip = await JSZip.loadAsync(raw)
      const zipEntry = zip.file(req.entryPath)
      if (zipEntry) {
        const buffer = await zipEntry.async('nodebuffer')
        return {
          bytes: new Uint8Array(buffer),
          mimeType: detectMimeType(req.entryPath),
          isTruncated: false
        }
      }
    } catch {
      // Ignore fallback error and rethrow original
    }

    throw stashError('FS_READ', `Could not read entry "${req.entryPath}" from archive.`, {
      technicalMessage: String((err as Error)?.message ?? err)
    })
  }
}

/**
 * Extracts a single entry from the archive directly to a designated target file path.
 */
export async function extractArchiveEntry(
  req: ArchiveExtractEntryRequest
): Promise<ArchiveExtractEntryResult> {
  if (!fs.existsSync(req.archivePath)) {
    throw stashError('FS_READ', `Archive not found: ${req.archivePath}`)
  }

  if (isUnsafeEntryName(req.entryPath)) {
    throw stashError('VALIDATION', `Unsafe entry path: ${req.entryPath}`)
  }

  const targetDir = path.dirname(req.targetPath)
  await fsp.mkdir(targetDir, { recursive: true })

  try {
    const directory = await unzipper.Open.file(req.archivePath)
    const file = directory.files.find((f) => f.path === req.entryPath)

    if (!file) {
      throw stashError('FS_READ', `Entry "${req.entryPath}" not found in archive.`)
    }

    if (file.type === 'Directory' || file.path.endsWith('/')) {
      throw stashError('VALIDATION', `Cannot extract a directory as a file.`)
    }

    let buffer: Buffer
    try {
      buffer = await file.buffer(req.password)
    } catch (decryptErr) {
      const msg = String((decryptErr as Error)?.message ?? decryptErr)
      if (
        msg.toLowerCase().includes('password') ||
        msg.toLowerCase().includes('bad password') ||
        msg.toLowerCase().includes('crc')
      ) {
        throw stashError('VALIDATION', 'Incorrect password for encrypted entry.', {
          technicalMessage: msg
        })
      }
      throw decryptErr
    }

    await fsp.writeFile(req.targetPath, buffer)

    return {
      bytesWritten: buffer.byteLength,
      targetPath: req.targetPath
    }
  } catch (err) {
    if (isStashError(err)) throw err
    // Fallback: try JSZip
    try {
      const raw = await fsp.readFile(req.archivePath)
      const zip = await JSZip.loadAsync(raw)
      const zipEntry = zip.file(req.entryPath)
      if (zipEntry) {
        const buffer = await zipEntry.async('nodebuffer')
        await fsp.writeFile(req.targetPath, buffer)
        return {
          bytesWritten: buffer.byteLength,
          targetPath: req.targetPath
        }
      }
    } catch {
      // Ignore fallback
    }

    throw stashError('FS_WRITE', `Could not extract entry to "${path.basename(req.targetPath)}".`, {
      technicalMessage: String((err as Error)?.message ?? err)
    })
  }
}
