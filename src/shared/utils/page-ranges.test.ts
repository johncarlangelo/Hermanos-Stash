import { describe, expect, it } from 'vitest'
import { parsePageRanges } from './page-ranges'

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
