import { describe, expect, it } from 'vitest'
import {
  getFileExtension,
  isFileAccepted,
  normalizeExtension,
  resolveDroppedPath
} from './DropZone'

describe('DropZone logic helpers', () => {
  describe('normalizeExtension', () => {
    it('normalizes extensions with or without leading dots and handles uppercase', () => {
      expect(normalizeExtension('.ZIP')).toBe('.zip')
      expect(normalizeExtension('zip')).toBe('.zip')
      expect(normalizeExtension(' PNG ')).toBe('.png')
      expect(normalizeExtension('.pdf')).toBe('.pdf')
    })
  })

  describe('getFileExtension', () => {
    it('extracts extension from path or filename correctly', () => {
      expect(getFileExtension('archive.zip')).toBe('.zip')
      expect(getFileExtension('ARCHIVE.ZIP')).toBe('.zip')
      expect(getFileExtension('C:\\Users\\User\\Documents\\photo.PNG')).toBe('.png')
      expect(getFileExtension('/var/data/my.report.pdf')).toBe('.pdf')
      expect(getFileExtension('no_ext')).toBe('')
    })
  })

  describe('resolveDroppedPath', () => {
    it('uses direct path if present on file object', () => {
      const mockFile = { name: 'test.zip', path: 'C:\\files\\test.zip' } as unknown as File
      expect(resolveDroppedPath(mockFile)).toBe('C:\\files\\test.zip')
    })

    it('falls back to file.name if path is not set', () => {
      const mockFile = { name: 'test.zip' } as unknown as File
      expect(resolveDroppedPath(mockFile)).toBe('test.zip')
    })
  })

  describe('isFileAccepted', () => {
    it('accepts any file if accept is empty or not provided', () => {
      const mockFile = { name: 'anything.xyz' } as unknown as File
      expect(isFileAccepted(mockFile, 'C:\\anything.xyz', [])).toBe(true)
    })

    it('accepts zip file with lowercase or uppercase extension in accept list', () => {
      const mockFileLower = { name: 'archive.zip' } as unknown as File
      expect(isFileAccepted(mockFileLower, 'D:\\archive.zip', ['.zip'])).toBe(true)
      expect(isFileAccepted(mockFileLower, 'D:\\archive.zip', ['zip'])).toBe(true)
      expect(isFileAccepted(mockFileLower, 'D:\\archive.zip', ['.ZIP'])).toBe(true)

      const mockFileUpper = { name: 'ARCHIVE.ZIP' } as unknown as File
      expect(isFileAccepted(mockFileUpper, 'D:\\ARCHIVE.ZIP', ['.zip'])).toBe(true)
      expect(isFileAccepted(mockFileUpper, 'D:\\ARCHIVE.ZIP', ['zip'])).toBe(true)
    })

    it('rejects files not in the accept list', () => {
      const mockFile = { name: 'document.pdf' } as unknown as File
      expect(isFileAccepted(mockFile, 'D:\\document.pdf', ['.zip'])).toBe(false)
      expect(isFileAccepted(mockFile, 'D:\\document.pdf', ['.png', '.jpg'])).toBe(false)
    })

    it('checks both resolvedPath and file.name', () => {
      const mockFile = { name: 'photo.jpg' } as unknown as File
      expect(isFileAccepted(mockFile, '', ['.jpg'])).toBe(true)
      expect(isFileAccepted(mockFile, 'C:\\temp\\photo.jpg', ['.jpg'])).toBe(true)
    })

    it('accepts .rar archive files correctly', () => {
      const mockRar = { name: 'backup.rar' } as unknown as File
      expect(isFileAccepted(mockRar, 'D:\\backup.rar', ['.zip', '.rar', '.7z'])).toBe(true)
      expect(isFileAccepted(mockRar, 'D:\\backup.RAR', ['.rar'])).toBe(true)
    })
  })
})
