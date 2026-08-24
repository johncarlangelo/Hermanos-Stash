import { describe, expect, it } from 'vitest'
import { describeSchedule, explainCron } from './logic'

// Fixed "now" so next-run assertions are deterministic.
const NOW = new Date('2026-03-10T12:00:00') // a Tuesday, 12:00 local

describe('explainCron — valid expressions', () => {
  it('explains every minute', () => {
    const result = explainCron('* * * * *', NOW)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.description).toBe('Every minute')
      expect(result.nextRuns[0].getMinutes()).toBe((NOW.getMinutes() + 1) % 60)
    }
  })

  it('describes daily-at-08:00', () => {
    const result = explainCron('0 8 * * *', NOW)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.description).toBe('At 08:00, every day')
      const first = result.nextRuns[0]
      expect(first.getHours()).toBe(8)
      expect(first.getMinutes()).toBe(0)
      // 12:00 has passed today's 08:00 run, so the first run is tomorrow.
      expect(first.getDate()).toBe(NOW.getDate() + 1)
    }
  })

  it('describes */15 steps', () => {
    const result = explainCron('*/15 * * * *', NOW)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.description).toBe('Every 15 minutes')
      expect(result.nextRuns[0].getMinutes()).toBe(15)
    }
  })

  it('describes weekday mornings', () => {
    const result = explainCron('0 9 * * 1-5', NOW)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.description).toContain('weekdays')
      // Tuesday → the next weekday run is Wednesday at 09:00.
      expect(result.nextRuns[0].getDay()).toBe(3)
      expect(result.nextRuns.every((d) => d.getDay() >= 1 && d.getDay() <= 5)).toBe(true)
    }
  })

  it('returns exactly five ascending runs', () => {
    const result = explainCron('*/5 * * * *', NOW)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.nextRuns).toHaveLength(5)
      for (let i = 1; i < result.nextRuns.length; i++) {
        expect(result.nextRuns[i].getTime()).toBeGreaterThan(result.nextRuns[i - 1].getTime())
      }
    }
  })
})

describe('explainCron — errors', () => {
  it('rejects wrong field counts with the field guide', () => {
    const tooFew = explainCron('* * * *')
    expect(tooFew.ok).toBe(false)
    if (!tooFew.ok) expect(tooFew.error).toMatch(/5 space-separated fields/)

    const tooMany = explainCron('* * * * * *')
    expect(tooMany.ok).toBe(false)
    if (!tooMany.ok) expect(tooMany.error).toMatch(/5 space-separated fields/)
  })

  it('rejects garbage input with an actionable message', () => {
    const result = explainCron('banana split please')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(typeof result.error).toBe('string')
      expect(result.error.length).toBeGreaterThan(10)
    }
  })

  it('rejects out-of-range values with range context', () => {
    const result = explainCron('61 * * * *')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/range/i)
  })

  it('rejects empty input without crashing', () => {
    expect(explainCron('').ok).toBe(false)
    expect(explainCron('   ').ok).toBe(false)
  })
})

describe('describeSchedule fallbacks', () => {
  it('summarizes exotic expressions field by field', () => {
    const description = describeSchedule(['5', '4', '10', '6', '2'])
    expect(description).toMatch(/Minute: 5/)
    expect(description).toMatch(/June/)
    expect(description).toMatch(/Tuesday/i)
  })

  it('names single weekdays and months', () => {
    expect(describeSchedule(['30', '7', '*', '*', '0'])).toContain('every Sunday')
    expect(describeSchedule(['0', '0', '1', '1', '*'])).toContain('January')
  })
})
