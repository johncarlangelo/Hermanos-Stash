import { describe, expect, it } from 'vitest'
import type { ArchiveEntryInfo } from '../../../shared/ipc'
import {
  categorizeEntry,
  filterArchiveEntries,
  formatCompressionRatio,
  getFolderViewData,
  guessMimeType
} from './logic'

describe('Archive Inspector Logic', () => {
  describe('categorizeEntry', () => {
    it('categorizes directory entries as folder', () => {
      expect(categorizeEntry('assets/', true)).toBe('folder')
      expect(categorizeEntry('docs/nested/', false)).toBe('folder')
    })

    it('categorizes image files', () => {
      expect(categorizeEntry('banner.png', false)).toBe('image')
      expect(categorizeEntry('photos/pic.jpeg', false)).toBe('image')
      expect(categorizeEntry('icon.webp', false)).toBe('image')
      expect(categorizeEntry('vector.svg', false)).toBe('image')
    })

    it('categorizes video files', () => {
      expect(categorizeEntry('clip.mp4', false)).toBe('video')
      expect(categorizeEntry('movies/intro.webm', false)).toBe('video')
      expect(categorizeEntry('raw.mkv', false)).toBe('video')
    })

    it('categorizes audio files', () => {
      expect(categorizeEntry('song.mp3', false)).toBe('audio')
      expect(categorizeEntry('recordings/voice.wav', false)).toBe('audio')
      expect(categorizeEntry('track.flac', false)).toBe('audio')
    })

    it('categorizes pdf documents', () => {
      expect(categorizeEntry('report.pdf', false)).toBe('pdf')
      expect(categorizeEntry('docs/manual.PDF', false)).toBe('pdf')
    })

    it('categorizes text, code and config files', () => {
      expect(categorizeEntry('readme.md', false)).toBe('text')
      expect(categorizeEntry('package.json', false)).toBe('text')
      expect(categorizeEntry('main.ts', false)).toBe('text')
      expect(categorizeEntry('styles.css', false)).toBe('text')
      expect(categorizeEntry('.env', false)).toBe('text')
    })

    it('falls back to binary for unknown extensions', () => {
      expect(categorizeEntry('firmware.bin', false)).toBe('binary')
      expect(categorizeEntry('data.dat', false)).toBe('binary')
    })
  })

  describe('formatCompressionRatio', () => {
    it('formats positive savings', () => {
      expect(formatCompressionRatio(1000, 400)).toBe('60% saved')
    })

    it('formats uncompressed 0% ratio', () => {
      expect(formatCompressionRatio(1000, 1000)).toBe('0% (uncompressed)')
    })

    it('handles negative savings gracefully', () => {
      expect(formatCompressionRatio(500, 600)).toBe('20% larger')
    })

    it('handles zero byte sizes', () => {
      expect(formatCompressionRatio(0, 0)).toBe('0%')
    })
  })

  describe('guessMimeType', () => {
    it('returns accurate MIME types', () => {
      expect(guessMimeType('photo.png')).toBe('image/png')
      expect(guessMimeType('video.mp4')).toBe('video/mp4')
      expect(guessMimeType('music.mp3')).toBe('audio/mpeg')
      expect(guessMimeType('document.pdf')).toBe('application/pdf')
      expect(guessMimeType('app.json')).toBe('application/json')
      expect(guessMimeType('unknown.xyz')).toBe('application/octet-stream')
    })
  })

  describe('filterArchiveEntries', () => {
    const sampleEntries: ArchiveEntryInfo[] = [
      {
        path: 'src/',
        name: 'src',
        isDirectory: true,
        uncompressedSize: 0,
        compressedSize: 0,
        isEncrypted: false
      },
      {
        path: 'src/index.ts',
        name: 'index.ts',
        isDirectory: false,
        uncompressedSize: 1500,
        compressedSize: 600,
        isEncrypted: false
      },
      {
        path: 'assets/logo.png',
        name: 'logo.png',
        isDirectory: false,
        uncompressedSize: 25000,
        compressedSize: 22000,
        isEncrypted: false
      },
      {
        path: 'demo.mp4',
        name: 'demo.mp4',
        isDirectory: false,
        uncompressedSize: 5000000,
        compressedSize: 4800000,
        isEncrypted: false
      }
    ]

    it('returns all entries when query is empty and category is all', () => {
      const res = filterArchiveEntries(sampleEntries)
      expect(res.length).toBe(4)
      // Folder should sort first
      expect(res[0].path).toBe('src/')
    })

    it('filters by keyword search', () => {
      const res = filterArchiveEntries(sampleEntries, { query: 'logo' })
      expect(res.length).toBe(1)
      expect(res[0].name).toBe('logo.png')
    })

    it('filters by category', () => {
      const images = filterArchiveEntries(sampleEntries, { category: 'image' })
      expect(images.length).toBe(1)
      expect(images[0].name).toBe('logo.png')

      const videos = filterArchiveEntries(sampleEntries, { category: 'video' })
      expect(videos.length).toBe(1)
      expect(videos[0].name).toBe('demo.mp4')
    })

    it('sorts by size descending', () => {
      const sorted = filterArchiveEntries(sampleEntries, {
        category: 'all',
        sortBy: 'size',
        sortOrder: 'desc'
      })
      // Directories sort first, then files by size desc
      expect(sorted[1].name).toBe('demo.mp4')
      expect(sorted[2].name).toBe('logo.png')
      expect(sorted[3].name).toBe('index.ts')
    })
  })

  describe('getFolderViewData', () => {
    const hierarchicalEntries: ArchiveEntryInfo[] = [
      { path: 'ACC\'s.txt', name: 'ACC\'s.txt', isDirectory: false, uncompressedSize: 50, compressedSize: 30, isEncrypted: false },
      { path: 'Photos/summer/beach.jpg', name: 'beach.jpg', isDirectory: false, uncompressedSize: 2048, compressedSize: 1024, isEncrypted: false },
      { path: 'Photos/summer/sunset.png', name: 'sunset.png', isDirectory: false, uncompressedSize: 4096, compressedSize: 2048, isEncrypted: false },
      { path: 'Photos/winter/snow.jpg', name: 'snow.jpg', isDirectory: false, uncompressedSize: 1024, compressedSize: 512, isEncrypted: false },
      { path: 'Videos/intro.mp4', name: 'intro.mp4', isDirectory: false, uncompressedSize: 10000, compressedSize: 8000, isEncrypted: true },
      { path: 'Docs/', name: 'Docs', isDirectory: true, uncompressedSize: 0, compressedSize: 0, isEncrypted: false }
    ]

    it('returns root level items with direct files and subfolders', () => {
      const root = getFolderViewData(hierarchicalEntries, '')
      expect(root.currentPath).toBe('')
      expect(root.breadcrumbs).toEqual([{ label: 'Root', path: '' }])

      const folderNames = root.items.filter((i) => i.isDirectory).map((i) => i.name)
      const fileNames = root.items.filter((i) => !i.isDirectory).map((i) => i.name)

      expect(folderNames).toContain('Docs')
      expect(folderNames).toContain('Photos')
      expect(folderNames).toContain('Videos')
      expect(fileNames).toContain('ACC\'s.txt')

      const photosFolder = root.items.find((i) => i.name === 'Photos')
      expect(photosFolder?.itemCount).toBe(3) // beach, sunset, snow
    })

    it('navigates into subfolders accurately', () => {
      const sub = getFolderViewData(hierarchicalEntries, 'Photos')
      expect(sub.currentPath).toBe('Photos')
      expect(sub.breadcrumbs).toEqual([
        { label: 'Root', path: '' },
        { label: 'Photos', path: 'Photos' }
      ])

      const subfolderNames = sub.items.filter((i) => i.isDirectory).map((i) => i.name)
      expect(subfolderNames).toEqual(['summer', 'winter'])

      const summer = getFolderViewData(hierarchicalEntries, 'Photos/summer')
      expect(summer.breadcrumbs.length).toBe(3)
      const summerFiles = summer.items.map((i) => i.name)
      expect(summerFiles).toEqual(['beach.jpg', 'sunset.png'])
    })
  })
})
