import { describe, expect, it } from 'vitest'
import { lookupByExtension, MIME_BY_EXTENSION, reverseLookup, searchMimeTypes } from './logic'

describe('lookupByExtension', () => {
  it('resolves known pairs with or without a leading dot', () => {
    expect(lookupByExtension('.pdf')).toBe('application/pdf')
    expect(lookupByExtension('PDF')).toBe('application/pdf')
    expect(lookupByExtension(' png ')).toBe('image/png')
  })

  it('returns null for unknown extensions', () => {
    expect(lookupByExtension('.definitely-not-real')).toBeNull()
    expect(lookupByExtension('')).toBeNull()
  })
})

describe('reverseLookup', () => {
  it('finds every extension for image/png', () => {
    const exts = reverseLookup('image/png')
    expect(exts).toContain('.png')
    expect(exts.length).toBeGreaterThanOrEqual(1)
    expect(exts.every((e) => e.startsWith('.'))).toBe(true)
  })

  it('returns multiple matches where aliases exist', () => {
    expect(reverseLookup('image/jpeg').sort()).toEqual(['.jpeg', '.jpg'])
    expect(reverseLookup('video/webm')).toEqual(['.webm'])
  })

  it('returns an empty array for unknown MIME types', () => {
    expect(reverseLookup('x-imaginary/type')).toEqual([])
    expect(reverseLookup('   ')).toEqual([])
  })

  it('is consistent with the forward table', () => {
    for (const [ext, mime] of Object.entries(MIME_BY_EXTENSION)) {
      expect(lookupByExtension(ext)).toBe(mime)
    }
  })
})

describe('searchMimeTypes', () => {
  it('matches by extension substring and MIME substring', () => {
    const byExt = searchMimeTypes('png')
    expect(byExt.some((r) => r.ext === '.png')).toBe(true)

    const byMime = searchMimeTypes('image/')
    expect(byMime.length).toBeGreaterThan(5)
    expect(byMime.every((r) => r.mime.includes('image/'))).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(searchMimeTypes('PNG').length).toBe(searchMimeTypes('png').length)
  })

  it('returns the full table for an empty query', () => {
    expect(searchMimeTypes('').length).toBe(Object.keys(MIME_BY_EXTENSION).length)
  })
})
