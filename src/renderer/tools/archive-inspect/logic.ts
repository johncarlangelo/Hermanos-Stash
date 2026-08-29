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
