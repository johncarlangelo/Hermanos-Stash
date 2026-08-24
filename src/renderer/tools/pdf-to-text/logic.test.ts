import { describe, expect, it } from 'vitest'
import { assembleText, countWords, joinPages, resolvePages } from './logic'

/** Build text-content-like items from "line" fixtures. */
function itemsOf(lines: string[]): Array<{ str: string; hasEOL: boolean }> {
  const items: Array<{ str: string; hasEOL: boolean }> = []
  for (const line of lines) {
    // pdf.js may split one visual line into several str fragments; only the
    // last fragment of a line carries hasEOL.
    const parts = line.split('|')
    parts.forEach((part, partIndex) => {
      items.push({ str: part, hasEOL: partIndex === parts.length - 1 })
    })
  }
  return items
}

describe('assembleText', () => {
  it('turns hasEOL markers into newlines when preserving line breaks', () => {
    const result = assembleText(itemsOf(['Hello world', 'Second line']))
    expect(result).toBe('Hello world\nSecond line')
  })

  it('keeps intra-line fragments joined exactly as pdf.js provides them', () => {
    const result = assembleText(itemsOf(['Hel|lo wor|ld']))
    expect(result).toBe('Hello world')
  })

  it('collapses line breaks into single spaces in flow mode', () => {
    const result = assembleText(itemsOf(['Hello', 'wide', 'world']), {
      preserveLineBreaks: false
    })
    expect(result).toBe('Hello wide world')
  })

  it('trims trailing spaces before preserved newlines and at the end', () => {
    const result = assembleText([
      { str: 'first   ', hasEOL: true },
      { str: 'second', hasEOL: false }
    ])
    expect(result).toBe('first\nsecond')
  })

  it('handles empty item lists as empty text', () => {
    expect(assembleText([])).toBe('')
    expect(assembleText([], { preserveLineBreaks: false })).toBe('')
  })

  it('defaults to preserving line breaks when no option is given', () => {
    const fixture = itemsOf(['a', 'b'])
    expect(assembleText(fixture)).toBe(assembleText(fixture, { preserveLineBreaks: true }))
  })
})

describe('joinPages', () => {
  it('separates pages with a blank line in preserve mode and a newline in flow mode', () => {
    expect(joinPages(['one', 'two'], true)).toBe('one\n\ntwo')
    expect(joinPages(['one', 'two'], false)).toBe('one\ntwo')
  })
})

describe('resolvePages', () => {
  it('selects every page for empty input and the literal "all"', () => {
    expect(resolvePages('', 3)).toEqual({ pages: [1, 2, 3] })
    expect(resolvePages('  ALL ', 2)).toEqual({ pages: [1, 2] })
  })

  it('parses explicit ranges through the shared page-range parser', () => {
    expect(resolvePages('1-3, 5', 6)).toEqual({ pages: [1, 2, 3, 5] })
  })

  it('rejects out-of-bounds pages with the shared error language', () => {
    const result = resolvePages('4', 3)
    expect('error' in result && result.error).toContain("exceeds this document's 3 pages")
  })

  it('rejects repeated pages like the sequence parser does', () => {
    const result = resolvePages('1, 1', 3)
    expect('error' in result && result.error).toMatch(/appears twice/i)
  })

  it('rejects malformed tokens', () => {
    const result = resolvePages('abc', 3)
    expect('error' in result && result.error).toBeTruthy()
  })

  it('fails cleanly on documents without pages', () => {
    expect(resolvePages('all', 0)).toEqual({ error: 'This document has no pages to read.' })
  })
})

describe('countWords', () => {
  it('counts whitespace-delimited words', () => {
    expect(countWords('hello brave new world')).toBe(4)
    expect(countWords('  spaced\t out \n words ')).toBe(3)
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
  })
})
