import { describe, expect, it } from 'vitest'
import { findDuplicateGroups, formatBytes, type CandidateFile } from './logic'

describe('duplicate-finder logic', () => {
  it('formats byte sizes accurately', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(0)).toBe('0 B')
  })

  it('detects duplicate files by matching hash', async () => {
    const files: CandidateFile[] = [
      { id: '1', name: 'photo_copy1.jpg', size: 5000, lastModified: 1000, hash: 'hash-aaa' },
      { id: '2', name: 'photo_copy2.jpg', size: 5000, lastModified: 2000, hash: 'hash-aaa' },
      { id: '3', name: 'unique.jpg', size: 4000, lastModified: 3000, hash: 'hash-bbb' }
    ]

    const result = await findDuplicateGroups(files)
    expect(result.groups.length).toBe(1)
    expect(result.totalDuplicateCount).toBe(1)
    expect(result.totalWastedBytes).toBe(5000)
    expect(result.groups[0].files.length).toBe(2)
  })
})
