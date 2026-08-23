import { describe, expect, it } from 'vitest'
import { parsePageRanges, parsePageSequence } from './page-ranges'

describe('parsePageRanges', () => {
  it('parses single pages and ranges', () => {
    expect(parsePageRanges('5', 10)).toEqual({ groups: [[5]] })
    expect(parsePageRanges('1-3', 10)).toEqual({ groups: [[1, 2, 3]] })
    expect(parsePageRanges('1-3,7,10-12', 12)).toEqual({
      groups: [[1, 2, 3], [7], [10, 11, 12]]
    })
  })

  it('tolerates whitespace everywhere', () => {
    expect(parsePageRanges('  1 - 3 , 7 ', 10)).toEqual({ groups: [[1, 2, 3], [7]] })
    expect(parsePageRanges('\t2\n', 10)).toEqual({ groups: [[2]] })
  })

  it('dedupes overlapping ranges while preserving order', () => {
    expect(parsePageRanges('1-3,2-4', 10)).toEqual({ groups: [[1, 2, 3], [4]] })
    expect(parsePageRanges('5,5,5', 10)).toEqual({ groups: [[5]] })
    expect(parsePageRanges('3-1', 10)).toHaveProperty('error')
  })

  it('rejects empty or malformed specs with actionable errors', () => {
    for (const spec of ['', '   ', ',', '1,,2']) {
      const result = parsePageRanges(spec, 10)
      if (!('error' in result)) throw new Error(`expected error for "${spec}"`)
    }
    expect(parsePageRanges('', 10)).toHaveProperty('error')
    expect(parsePageRanges('abc', 10)).toHaveProperty('error')
    expect(parsePageRanges('1.5', 10)).toHaveProperty('error')
    expect(parsePageRanges('1-2-3', 10)).toHaveProperty('error')
  })

  it('rejects out-of-range pages with the real page count', () => {
    expect(parsePageRanges('11', 10)).toEqual({
      error: '"11" exceeds this document\'s 10 pages.'
    })
    expect(parsePageRanges('1-11', 10)).toEqual({
      error: '"1-11" exceeds this document\'s 10 pages.'
    })
    expect(parsePageRanges('0', 10)).toEqual({
      error: 'Page numbers start at 1 — "0" is out of range.'
    })
  })

  it('handles the single-page boundary and rejects reversed ranges', () => {
    expect(parsePageRanges('1', 1)).toEqual({ groups: [[1]] })
    expect(parsePageRanges('2', 1)).toHaveProperty('error')
    expect(parsePageRanges('4-2', 10)).toEqual({
      error: '"4-2" runs backwards — ranges go low to high.'
    })
  })

  it('rejects parsing against an empty document', () => {
    expect(parsePageRanges('1', 0)).toHaveProperty('error')
  })
})

describe('parsePageSequence', () => {
  it('returns a flat ordered array exactly as written', () => {
    expect(parsePageSequence('5', 10)).toEqual({ pages: [5] })
    expect(parsePageSequence('2-4', 10)).toEqual({ pages: [2, 3, 4] })
    expect(parsePageSequence('1,3,5-7', 10)).toEqual({ pages: [1, 3, 5, 6, 7] })
  })

  it('preserves written order so "3,1" means page 3 first', () => {
    expect(parsePageSequence('3,1', 10)).toEqual({ pages: [3, 1] })
    expect(parsePageSequence('5-7,2', 10)).toEqual({ pages: [5, 6, 7, 2] })
  })

  it('rejects duplicates anywhere in the sequence', () => {
    const dup = parsePageSequence('5,5', 10)
    if (!('error' in dup)) throw new Error('expected duplicate rejection')
    expect(dup.error).toMatch(/twice/)
    expect(parsePageSequence('1-3,2-4', 10)).toHaveProperty('error')
    expect(parsePageSequence('1,2,1', 10)).toHaveProperty('error')
  })

  it('rejects out-of-range and malformed input like the range parser', () => {
    expect(parsePageSequence('11', 10)).toEqual({
      error: '"11" exceeds this document\'s 10 pages.'
    })
    expect(parsePageSequence('0', 10)).toHaveProperty('error')
    expect(parsePageSequence('abc', 10)).toHaveProperty('error')
    expect(parsePageSequence('1.5', 10)).toHaveProperty('error')
    expect(parsePageSequence('4-2', 10)).toHaveProperty('error')
    expect(parsePageSequence('1,,2', 10)).toHaveProperty('error')
    expect(parsePageSequence('', 10)).toHaveProperty('error')
  })

  it('handles the single-page boundary and empty documents', () => {
    expect(parsePageSequence('1', 1)).toEqual({ pages: [1] })
    expect(parsePageSequence('2', 1)).toHaveProperty('error')
    expect(parsePageSequence('1', 0)).toHaveProperty('error')
  })

  it('tolerates whitespace everywhere', () => {
    expect(parsePageSequence('  2 - 3 , 5 ', 10)).toEqual({ pages: [2, 3, 5] })
  })
})
