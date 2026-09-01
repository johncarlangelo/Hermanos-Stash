/**
 * Folder space analyzer, category breakdown, and large file inspector logic
 */

export type FileCategory =
  'Images' | 'Videos' | 'Documents' | 'Audio' | 'Code & Data' | 'Archives' | 'Other'

export interface AnalyzedFileItem {
  id: string
  name: string
  path: string
  size: number
  category: FileCategory
  extension: string
}

export interface CategorySummary {
  category: FileCategory
  color: string
  sizeBytes: number
  fileCount: number
  percentage: number
}

export interface FolderAnalysisResult {
  totalBytes: number
  totalFiles: number
  categoryBreakdown: CategorySummary[]
  largestFiles: AnalyzedFileItem[]
}

const CATEGORY_EXTENSIONS: Record<Exclude<FileCategory, 'Other'>, string[]> = {
  Images: ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg', 'bmp', 'ico', 'tiff'],
  Videos: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'wmv'],
  Documents: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'rtf', 'odt', 'csv'],
  Audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'],
  'Code & Data': [
    'js',
    'ts',
    'tsx',
    'jsx',
    'json',
    'yaml',
    'yml',
    'xml',
    'html',
    'css',
    'py',
    'go',
    'rs',
    'sql',
    'sh'
  ],
  Archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz']
}

const CATEGORY_COLORS: Record<FileCategory, string> = {
  Images: '#f59e0b',
  Videos: '#ec4899',
  Documents: '#3b82f6',
  Audio: '#8b5cf6',
  'Code & Data': '#10b981',
  Archives: '#06b6d4',
  Other: '#71717a'
}

/**
 * Classify file into category based on extension
 */
export function getFileCategory(filename: string): { category: FileCategory; ext: string } {
  const parts = filename.split('.')
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''

  for (const [cat, extensions] of Object.entries(CATEGORY_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return { category: cat as FileCategory, ext }
    }
  }

  return { category: 'Other', ext: ext || 'none' }
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * Analyze a flat list of dropped files
 */
export function analyzeFileList(
  files: Array<{ name: string; size: number; path?: string }>
): FolderAnalysisResult {
  if (files.length === 0) {
    return {
      totalBytes: 0,
      totalFiles: 0,
      categoryBreakdown: [],
      largestFiles: []
    }
  }

  let totalBytes = 0
  const catMap: Record<FileCategory, { size: number; count: number }> = {
    Images: { size: 0, count: 0 },
    Videos: { size: 0, count: 0 },
    Documents: { size: 0, count: 0 },
    Audio: { size: 0, count: 0 },
    'Code & Data': { size: 0, count: 0 },
    Archives: { size: 0, count: 0 },
    Other: { size: 0, count: 0 }
  }

  const items: AnalyzedFileItem[] = []

  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const { category, ext } = getFileCategory(f.name)
    totalBytes += f.size
    catMap[category].size += f.size
    catMap[category].count++

    items.push({
      id: `file-${i}`,
      name: f.name,
      path: f.path || f.name,
      size: f.size,
      category,
      extension: ext
    })
  }

  const categoryBreakdown: CategorySummary[] = Object.entries(catMap)
    .filter(([_, data]) => data.count > 0)
    .map(([cat, data]) => ({
      category: cat as FileCategory,
      color: CATEGORY_COLORS[cat as FileCategory],
      sizeBytes: data.size,
      fileCount: data.count,
      percentage: totalBytes > 0 ? Number(((data.size / totalBytes) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.sizeBytes - a.sizeBytes)

  const largestFiles = [...items].sort((a, b) => b.size - a.size).slice(0, 10)

  return {
    totalBytes,
    totalFiles: files.length,
    categoryBreakdown,
    largestFiles
  }
}
