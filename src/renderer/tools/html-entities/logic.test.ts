import { describe, expect, it } from 'vitest'
import { decodeEntities, encodeEntities, slugify } from './logic'

describe('encodeEntities', () => {
  it('escapes the five markup-significant characters', () => {
    expect(encodeEntities(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;')
  })

  it('uses named entities for known non-ASCII characters', () => {
    expect(encodeEntities('a © b')).toBe('a &copy; b')
    expect(encodeEntities('…')).toBe('&hellip;')
  })

  it('falls back to numeric entities for unknown non-ASCII', () => {
    expect(encodeEntities('Ω')).toBe('&#937;')
    expect(encodeEntities('😀')).toBe('&#128512;')
  })

  it('leaves plain ASCII untouched', () => {
    expect(encodeEntities('Hello, world! 123')).toBe('Hello, world! 123')
  })

  it('maps empty input to empty output', () => {
    expect(encodeEntities('')).toBe('')
  })
})

describe('decodeEntities', () => {
  it('decodes the five core entities', () => {
    expect(decodeEntities('&amp;')).toBe('&')
    expect(decodeEntities('&lt;script&gt;')).toBe('<script>')
    expect(decodeEntities('&quot;x&quot; &apos;y&apos;')).toBe('"x" \'y\'')
  })

  it('decodes numeric and hexadecimal references', () => {
    expect(decodeEntities('&#233;')).toBe('é')
    expect(decodeEntities('&#xE9;')).toBe('é')
    expect(decodeEntities('&#X1F600;')).toBe('😀')
  })

  it('leaves unknown named entities untouched instead of guessing', () => {
    expect(decodeEntities('&notarealentity; stays')).toBe('&notarealentity; stays')
  })

  it('never executes embedded HTML — output is inert text', () => {
    const result = decodeEntities('<img src=x onerror=alert(1)>')
    expect(result).toBe('<img src=x onerror=alert(1)>')
  })
})

describe('round-trips', () => {
  const samples = [
    'plain text',
    'Café & crème brûlée',
    '5 < 10 > 3',
    `quote "double" and 'single'`,
    'emoji 🚀 and 中文',
    ''
  ]

  for (const sample of samples) {
    it(`round-trips ${JSON.stringify(sample)}`, () => {
      expect(decodeEntities(encodeEntities(sample))).toBe(sample)
    })
  }
})

describe('slugify', () => {
  it('folds diacritics', () => {
    expect(slugify('Café')).toBe('cafe')
    // ß has no ASCII decomposition, so it becomes a word separator.
    expect(slugify('Über straßen')).toBe('uber-stra-en')
    expect(slugify('naïve résumé')).toBe('naive-resume')
  })

  it('lowercases and replaces non-alphanumerics with dashes', () => {
    expect(slugify('My Great Post! (2026)')).toBe('my-great-post-2026')
  })

  it('collapses runs of separators into one dash', () => {
    expect(slugify('a   ---  b___c')).toBe('a-b-c')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('--hello--world--')).toBe('hello-world')
    expect(slugify('***')).toBe('')
  })

  it('handles empty input', () => {
    expect(slugify('')).toBe('')
  })
})
