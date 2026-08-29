import { toolRegistry } from '../tool-registry/registry'

/**
 * Extension → preferred tool ids for window-level drop routing
 * (DropRouter). Hints are curated; anything unregistered is filtered out
 * at lookup time so the catalog stays the single source of truth.
 */
export const EXTENSION_TOOL_HINTS: Record<string, string[]> = {
  pdf: [
    'pdf-preview',
    'pdf-merge',
    'pdf-split',
    'pdf-rotate',
    'pdf-reorder',
    'pdf-compress',
    'pdf-to-images',
    'pdf-to-text'
  ],
  png: [
    'image-preview',
    'image-ocr',
    'qr-decoder',
    'image-convert',
    'image-compress',
    'image-exif',
    'image-watermark',
    'social-resizer',
    'icon-pack',
    'images-to-pdf'
  ],
  jpg: [
    'image-preview',
    'image-ocr',
    'qr-decoder',
    'image-convert',
    'image-compress',
    'image-exif',
    'image-watermark',
    'social-resizer',
    'images-to-pdf'
  ],
  jpeg: [
    'image-preview',
    'image-ocr',
    'qr-decoder',
    'image-convert',
    'image-compress',
    'image-exif',
    'image-watermark',
    'social-resizer',
    'images-to-pdf'
  ],
  webp: [
    'image-preview',
    'image-ocr',
    'qr-decoder',
    'image-convert',
    'image-compress',
    'image-watermark',
    'social-resizer'
  ],
  gif: ['image-preview', 'image-ocr', 'image-convert', 'image-watermark', 'social-resizer'],
  bmp: ['image-preview', 'image-ocr', 'qr-decoder', 'image-convert'],
  avif: ['image-preview', 'image-convert', 'social-resizer'],
  tiff: ['image-preview', 'image-ocr', 'image-convert', 'image-exif', 'social-resizer'],
  tif: ['image-preview', 'image-ocr', 'image-convert', 'image-exif'],
  svg: ['image-preview', 'icon-pack'],
  mp4: ['video-convert', 'video-compress', 'video-to-gif', 'extract-audio'],
  mov: ['video-convert', 'video-compress', 'video-to-gif', 'extract-audio'],
  mkv: ['video-convert', 'video-compress', 'video-to-gif', 'extract-audio'],
  avi: ['video-convert', 'video-compress', 'video-to-gif', 'extract-audio'],
  webm: ['video-convert', 'video-compress', 'video-to-gif', 'extract-audio'],
  mp3: ['audio-convert', 'extract-audio'],
  wav: ['audio-convert', 'extract-audio'],
  flac: ['audio-convert', 'extract-audio'],
  m4a: ['audio-convert', 'extract-audio'],
  ogg: ['audio-convert'],
  opus: ['audio-convert'],
  aac: ['audio-convert', 'extract-audio'],
  zip: ['archive-inspect', 'zip-extract', 'zip-create']
}

export function extensionOfPath(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() ?? filePath
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Registered tool ids that can handle this extension, in preference order. */
export function toolsForExtension(ext: string): string[] {
  const needle = ext.trim().toLowerCase().replace(/^\./, '')
  if (!needle) return []
  return (EXTENSION_TOOL_HINTS[needle] ?? []).filter((id) => toolRegistry.get(id) !== undefined)
}
