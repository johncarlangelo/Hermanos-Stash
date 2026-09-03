import type { AssetRecord } from '../../../shared/ipc'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../../shared/types/tool'

export type GalleryFilterTab =
  'all' | 'image' | 'document' | 'media' | 'code' | 'archive' | 'favorites'

export type GallerySortOption = 'accessed' | 'added' | 'name' | 'size'

export const GALLERY_TABS: Array<{ id: GalleryFilterTab; label: string }> = [
  { id: 'all', label: 'All Files' },
  { id: 'image', label: 'Images' },
  { id: 'document', label: 'Documents' },
  { id: 'media', label: 'Media' },
  { id: 'code', label: 'Code & Data' },
  { id: 'archive', label: 'Archives' },
  { id: 'favorites', label: 'Favorites' }
]

const COMPATIBLE_TOOLS_BY_TYPE: Record<string, string[]> = {
  image: [
    'image-preview',
    'images-convert',
    'images-compress',
    'image-to-ascii',
    'social-resize',
    'svg-creator',
    'image-exif',
    'image-palette',
    'image-ocr',
    'image-slicer',
    'image-grid',
    'file-metadata'
  ],
  document: [
    'pdf-merge',
    'pdf-split',
    'pdf-compress',
    'pdf-rotate',
    'pdf-to-text',
    'pdf-to-images',
    'pdf-watermark',
    'pdf-numberer',
    'file-metadata'
  ],
  audio: ['audio-trimmer', 'audio-normalize', 'file-metadata'],
  video: [
    'media-extract-audio',
    'media-convert-video',
    'media-compress-video',
    'media-video-to-gif',
    'file-metadata'
  ],
  archive: ['archive-inspect', 'zip-extract', 'file-metadata'],
  code: [
    'text-diff',
    'json-format',
    'json-to-types',
    'csv-json',
    'yaml-json',
    'xml-json',
    'markdown-preview',
    'markdown-to-pdf',
    'file-metadata'
  ],
  other: ['file-metadata', 'hash-generator', 'checksum-verifier', 'files-batch-rename']
}

/**
 * Returns registered tool definitions that can process this asset.
 */
export function getCompatibleTools(asset: AssetRecord): ToolDefinition[] {
  let toolIds = COMPATIBLE_TOOLS_BY_TYPE[asset.fileType] || []

  // If audio or video, merge with media
  if (asset.fileType === 'audio' || asset.fileType === 'video') {
    toolIds = [...toolIds, 'file-metadata', 'hash-generator']
  }

  // Universal utilities always available
  const universal = ['file-metadata', 'hash-generator', 'checksum-verifier', 'files-batch-rename']
  const merged = Array.from(new Set([...toolIds, ...universal]))

  return merged.map((id) => toolRegistry.get(id)).filter((t): t is ToolDefinition => Boolean(t))
}

/**
 * Filters and sorts assets in memory based on tab, query, and sort order.
 */
export function filterAndSortAssets(
  assets: AssetRecord[],
  tab: GalleryFilterTab,
  search: string,
  sort: GallerySortOption
): AssetRecord[] {
  const query = search.trim().toLowerCase()

  const filtered = assets.filter((item) => {
    // Tab filter
    if (tab === 'favorites' && !item.favorite) return false
    if (tab === 'media' && item.fileType !== 'audio' && item.fileType !== 'video') return false
    if (tab !== 'all' && tab !== 'favorites' && tab !== 'media' && item.fileType !== tab)
      return false

    // Search query
    if (query) {
      const matchName = item.fileName.toLowerCase().includes(query)
      const matchPath = item.filePath.toLowerCase().includes(query)
      const matchTag = item.tags.some((t) => t.toLowerCase().includes(query))
      if (!matchName && !matchPath && !matchTag) return false
    }

    return true
  })

  return filtered.sort((a, b) => {
    switch (sort) {
      case 'accessed':
        return b.lastAccessedMs - a.lastAccessedMs
      case 'added':
        return b.addedMs - a.addedMs
      case 'name':
        return a.fileName.localeCompare(b.fileName)
      case 'size':
        return b.fileSize - a.fileSize
      default:
        return 0
    }
  })
}
