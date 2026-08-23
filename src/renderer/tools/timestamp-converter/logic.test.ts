import { describe, expect, it } from 'vitest'
import { formatRelative, formatTimestamp, MS_THRESHOLD, parseTimestampInput } from './logic'
import type { ParseTimestampResult } from './logic'

/** Narrow to the error branch or fail loudly. */
function errorOf(result: ParseTimestampResult): string {
  if ('error' in result) return result.error
  throw new Error('expected a parse error')
}

describe('parseTimestampInput — seconds vs milliseconds', () => {
  it('treats small positive values as seconds', () => {
    const r = parseTimestampInput('1755936000')
    expect(r).toEqual({ ms: 1755936000000 })
  })

  it('treats values above the threshold as milliseconds', () => {
    const r = parseTimestampInput(String(1.5e12))
    expect(r).toEqual({ ms: 1.5e12 })
  })

  it('uses > (not >=) at the boundary: exactly 1e11 is seconds', () => {
    expect(parseTimestampInput(String(MS_THRESHOLD))).toEqual({ ms: MS_THRESHOLD * 1000 })
    expect(parseTimestampInput(String(MS_THRESHOLD + 1))).toEqual({ ms: MS_THRESHOLD + 1 })
  })

  it('allows negative epochs (pre-1970)', () => {
    expect(parseTimestampInput('-86400')).toEqual({ ms: -86400000 })
  })

  it('rejects empty input', () => {
    expect(errorOf(parseTimestampInput('   '))).toBeTruthy()
  })

  it('rejects garbage input', () => {
    for (const bad of ['abc', '12x', '2026-08-23', '--5', '1..2']) {
      expect(errorOf(parseTimestampInput(bad)), `input "${bad}"`).toBeTruthy()
    }
  })

  it('rejects numbers outside the JS date range', () => {
    expect(errorOf(parseTimestampInput('99999999999999999999'))).toBeTruthy()
  })

  it('accepts a leading + sign', () => {
    expect(parseTimestampInput('+1755936000')).toEqual({ ms: 1755936000000 })
  })
})

describe('formatTimestamp — deterministic fields', () => {
  const ms = Date.UTC(2026, 7, 23, 12, 30, 45)
  const parts = formatTimestamp(ms)

  it('renders the exact ISO UTC string', () => {
    expect(parts.isoUtc).toBe('2026-08-23T12:30:45.000Z')
  })

  it('renders the classic UTC string', () => {
    expect(parts.utcString).toContain('2026')
    expect(parts.utcString.endsWith('GMT')).toBe(true)
  })

  it('produces a non-empty local string', () => {
    expect(typeof parts.localString).toBe('string')
    expect(parts.localString.length).toBeGreaterThan(0)
  })
})

describe('formatRelative — sanity ranges with fixed now', () => {
  const nowMs = Date.UTC(2026, 7, 23, 12, 0, 0)

  it('says "in 3 days" style output for future dates', () => {
    const label = formatRelative(nowMs + 3 * 86_400_000, nowMs)
    expect(label).toMatch(/in\s+3\s+days/i)
  })

  it('says "ago" phrasing for past dates', () => {
    const label = formatRelative(nowMs - 5 * 3_600_000, nowMs)
    expect(label.toLowerCase()).toContain('hour')
    expect(label.toLowerCase()).toContain('ago')
  })

  it('stays within the same minute near now', () => {
    const label = formatRelative(nowMs + 20_000, nowMs)
    expect(label.toLowerCase()).toContain('second')
  })

  it('escalates to years for very old dates', () => {
    const label = formatRelative(nowMs - 400 * 86_400_000, nowMs)
    expect(label.toLowerCase()).toContain('year')
  })
})
