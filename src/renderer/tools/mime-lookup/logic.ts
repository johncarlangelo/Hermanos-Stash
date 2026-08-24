/**
 * Curated extension ↔ MIME reference (~60 common types). Kept separate
 * from shared/utils/files.ts, whose private map serves runtime guessing;
 * this one is a searchable reference with reverse lookup.
 */

export const MIME_BY_EXTENSION: Record<string, string> = {
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.rtf': 'application/rtf',
  '.epub': 'application/epub+zip',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.ics': 'text/calendar',
  '.vcf': 'text/vcard',
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  // Video
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mpeg': 'video/mpeg',
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  // Web & data
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.wasm': 'application/wasm',
  // Archives & binaries
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
  '.7z': 'application/x-7z-compressed',
  '.rar': 'application/vnd.rar',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.dmg': 'application/x-apple-diskimage',
  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
}

export interface MimeRow {
  ext: string
  mime: string
}

/** Normalize "PNG", ".png" and "png" to the canonical ".png" form. */
export function normalizeExtension(ext: string): string {
  const trimmed = ext.trim().toLowerCase()
  if (!trimmed) return ''
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
}

/** Look up the MIME type for an extension (with or without the leading dot). */
export function lookupByExtension(ext: string): string | null {
  const key = normalizeExtension(ext)
  return key ? (MIME_BY_EXTENSION[key] ?? null) : null
}

/** All extensions known to produce this MIME type (most canonical last). */
export function reverseLookup(mime: string): string[] {
  const needle = mime.trim().toLowerCase()
  if (!needle) return []
  return Object.entries(MIME_BY_EXTENSION)
    .filter(([, value]) => value.toLowerCase() === needle)
    .map(([ext]) => ext)
}

/** Filter the whole table by a case-insensitive ext or MIME substring. */
export function searchMimeTypes(query: string): MimeRow[] {
  const q = query.trim().toLowerCase()
  const rows = Object.entries(MIME_BY_EXTENSION).map(([ext, mime]) => ({ ext, mime }))
  if (!q) return rows
  return rows.filter(({ ext, mime }) => ext.includes(q) || mime.includes(q))
}
