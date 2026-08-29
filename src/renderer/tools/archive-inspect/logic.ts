import type { ArchiveEntryInfo } from '../../../shared/ipc'

export type EntryCategory = 'folder' | 'image' | 'video' | 'audio' | 'text' | 'pdf' | 'binary'

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'svg',
  'ico',
  'bmp',
  'tiff',
  'tif',
  'avif'
])

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'wmv', 'm4v', 'ogv'])

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'aac', 'flac', 'opus', 'm4a', 'wma'])

const PDF_EXTENSIONS = new Set(['pdf'])

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'tsv',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'go',
  'rs',
  'rb',
  'php',
  'sh',
  'bash',
  'zsh',
  'yaml',
  'yml',
  'xml',
  'sql',
  'env',
  'log',
  'ini',
  'conf',
  'toml',
  'properties',
  'dockerfile',
  'gitignore',
  'lock'
])

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
  m4v: 'video/mp4',
  mov: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/webm',
  avi: 'video/x-msvideo',
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
  xml: 'application/xml',
  yml: 'text/yaml',
  yaml: 'text/yaml'
}

/**
 * Categorizes an archive entry based on its path and directory flag.
 */
export function categorizeEntry(filePath: string, isDirectory: boolean): EntryCategory {
  if (isDirectory || filePath.endsWith('/')) {
    return 'folder'
  }

  const base = filePath.split('/').pop()?.toLowerCase() ?? ''
  const dotIndex = base.lastIndexOf('.')
  const ext = dotIndex !== -1 ? base.slice(dotIndex + 1) : base

  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio'
  if (PDF_EXTENSIONS.has(ext)) return 'pdf'
  if (TEXT_EXTENSIONS.has(ext) || base.startsWith('.')) return 'text'

  return 'binary'
}

/**
 * Formats compression ratio savings percentage, e.g. "42% saved".
 */
export function formatCompressionRatio(uncompressedSize: number, compressedSize: number): string {
  if (uncompressedSize <= 0) return '0%'
  const savings = Math.round(((uncompressedSize - compressedSize) / uncompressedSize) * 100)
  if (savings > 0) {
    return `${savings}% saved`
  }
  if (savings === 0) {
    return '0% (uncompressed)'
  }
  return `${Math.abs(savings)}% larger`
}

/**
 * Returns the MIME type for an entry path.
 */
export function guessMimeType(filePath: string): string {
  const base = filePath.split('/').pop()?.toLowerCase() ?? ''
  const dotIndex = base.lastIndexOf('.')
  const ext = dotIndex !== -1 ? base.slice(dotIndex + 1) : ''
  return MIME_MAP[ext] || 'application/octet-stream'
}

export type ArchiveCategoryFilter = 'all' | EntryCategory

export interface FilterOptions {
  query?: string
  category?: ArchiveCategoryFilter
  sortBy?: 'name' | 'path' | 'size' | 'date'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Pure search, filter, and sorting helper for archive entries.
 */
export function filterArchiveEntries(
  entries: ArchiveEntryInfo[],
  options: FilterOptions = {}
): ArchiveEntryInfo[] {
  const { query = '', category = 'all', sortBy = 'path', sortOrder = 'asc' } = options
  const trimmed = query.trim().toLowerCase()

  const filtered = entries.filter((entry) => {
    // 1. Category filter
    if (category !== 'all') {
      const entryCat = categorizeEntry(entry.path, entry.isDirectory)
      if (entryCat !== category) return false
    }

    // 2. Search query filter
    if (trimmed) {
      const nameMatch = entry.name.toLowerCase().includes(trimmed)
      const pathMatch = entry.path.toLowerCase().includes(trimmed)
      if (!nameMatch && !pathMatch) return false
    }

    return true
  })

  // 3. Sorting
  return filtered.sort((a, b) => {
    // Directories always sort before files
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1

    let cmp = 0
    if (sortBy === 'name') {
      cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    } else if (sortBy === 'path') {
      cmp = a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' })
    } else if (sortBy === 'size') {
      cmp = (a.uncompressedSize ?? 0) - (b.uncompressedSize ?? 0)
    } else if (sortBy === 'date') {
      cmp = (a.lastModifiedMs ?? 0) - (b.lastModifiedMs ?? 0)
    }

    return sortOrder === 'asc' ? cmp : -cmp
  })
}

export interface ArchiveFolderItem {
  name: string
  fullPath: string
  isDirectory: boolean
  entry?: ArchiveEntryInfo
  itemCount?: number
  size?: number
  isEncrypted?: boolean
}

export interface ArchiveFolderViewData {
  currentPath: string
  breadcrumbs: Array<{ label: string; path: string }>
  items: ArchiveFolderItem[]
}

/**
 * Groups archive entries into a structured current-directory folder hierarchy view.
 */
export function getFolderViewData(
  entries: ArchiveEntryInfo[],
  currentDir: string
): ArchiveFolderViewData {
  const normalizedDir = currentDir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const prefix = normalizedDir ? `${normalizedDir}/` : ''

  // Build breadcrumbs
  const breadcrumbs: Array<{ label: string; path: string }> = [{ label: 'Root', path: '' }]
  if (normalizedDir) {
    const parts = normalizedDir.split('/')
    let accum = ''
    for (const part of parts) {
      accum = accum ? `${accum}/${part}` : part
      breadcrumbs.push({ label: part, path: accum })
    }
  }

  const folderMap = new Map<
    string,
    { fullPath: string; count: number; size: number; isEncrypted: boolean }
  >()
  const directFiles: ArchiveFolderItem[] = []

  for (const entry of entries) {
    const cleanPath = entry.path.replace(/\\/g, '/').replace(/^\/+/, '')

    if (prefix) {
      if (!cleanPath.startsWith(prefix) || cleanPath === prefix) continue
    }

    const relPath = prefix ? cleanPath.slice(prefix.length) : cleanPath
    const segments = relPath.split('/').filter(Boolean)

    if (segments.length === 0) continue

    if (segments.length === 1 && !entry.isDirectory && !relPath.endsWith('/')) {
      // Direct child file in this folder
      directFiles.push({
        name: segments[0],
        fullPath: entry.path,
        isDirectory: false,
        entry,
        size: entry.uncompressedSize,
        isEncrypted: entry.isEncrypted
      })
    } else {
      // It's a subfolder or file inside a deeper subfolder
      const folderName = segments[0]
      const folderFullPath = prefix ? `${prefix}${folderName}` : folderName
      const existing = folderMap.get(folderName)

      if (existing) {
        if (!entry.isDirectory) {
          existing.count++
          existing.size += entry.uncompressedSize || 0
        }
        if (entry.isEncrypted) existing.isEncrypted = true
      } else {
        folderMap.set(folderName, {
          fullPath: folderFullPath,
          count: entry.isDirectory ? 0 : 1,
          size: entry.isDirectory ? 0 : entry.uncompressedSize || 0,
          isEncrypted: Boolean(entry.isEncrypted)
        })
      }
    }
  }

  const folderItems: ArchiveFolderItem[] = Array.from(folderMap.entries()).map(([name, data]) => ({
    name,
    fullPath: data.fullPath,
    isDirectory: true,
    itemCount: data.count,
    size: data.size,
    isEncrypted: data.isEncrypted
  }))

  folderItems.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  )
  directFiles.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  )

  return {
    currentPath: normalizedDir,
    breadcrumbs,
    items: [...folderItems, ...directFiles]
  }
}
