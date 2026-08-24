import { useEffect, useId, useMemo, useState } from 'react'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { Input } from '../../components/ui/Inputs'
import { Button } from '../../components/ui/Button'
import { stashError, ERROR_CODES } from '../../../shared/errors'
import { explainCron } from './logic'

const DEBOUNCE_MS = 200

const PRESETS: Array<[string, string]> = [
  ['Every minute', '* * * * *'],
  ['Hourly', '0 * * * *'],
  ['Daily 08:00', '0 8 * * *'],
  ['Weekdays 09:00', '0 9 * * 1-5'],
  ['Monthly', '0 0 1 * *']
]

const RUN_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

export default function CronHelperTool() {
  const [input, setInput] = useState('')
  const [debounced, setDebounced] = useState('')
  const inputId = useId()

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input])

  // Recompute when the clock ticks so "next runs" stay ahead of time.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const result = useMemo(
    () => (debounced.trim() ? explainCron(debounced, now) : null),
    [debounced, now]
  )

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-3.5">
        <SectionHeading>Cron expression</SectionHeading>
        <div className="mt-2 mb-2.5 flex flex-wrap items-center gap-2">
          <label htmlFor={inputId} className="sr-only">
            Cron expression — five fields: minute hour day month weekday
          </label>
          <Input
            id={inputId}
            mono
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="*/15 * * * *"
            aria-invalid={Boolean(result && !result.ok)}
            className="max-w-xs"
          />
          <span className="text-[11px] text-faint">minute · hour · day · month · weekday</span>
        </div>

        <div role="group" aria-label="Common schedules" className="flex flex-wrap gap-1.5">
          {PRESETS.map(([label, expr]) => (
            <Button key={expr} size="sm" variant="secondary" onClick={() => setInput(expr)}>
              {label}
            </Button>
          ))}
        </div>
      </Panel>

      {!result ? (
        <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
          <p className="text-[12.5px] text-dim">Type a cron expression or pick a preset above.</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
            You will get a plain-language schedule and the next five run times.
          </p>
        </div>
      ) : result && !result.ok ? (
        <Panel className="p-3.5">
          <ErrorNote error={stashError(ERROR_CODES.VALIDATION, result.error)} />
        </Panel>
      ) : result && result.ok ? (
        <Panel className="p-3.5">
          <SectionHeading>Schedule</SectionHeading>
          <p aria-live="polite" className="mt-2 text-[14px] font-medium text-ink">
            {result.description}
          </p>

          <h3 className="mt-4 mb-2 text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">
            Next runs
          </h3>
          <ol
            aria-label="Next five scheduled runs"
            className="flex flex-col divide-y divide-line/60"
          >
            {result.nextRuns.map((date, index) => (
              <li
                key={date.toISOString()}
                className="flex items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0"
              >
                <span className="tnum w-6 shrink-0 text-right font-mono text-[11px] text-faint">
                  {index + 1}
                </span>
                <time dateTime={date.toISOString()} className="tnum text-[12.5px] text-ink">
                  {RUN_FORMAT.format(date)}
                </time>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </div>
  )
}
