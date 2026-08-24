/**
 * Pure cron expression explanation. `cron-parser` validates the expression
 * and computes upcoming runs; the friendly description is derived from the
 * raw fields so it stays deterministic and testable.
 */

import { CronExpressionParser } from 'cron-parser'

export type CronExplanation =
  { ok: true; description: string; nextRuns: Date[] } | { ok: false; error: string }

export const FIELD_GUIDE = 'Cron has 5 space-separated fields: minute hour day month weekday.'

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/** Explain a standard 5-field cron expression and list its next five runs. */
export function explainCron(expr: string, now: Date = new Date()): CronExplanation {
  const trimmed = expr.trim()
  if (!trimmed) {
    return { ok: false, error: 'Enter a cron expression to see its schedule.' }
  }

  const fields = trimmed.split(/\s+/)
  if (fields.length !== 5) {
    return { ok: false, error: FIELD_GUIDE }
  }

  let iterator: ReturnType<typeof CronExpressionParser.parse>
  try {
    iterator = CronExpressionParser.parse(trimmed, { currentDate: now })
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    return { ok: false, error: humanizeCronError(raw) }
  }

  const nextRuns: Date[] = []
  for (let i = 0; i < 5; i++) nextRuns.push(iterator.next().toDate())

  return { ok: true, description: describeSchedule(fields), nextRuns }
}

function humanizeCronError(raw: string): string {
  if (/expected range/i.test(raw)) {
    const rangeMatch = /expected range (\d+)-(\d+)/.exec(raw)
    if (rangeMatch) {
      return `A value is out of range for one of the fields — allowed values run ${rangeMatch[1]} to ${rangeMatch[2]}. ${FIELD_GUIDE}`
    }
    return `One of the field values is out of range. ${FIELD_GUIDE}`
  }
  if (/alias|invalid/i.test(raw)) {
    return `That does not look like a valid cron expression. ${FIELD_GUIDE}`
  }
  return `${raw} — check that each of the five fields is valid.`
}

/**
 * Build a plain-language sentence from the raw fields. Recognizes the
 * common shapes (wildcard, steps like "every 15", single values, ranges,
 * lists); anything more exotic falls back to a field-by-field summary.
 */
export function describeSchedule(fields: string[]): string {
  const [minute, hour, dom, month, dow] = fields

  if (isWildcard(minute, hour, dom, month, dow)) return 'Every minute'

  // Steps over all minutes/hours.
  const minuteStep = stepValue(minute)
  if (minuteStep && hour === '*' && isWildcard(dom, month, dow)) {
    return `Every ${minuteStep} minutes`
  }
  const hourStep = stepValue(hour)
  if (hourStep && minute === '0' && isWildcard(dom, month, dow)) {
    return `Every ${hourStep} hours, on the hour`
  }

  // A fixed time of day.
  const time = timeOfDay(minute, hour)
  if (time) {
    if (isWildcard(dom, month, dow)) return `${time}, every day`
    if (dom === '*' && month === '*') {
      const days = describeDays(dow)
      if (days) return `${time}, ${days}`
    }
  }

  const parts = [
    partFor('Minute', minute),
    partFor('Hour', hour),
    partFor('Day of month', dom),
    partFor('Month', describeMonths(month)),
    partFor('Day of week', describeDays(dow))
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : 'Custom schedule'
}

function isWildcard(...fields: string[]): boolean {
  return fields.every((f) => f === '*')
}

function stepValue(field: string): number | null {
  const match = /^\*\/(\d{1,2})$/.exec(field)
  return match ? Number(match[1]) : null
}

/** "08" + "30" → "At 08:30", or null when either field is not a plain value. */
function timeOfDay(minute: string, hour: string): string | null {
  if (!/^\d{1,2}$/.test(minute) || !/^\d{1,2}$/.test(hour)) return null
  const h = String(Number(hour)).padStart(2, '0')
  const m = String(Number(minute)).padStart(2, '0')
  return `At ${h}:${m}`
}

function describeDays(dow: string): string | null {
  if (dow === '*') return null
  if (dow === '1-5') return 'on weekdays'
  if (dow === '6,0' || dow === '0,6') return 'on weekends'
  const values = expandList(dow)
  if (!values || !values.every((v) => v >= 0 && v <= 7)) return null
  const names = [...new Set(values.map((v) => WEEKDAY_NAMES[v % 7]))]
  if (names.some((n) => n === undefined)) return null
  return names.length === 1 ? `every ${names[0]}` : `on ${joinList(names)}`
}

function describeMonths(month: string): string | null {
  if (month === '*') return null
  const values = expandList(month)
  if (!values || !values.every((v) => v >= 1 && v <= 12)) return null
  const names = [...new Set(values.map((v) => MONTH_NAMES[v - 1]))]
  if (names.some((n) => n === undefined)) return null
  return joinList(names)
}

/** Expand "1-3" / "1,3" / "7" into numeric values; null on anything else. */
function expandList(field: string): number[] | null {
  const tokens = field.split(',')
  const values: number[] = []
  for (const token of tokens) {
    const range = /^(\d+)-(\d+)$/.exec(token)
    if (range) {
      for (let v = Number(range[1]); v <= Number(range[2]); v++) values.push(v)
    } else if (/^\d+$/.test(token)) {
      values.push(Number(token))
    } else {
      return null
    }
  }
  return values
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function partFor(label: string, value: string | null): string | null {
  if (value === null || value === '*') return null
  return `${label}: ${value}`
}
