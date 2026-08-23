/**
 * Pure Unix timestamp parsing and formatting. Parsing auto-detects seconds
 * vs milliseconds; formatting is deterministic for fixed inputs except the
 * relative label, which accepts an injectable `nowMs`.
 */

export type ParseTimestampResult = { ms: number } | { error: string }

/**
 * Values strictly greater than this are treated as milliseconds.
 * 1e11 s ≈ year 5138 (implausible), while 1e11 ms ≈ March 1973 — the
 * conventional crossover used by many timestamp tools.
 */
export const MS_THRESHOLD = 1e11

const NUMERIC = /^[+-]?\d+(\.\d{1,6})?$/

export function parseTimestampInput(input: string): ParseTimestampResult {
  const trimmed = input.trim()
  if (!trimmed) return { error: 'Enter a Unix timestamp in seconds or milliseconds.' }
  if (!NUMERIC.test(trimmed)) {
    return { error: 'That is not a numeric timestamp. Examples: 1755936000 or 1755936000000.' }
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) {
    return { error: 'That number is too large to represent as a date.' }
  }
  // Out-of-range dates still format, but Intl renders "Invalid Date" —
  // reject them upfront with an actionable message instead.
  const ms = value > MS_THRESHOLD ? value : value * 1000
  if (!Number.isFinite(new Date(ms).getTime())) {
    return { error: 'That number is outside the range JavaScript dates support.' }
  }
  return { ms }
}

export interface TimestampParts {
  isoUtc: string
  utcString: string
  localString: string
  relative: string
}

export function formatTimestamp(ms: number): TimestampParts {
  const date = new Date(ms)
  return {
    isoUtc: date.toISOString(),
    utcString: date.toUTCString(),
    localString: new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }).format(date),
    relative: formatRelative(ms)
  }
}

export function formatRelative(ms: number, nowMs: number = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  let diffSec = Math.round((ms - nowMs) / 1000)
  const absSec = Math.abs(diffSec)

  if (absSec < 60) return rtf.format(diffSec, 'second')
  diffSec = Math.round(diffSec / 60)
  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'minute')
  diffSec = Math.round(diffSec / 60)
  if (Math.abs(diffSec) < 24) return rtf.format(diffSec, 'hour')
  diffSec = Math.round(diffSec / 24)
  if (Math.abs(diffSec) < 30) return rtf.format(diffSec, 'day')
  diffSec = Math.round(diffSec / 30)
  if (Math.abs(diffSec) < 12) return rtf.format(diffSec, 'month')
  return rtf.format(Math.round(diffSec / 12), 'year')
}
