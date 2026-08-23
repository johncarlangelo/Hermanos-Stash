import { describe, expect, it } from 'vitest'
import { buildPreviewSegments, REGEX_FLAGS, testRegex } from './logic'

describe('testRegex — global matching', () => {
  it('finds every occurrence with the g flag', () => {
    const r = testRegex('a', 'g', 'banana')
    expect(r.error).toBeUndefined()
    expect(r.total).toBe(3)
    expect(r.matches.map((m) => m.index)).toEqual([1, 3, 5])
  })

  it('returns a single match without the g flag', () => {
    const r = testRegex('a', '', 'banana')
    expect(r.total).toBe(1)
    expect(r.matches[0]).toMatchObject({ index: 1, text: 'a' })
  })
})

describe('testRegex — capture groups', () => {
  it('collects positional groups with unmatched as empty strings', () => {
    const r = testRegex('(\\d+)-(\\d+)?-(\\w)', 'g', '12--x')
    expect(r.matches[0]!.groups).toEqual(['12', '', 'x'])
  })

  it('collects named groups when the pattern defines them', () => {
    const r = testRegex('(?<user>\\w+)@(?<domain>\\w+\\.com)', 'g', 'hi from sam@example.com')
    expect(r.total).toBe(1)
    expect(r.matches[0]!.named).toEqual({ user: 'sam', domain: 'example.com' })
  })

  it('omits named when no named groups exist', () => {
    const r = testRegex('\\w+', 'g', 'abc')
    expect(r.matches[0]!.named).toBeUndefined()
  })
})

describe('testRegex — error shapes', () => {
  it('reports invalid patterns without throwing', () => {
    const r = testRegex('[unclosed', 'g', 'input')
    expect(r.matches).toEqual([])
    expect(r.total).toBe(0)
    expect(typeof r.error).toBe('string')
    expect(r.error!.length).toBeGreaterThan(0)
  })

  it('rejects unsupported flags', () => {
    expect(testRegex('a', 'z', 'a').error).toContain('"z"')
    // `p`/`w` are not in the supported set.
    expect(testRegex('a', 'gp', 'a').error).toContain('"p"')
  })

  it('rejects duplicated flags', () => {
    expect(testRegex('a', 'gg', 'a').error).toContain('more than once')
  })

  it('accepts every flag in the supported set', () => {
    for (const flag of REGEX_FLAGS) {
      const r = testRegex('a?', flag, 'b')
      expect(r.error, `flag ${flag}`).toBeUndefined()
    }
  })
})

describe('testRegex — zero-length safety', () => {
  it("terminates for 'a*' over 'bbb'", () => {
    const r = testRegex('a*', 'g', 'bbb')
    expect(r.error).toBeUndefined()
    // Zero-length matches are stepped past rather than looping forever.
    expect(r.total).toBe(4)
    expect(r.matches.every((m) => m.text === '' || m.text === 'a')).toBe(true)
  })

  it('terminates on an empty pattern over any input', () => {
    const r = testRegex('', 'g', 'ab')
    expect(r.error).toBeUndefined()
    expect(r.total).toBe(3)
  })

  it('terminates on empty input with a zero-length-capable pattern', () => {
    const r = testRegex('x*', 'g', '')
    expect(r.total).toBe(1)
  })
})

describe('testRegex — maxMatches cap', () => {
  it('stops collecting at maxMatches and signals capping via total >= maxMatches', () => {
    const r = testRegex('o', 'g', 'oooooo', { maxMatches: 4 })
    expect(r.matches).toHaveLength(4)
    // Sentinel semantics: total >= maxMatches ⇒ "at least this many".
    expect(r.total).toBe(4)
  })

  it('reports exact totals below the cap', () => {
    const r = testRegex('o', 'g', 'ooo', { maxMatches: 100 })
    expect(r.total).toBe(3)
    expect(r.matches).toHaveLength(3)
  })
})

describe('buildPreviewSegments', () => {
  it('splits input into alternating plain and matched segments', () => {
    const r = testRegex('an', 'g', 'banana')
    const segments = buildPreviewSegments('banana', r.matches)
    // Matches at 1–3 and 3–5 are adjacent, so no plain segment sits between them.
    expect(segments).toEqual([
      { text: 'b', match: false },
      { text: 'an', match: true },
      { text: 'an', match: true },
      { text: 'a', match: false }
    ])
  })

  it('returns the whole input unmatched with no matches', () => {
    expect(buildPreviewSegments('hello', [])).toEqual([{ text: 'hello', match: false }])
  })

  it('returns nothing for empty input and no matches', () => {
    expect(buildPreviewSegments('', [])).toEqual([])
  })

  it('tolerates overlapping matches without duplicating output', () => {
    const segments = buildPreviewSegments('aaa', [
      { index: 0, text: 'aa', groups: [] },
      { index: 1, text: 'aa', groups: [] }
    ])
    expect(segments).toEqual([
      { text: 'aa', match: true },
      { text: 'a', match: false }
    ])
  })
})
