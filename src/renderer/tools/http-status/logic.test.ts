import { describe, expect, it } from 'vitest'
import { HTTP_STATUSES } from './data'
import { classOf, filterStatuses } from './logic'

describe('status table', () => {
  it('contains exactly 63 codes', () => {
    expect(HTTP_STATUSES).toHaveLength(63)
  })

  it('has unique, sorted codes', () => {
    const codes = HTTP_STATUSES.map((s) => s.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect([...codes].sort((a, b) => a - b)).toEqual(codes)
  })

  it('gives every entry a name and meaning', () => {
    for (const entry of HTTP_STATUSES) {
      expect(entry.name.length).toBeGreaterThan(0)
      expect(entry.meaning.length).toBeGreaterThan(0)
    }
  })
})

describe('classOf', () => {
  it('classifies valid codes', () => {
    expect(classOf(100)).toBe(1)
    expect(classOf(204)).toBe(2)
    expect(classOf(301)).toBe(3)
    expect(classOf(404)).toBe(4)
    expect(classOf(503)).toBe(5)
    expect(classOf('404')).toBe(4)
  })

  it('returns 0 for out-of-range or non-numeric input', () => {
    expect(classOf(42)).toBe(0)
    expect(classOf(600)).toBe(0)
    expect(classOf(NaN)).toBe(0)
  })
})

describe('filterStatuses', () => {
  it('matches by code substring', () => {
    const { matches } = filterStatuses(HTTP_STATUSES, '404')
    expect(matches.map((m) => m.code)).toContain(404)
    expect(matches.every((m) => String(m.code).includes('404'))).toBe(true)
  })

  it('matches name text case-insensitively', () => {
    const { matches } = filterStatuses(HTTP_STATUSES, 'not found')
    expect(matches.map((m) => m.code)).toEqual([404])
  })

  it('matches meanings too', () => {
    const { matches } = filterStatuses(HTTP_STATUSES, 'rate limit')
    expect(matches.some((m) => m.code === 429)).toBe(true)
  })

  it('groups results by class with every class populated on empty query', () => {
    const { byClass } = filterStatuses(HTTP_STATUSES, '')
    for (const cls of [1, 2, 3, 4, 5] as const) {
      expect(byClass[cls].length).toBeGreaterThan(0)
      expect(byClass[cls].every((e) => classOf(e.code) === cls)).toBe(true)
    }
  })

  it('returns nothing for an unknown query', () => {
    const { matches } = filterStatuses(HTTP_STATUSES, 'zzz-unknown')
    expect(matches).toEqual([])
  })
})
