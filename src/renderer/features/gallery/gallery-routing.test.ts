import { describe, expect, it } from 'vitest'
import type { AssetRecord } from '../../../shared/ipc'
import '../../tools/index'
import { filterAndSortAssets, getCompatibleTools, GALLERY_TABS } from './gallery-routing'

describe('gallery-routing', () => {
  const mockAssets: AssetRecord[] = [
    {
      id: 1,
      filePath: 'C:\\Users\\user\\Pictures\\sample.png',
      fileName: 'sample.png',
      fileSize: 1024,
      fileType: 'image',
      mimeType: 'image/png',
      sourceToolId: 'svg-creator',
      favorite: true,
      tags: ['vector', 'icon'],
      addedMs: 1000,
      lastAccessedMs: 5000,
      exists: true
    },
    {
      id: 2,
      filePath: 'C:\\Users\\user\\Documents\\contract.pdf',
      fileName: 'contract.pdf',
      fileSize: 50000,
      fileType: 'document',
      mimeType: 'application/pdf',
      sourceToolId: null,
      favorite: false,
      tags: ['work'],
      addedMs: 2000,
      lastAccessedMs: 3000,
      exists: true
    },
    {
      id: 3,
      filePath: 'C:\\Users\\user\\Music\\song.mp3',
      fileName: 'song.mp3',
      fileSize: 300000,
      fileType: 'audio',
      mimeType: 'audio/mpeg',
      sourceToolId: null,
      favorite: false,
      tags: [],
      addedMs: 3000,
      lastAccessedMs: 2000,
      exists: true
    }
  ]

  it('filters assets by tab correctly', () => {
    const images = filterAndSortAssets(mockAssets, 'image', '', 'accessed')
    expect(images.length).toBe(1)
    expect(images[0].fileName).toBe('sample.png')

    const docs = filterAndSortAssets(mockAssets, 'document', '', 'accessed')
    expect(docs.length).toBe(1)
    expect(docs[0].fileName).toBe('contract.pdf')

    const media = filterAndSortAssets(mockAssets, 'media', '', 'accessed')
    expect(media.length).toBe(1)
    expect(media[0].fileName).toBe('song.mp3')

    const favs = filterAndSortAssets(mockAssets, 'favorites', '', 'accessed')
    expect(favs.length).toBe(1)
    expect(favs[0].id).toBe(1)
  })

  it('filters assets by search query across name, path, and tags', () => {
    const byTag = filterAndSortAssets(mockAssets, 'all', 'icon', 'accessed')
    expect(byTag.length).toBe(1)
    expect(byTag[0].id).toBe(1)

    const byName = filterAndSortAssets(mockAssets, 'all', 'contract', 'accessed')
    expect(byName.length).toBe(1)
    expect(byName[0].id).toBe(2)
  })

  it('sorts assets accurately by accessed, added, name, and size', () => {
    const byAccessed = filterAndSortAssets(mockAssets, 'all', '', 'accessed')
    expect(byAccessed[0].id).toBe(1) // 5000ms

    const byAdded = filterAndSortAssets(mockAssets, 'all', '', 'added')
    expect(byAdded[0].id).toBe(3) // 3000ms

    const byName = filterAndSortAssets(mockAssets, 'all', '', 'name')
    expect(byName[0].fileName).toBe('contract.pdf')

    const bySize = filterAndSortAssets(mockAssets, 'all', '', 'size')
    expect(bySize[0].fileName).toBe('song.mp3')
  })

  it('returns compatible tools for image assets', () => {
    const tools = getCompatibleTools(mockAssets[0])
    expect(tools.length).toBeGreaterThan(0)
    const toolIds = tools.map((t) => t.id)
    expect(toolIds).toContain('image-preview')
  })

  it('has valid gallery tabs defined', () => {
    expect(GALLERY_TABS.length).toBeGreaterThan(4)
    expect(GALLERY_TABS.some((t) => t.id === 'all')).toBe(true)
    expect(GALLERY_TABS.some((t) => t.id === 'favorites')).toBe(true)
  })
})
