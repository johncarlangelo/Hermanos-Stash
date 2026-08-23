import { describe, expect, it } from 'vitest'
import type { FileMetadata } from '../../../shared/ipc'
import { buildFileDisplayInfos, formatRelativeTime, mergeUniquePaths } from './logic'

function meta(overrides: Partial<FileMetadata> = {}): FileMetadata {
  return {
    path: 'C:\\Users\\me\\report.pdf',
    name: 'report.pdf',
    extension: '.pdf',
    sizeBytes: 2048,
    isDirectory: false,
    createdAtMs: 1_700_000_000_000,
    modifiedAtMs: 1_710_000_000_000,
    ...overrides
  }
}

describe('buildFileDisplayInfos', () => {
  const now = 1_710_086_400_000 // exactly one day after meta's modifiedAt

  it('maps stat results into humanized display rows', () => {
    const [row] = buildFileDisplayInfos([meta()], now)
    expect(row.name).toBe('report.pdf')
    expect(row.extension).toBe('.pdf')
    expect(row.sizeLabel).toBe('2.00 KB')
    expect(row.mimeTypeLabel).toBe('application/pdf')
    expect(row.createdLabel).not.toBe('')
    expect(row.modifiedLabel).not.toBe('')
    expect(row.modifiedRelative).toMatch(/day/i)
  })

  it('falls back to Unknown for unrecognized extensions', () => {
    const [row] = buildFileDisplayInfos([meta({ name: 'blob.zzz', extension: '.zzz' })], now)
    expect(row.mimeTypeLabel).toBe('Unknown')
  })

  it('labels directories as folders and recovers extension from the name', () => {
    const folder = meta({
      name: 'Archive',
      path: 'C:\\Users\\me\\Archive',
      extension: '',
      isDirectory: true,
      sizeBytes: 0
    })
    const [row] = buildFileDisplayInfos([folder], now)
    expect(row.extension).toBe('')
    expect(row.mimeTypeLabel).toBe('Folder')
    expect(row.sizeLabel).toBe('0 B')
  })
})

describe('formatRelativeTime', () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0)

  it('collapses sub-minute differences to "just now"', () => {
    expect(formatRelativeTime(now - 30_000, now)).toBe('just now')
    expect(formatRelativeTime(now + 59_000, now)).toBe('just now')
  })

  it('formats minutes, hours and days with direction', () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toMatch(/5 minutes ago/)
    expect(formatRelativeTime(now + 90 * 60_000, now)).toMatch(/in .*hour/i)
    expect(formatRelativeTime(now - 3 * 86_400_000, now)).toMatch(/3 days ago/)
  })

  it('scales up to months and years for old timestamps', () => {
    expect(formatRelativeTime(now - 45 * 86_400_000, now)).toMatch(/month/i)
    expect(formatRelativeTime(now - 800 * 86_400_000, now)).toMatch(/year/i)
  })
})

describe('mergeUniquePaths', () => {
  it('drops incoming paths that are already listed', () => {
    expect(mergeUniquePaths(['a.txt'], ['a.txt', 'b.txt'])).toEqual(['b.txt'])
  })

  it('keeps everything when there is no overlap', () => {
    expect(mergeUniquePaths([], ['x', 'y'])).toEqual(['x', 'y'])
    expect(mergeUniquePaths(['x'], ['x'])).toEqual([])
  })
})
