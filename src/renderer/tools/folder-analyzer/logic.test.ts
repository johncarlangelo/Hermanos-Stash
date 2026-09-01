import { describe, expect, it } from 'vitest'
import { analyzeFileList, getFileCategory } from './logic'

describe('folder-analyzer logic', () => {
  it('correctly classifies file extensions into categories', () => {
    expect(getFileCategory('photo.jpg').category).toBe('Images')
    expect(getFileCategory('clip.mp4').category).toBe('Videos')
    expect(getFileCategory('manual.pdf').category).toBe('Documents')
    expect(getFileCategory('app.ts').category).toBe('Code & Data')
    expect(getFileCategory('backup.zip').category).toBe('Archives')
  })

  it('aggregates file statistics and largest files', () => {
    const files = [
      { name: 'big_video.mp4', size: 1000000 },
      { name: 'image1.png', size: 50000 },
      { name: 'image2.png', size: 50000 },
      { name: 'doc.pdf', size: 20000 }
    ]

    const res = analyzeFileList(files)
    expect(res.totalBytes).toBe(1120000)
    expect(res.totalFiles).toBe(4)
    expect(res.largestFiles[0].name).toBe('big_video.mp4')
    expect(res.categoryBreakdown.some((c) => c.category === 'Videos')).toBe(true)
    expect(res.categoryBreakdown.some((c) => c.category === 'Images')).toBe(true)
  })
})
