import { describe, expect, it } from 'vitest'
import { extensionOf, formatBytes, guessMimeType } from './files'

describe('guessMimeType', () => {
  it('maps known extensions case-insensitively', () => {
    expect(guessMimeType('report.PDF')).toBe('application/pdf')
    expect(guessMimeType('photo.jpeg')).toBe('image/jpeg')
  })

  it('returns null for unknown or extensionless names', () => {
    expect(guessMimeType('archive.zzz')).toBeNull()
    expect(guessMimeType('README')).toBeNull()
    expect(guessMimeType('.hidden')).toBeNull()
  })
})

describe('extensionOf', () => {
  it('extracts the lowercase extension from paths and names', () => {
    expect(extensionOf('C:\\Users\\me\\notes.TXT')).toBe('.txt')
    expect(extensionOf('/var/log/app.tar.gz')).toBe('.gz')
    expect(extensionOf('Makefile')).toBe('')
  })
})

describe('formatBytes', () => {
  it('formats byte sizes with sensible precision', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.00 KB')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB')
    expect(formatBytes(3.2 * 1024 * 1024 * 1024)).toBe('3.20 GB')
  })

  it('degrades gracefully for invalid input', () => {
    expect(formatBytes(-1)).toBe('—')
    expect(formatBytes(Number.NaN)).toBe('—')
  })
})
