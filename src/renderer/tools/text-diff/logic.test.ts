import { describe, expect, it } from 'vitest'
import { MAX_LINES, diffLines } from './logic'

function types(result: ReturnType<typeof diffLines>) {
  if ('error' in result) throw new Error('unexpected too-large result')
  return result.rows.map((row) => row.type)
}

describe('diffLines', () => {
  it('marks identical texts as all-equal', () => {
    const result = diffLines('one\ntwo\nthree', 'one\ntwo\nthree')
    expect(result).toEqual({
      rows: [
        { type: 'equal', text: 'one', aIndex: 1, bIndex: 1 },
        { type: 'equal', text: 'two', aIndex: 2, bIndex: 2 },
        { type: 'equal', text: 'three', aIndex: 3, bIndex: 3 }
      ],
      added: 0,
      removed: 0
    })
  })

  it('detects additions only', () => {
    const result = diffLines('one\ntwo', 'one\ntwo\nthree')
    expect(types(result)).toEqual(['equal', 'equal', 'added'])
    expect(result).toMatchObject({ added: 1, removed: 0 })
  })

  it('detects removals only', () => {
    const result = diffLines('one\ntwo\nthree', 'one\ntwo')
    expect(types(result)).toEqual(['equal', 'equal', 'removed'])
    expect(result).toMatchObject({ added: 0, removed: 1 })
  })

  it('interleaves adds and removes in mixed edits', () => {
    const result = diffLines('a\nb\nc', 'a\nx\nc\ny')
    expect(types(result)).toEqual(['equal', 'removed', 'added', 'equal', 'added'])
    expect(result).toMatchObject({ added: 2, removed: 1 })
  })

  it('treats empty original as pure addition (boundary)', () => {
    const result = diffLines('', 'first\nsecond')
    expect(types(result)).toEqual(['added', 'added'])
    expect(result).toMatchObject({ added: 2, removed: 0 })
  })

  it('treats empty modified as pure removal (boundary)', () => {
    const result = diffLines('first\nsecond', '')
    expect(types(result)).toEqual(['removed', 'removed'])
  })

  it('returns no rows for two empty inputs (boundary)', () => {
    const result = diffLines('', '')
    expect(result).toEqual({ rows: [], added: 0, removed: 0 })
  })

  it('reports the too-large guard when either side exceeds MAX_LINES', () => {
    const big = Array.from({ length: MAX_LINES + 1 }, (_, i) => `line ${i}`).join('\n')
    expect(diffLines(big, 'small')).toEqual({ error: 'too large' })
    expect(diffLines('small', big)).toEqual({ error: 'too large' })
  })

  it('handles inputs exactly at the guard limit', () => {
    const exact = Array.from({ length: MAX_LINES }, (_, i) => `${i}`).join('\n')
    const result = diffLines(exact, exact)
    expect(result).not.toEqual({ error: 'too large' })
    if (!('error' in result)) expect(result.added + result.removed).toBe(0)
  })
})
