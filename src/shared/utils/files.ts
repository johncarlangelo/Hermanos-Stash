const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.ts': 'text/plain',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar'
}

/** Best-effort MIME type from a file extension. Returns null when unknown. */
export function guessMimeType(filename: string): string | null {
  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return null
  return MIME_BY_EXTENSION[filename.slice(dot).toLowerCase()] ?? null
}

export function extensionOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename
  const dot = base.lastIndexOf('.')
  if (dot <= 0) return ''
  return base.slice(dot).toLowerCase()
}

export function formatBytes(bytes: number, options?: { precision?: number }): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  let value = bytes
  let unit = units[0]
  for (const u of units) {
    unit = u
    if (value < 1024) break
    value /= 1024
  }
  const precision = options?.precision ?? (value >= 100 ? 0 : value >= 10 ? 1 : 2)
  return `${value.toFixed(precision)} ${unit}`
}
