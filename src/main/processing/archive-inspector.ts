import { execFile } from 'node:child_process'
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

function decodeDosString(buf: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    return buf.toString('latin1')
  }
}

/**
 * Fast, resilient ZIP Central Directory binary parser.
 * Reads entry names, sizes, dates, and encryption flags for all ZIP archives
 * (ZipCrypto, WinZip AES-128/192/256, 7-Zip encrypted ZIP, Zip64).
 */
export function parseZipCentralDirectory(buffer: Buffer, filePath: string): ArchiveInspectResult {
  if (buffer.length < 22) {
    throw stashError(
      'UNSUPPORTED',
      `"${path.basename(filePath)}" is too small to be a valid ZIP archive.`
    )
  }

  // Find End of Central Directory (signature 0x06054b50)
  const maxSearch = Math.min(buffer.length - 22, 65557)
  let eocdOffset = -1
  for (let i = buffer.length - 22; i >= buffer.length - 22 - maxSearch && i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i
      break
    }
  }

  if (eocdOffset === -1) {
    throw stashError(
      'UNSUPPORTED',
      `"${path.basename(filePath)}" does not contain a valid ZIP central directory.`
    )
  }

  let cdSize = buffer.readUInt32LE(eocdOffset + 12)
  let cdOffset = buffer.readUInt32LE(eocdOffset + 16)

  // Check for Zip64 EOCD Locator (signature 0x07064b50)
  if (eocdOffset >= 20 && buffer.readUInt32LE(eocdOffset - 20) === 0x07064b50) {
    const zip64EocdOffset = Number(buffer.readBigUInt64LE(eocdOffset - 12))
    if (
      zip64EocdOffset + 56 <= buffer.length &&
      buffer.readUInt32LE(zip64EocdOffset) === 0x06064b50
    ) {
      cdSize = Number(buffer.readBigUInt64LE(zip64EocdOffset + 40))
      cdOffset = Number(buffer.readBigUInt64LE(zip64EocdOffset + 48))
    }
  }

  const entries: ArchiveEntryInfo[] = []
  let totalUncompressed = 0
  let totalCompressed = 0
  let fileCount = 0
  let directoryCount = 0
  let hasEncrypted = false

  let pos = cdOffset
  const end = Math.min(buffer.length, cdOffset + cdSize)

  while (pos + 46 <= end) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) break

    const flags = buffer.readUInt16LE(pos + 8)
    const method = buffer.readUInt16LE(pos + 10)
    const mtime = buffer.readUInt16LE(pos + 12)
    const mdate = buffer.readUInt16LE(pos + 14)
    const crc32 = buffer.readUInt32LE(pos + 16)
    let compSize = buffer.readUInt32LE(pos + 20)
    let uncompSize = buffer.readUInt32LE(pos + 24)
    const nameLen = buffer.readUInt16LE(pos + 28)
    const extraLen = buffer.readUInt16LE(pos + 30)
    const commentLen = buffer.readUInt16LE(pos + 32)

    const isUtf8 = (flags & (1 << 11)) !== 0
    const rawName = buffer.subarray(pos + 46, pos + 46 + nameLen)
    const entryPath = isUtf8 ? rawName.toString('utf8') : decodeDosString(rawName)
    const normalizedPath = entryPath.replace(/\\/g, '/')

    // Check extra field for Zip64 extended information (tag 0x0001)
    if (extraLen > 0 && pos + 46 + nameLen + extraLen <= buffer.length) {
      let extraPos = pos + 46 + nameLen
      const extraEnd = extraPos + extraLen
      while (extraPos + 4 <= extraEnd) {
        const tag = buffer.readUInt16LE(extraPos)
        const size = buffer.readUInt16LE(extraPos + 2)
        if (tag === 0x0001 && size >= 8) {
          let fieldPos = extraPos + 4
          if (uncompSize === 0xffffffff && fieldPos + 8 <= extraEnd) {
            uncompSize = Number(buffer.readBigUInt64LE(fieldPos))
            fieldPos += 8
          }
          if (compSize === 0xffffffff && fieldPos + 8 <= extraEnd) {
            compSize = Number(buffer.readBigUInt64LE(fieldPos))
          }
        }
        extraPos += 4 + size
      }
    }

    const isEncrypted = (flags & 1) !== 0 || method === 99
    if (isEncrypted) hasEncrypted = true

    const isDir = normalizedPath.endsWith('/') || (buffer.readUInt32LE(pos + 38) & 0x10) !== 0
    if (isDir) {
      directoryCount++
    } else {
      fileCount++
    }

    totalUncompressed += uncompSize
    totalCompressed += compSize

    const year = ((mdate >> 9) & 0x7f) + 1980
    const month = Math.max(0, Math.min(11, ((mdate >> 5) & 0x0f) - 1))
    const day = Math.max(1, Math.min(31, mdate & 0x1f))
    const hours = Math.min(23, (mtime >> 11) & 0x1f)
    const minutes = Math.min(59, (mtime >> 5) & 0x3f)
    const seconds = Math.min(59, (mtime & 0x1f) * 2)
    const lastModifiedMs = new Date(year, month, day, hours, minutes, seconds).getTime()

    entries.push({
      path: normalizedPath,
      name: path.basename(normalizedPath) || normalizedPath,
      isDirectory: isDir,
      uncompressedSize: uncompSize,
      compressedSize: compSize,
      lastModifiedMs: Number.isNaN(lastModifiedMs) ? undefined : lastModifiedMs,
      isEncrypted,
      crc32
    })

    pos += 46 + nameLen + extraLen + commentLen
  }

  return {
    path: filePath,
    totalEntries: entries.length,
    fileCount,
    directoryCount,
    totalUncompressedSize: totalUncompressed,
    totalCompressedSize: totalCompressed,
    isEncrypted: hasEncrypted,
    entries
  }
}

/**
 * Inspects all entries and metadata within an archive without extracting to disk.
 */
export async function inspectArchive(req: ArchiveInspectRequest): Promise<ArchiveInspectResult> {
  if (!fs.existsSync(req.path)) {
    throw stashError('FS_READ', `Archive file not found: ${req.path}`)
  }

  try {
    const buffer = await fsp.readFile(req.path)
    return parseZipCentralDirectory(buffer, req.path)
  } catch (err) {
    if (isStashError(err)) throw err

    // Fallback to unzipper Open.file
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
          rawFile.isEncrypted ||
          (rawFile.vars?.flags !== undefined && (rawFile.vars.flags & 1) !== 0)
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
    } catch {
      throw stashError(
        'UNSUPPORTED',
        `"${path.basename(req.path)}" is not a valid or readable ZIP archive.`
      )
    }
  }
}

/**
 * Extracts a single entry to a memory buffer using tar.exe (supports WinZip AES-256 and ZipCrypto)
 */
function extractEntryBufferViaTar(
  archivePath: string,
  entryPath: string,
  password?: string
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const args = ['-x', '-O', '-f', archivePath]
    if (password) {
      args.push('--passphrase', password)
    }
    args.push(entryPath)

    execFile(
      'tar.exe',
      args,
      { encoding: 'buffer', maxBuffer: MAX_PREVIEW_BYTES },
      (err, stdout, stderr) => {
        if (err) {
          const errMsg = stderr ? stderr.toString('utf8') : err.message
          if (
            errMsg.toLowerCase().includes('passphrase') ||
            errMsg.toLowerCase().includes('password') ||
            errMsg.toLowerCase().includes('bad') ||
            errMsg.toLowerCase().includes('header') ||
            errMsg.toLowerCase().includes('corrupted')
          ) {
            reject(
              stashError('VALIDATION', 'Incorrect password or unreadable encrypted entry.', {
                technicalMessage: errMsg
              })
            )
          } else {
            reject(
              stashError('FS_READ', `Could not read entry from archive: ${errMsg}`, {
                technicalMessage: errMsg
              })
            )
          }
          return
        }
        resolve(stdout)
      }
    )
  })
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

  // 1. Try unzipper first
  try {
    const directory = await unzipper.Open.file(req.archivePath)
    const file = directory.files.find((f) => f.path === req.entryPath)

    if (file) {
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

      const buffer = await file.buffer(req.password)
      return {
        bytes: new Uint8Array(buffer),
        mimeType: detectMimeType(req.entryPath),
        isTruncated: false
      }
    }
  } catch (unzipperErr) {
    if (isStashError(unzipperErr)) throw unzipperErr
    // If password error from unzipper, rethrow clean error
    const msg = String((unzipperErr as Error)?.message ?? unzipperErr)
    if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('bad password')) {
      throw stashError('VALIDATION', 'Incorrect password for encrypted entry.', {
        technicalMessage: msg
      })
    }
  }

  // 2. Try tar.exe with passphrase support (handles AES-256 and WinZip AES)
  try {
    const buffer = await extractEntryBufferViaTar(req.archivePath, req.entryPath, req.password)
    return {
      bytes: new Uint8Array(buffer),
      mimeType: detectMimeType(req.entryPath),
      isTruncated: false
    }
  } catch (tarErr) {
    if (isStashError(tarErr)) throw tarErr
  }

  // 3. Fallback: JSZip for unencrypted archives
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
    // Ignore fallback error
  }

  throw stashError('FS_READ', `Could not read entry "${req.entryPath}" from archive.`)
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

  // 1. Read bytes into memory
  const entryResult = await readArchiveEntry({
    archivePath: req.archivePath,
    entryPath: req.entryPath,
    password: req.password
  })

  // 2. Write to destination file
  await fsp.writeFile(req.targetPath, entryResult.bytes)

  return {
    bytesWritten: entryResult.bytes.byteLength,
    targetPath: req.targetPath
  }
}
