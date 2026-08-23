import { useEffect, useId, useMemo, useState } from 'react'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { Input, TextArea } from '../../components/ui/Inputs'
import { Button } from '../../components/ui/Button'
import { buildPreviewSegments, testRegex } from './logic'

const MAX_MATCHES = 200
/** Live-run debounce so typing stays smooth on large inputs. */
const DEBOUNCE_MS = 150
/** Display order for the flag toggles (most-used first). */
const FLAG_ORDER = ['g', 'i', 'm', 's', 'u', 'y', 'd']

const FLAG_HINTS: Record<string, string> = {
  g: 'global — find all matches',
  i: 'ignore case',
  m: 'multiline anchors',
  s: 'dot matches newlines',
  u: 'unicode mode',
  y: 'sticky matching',
  d: 'capture group indices'
}

export default function RegexTesterTool() {
  const [patternInput, setPatternInput] = useState('')
  const [data, setData] = useState('')
  const [flags, setFlags] = useState('g')

  // Debounced copies of the text inputs drive the live evaluation.
  const [pattern, setPattern] = useState('')
  const [debouncedData, setDebouncedData] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setPattern(patternInput)
      setDebouncedData(data)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [patternInput, data])

  const patternId = useId()
  const dataId = useId()

  const hasInput = patternInput.length > 0 || data.length > 0

  const result = useMemo(
    () => testRegex(pattern, flags, debouncedData, { maxMatches: MAX_MATCHES }),
    [pattern, flags, debouncedData]
  )

  const segments = useMemo(
    () => (result.error ? [] : buildPreviewSegments(debouncedData, result.matches)),
    [result, debouncedData]
  )

  const capped = result.total >= MAX_MATCHES
  const toggleFlag = (flag: string) => {
    setFlags((current) => (current.includes(flag) ? current.replace(flag, '') : current + flag))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-3.5">
          <SectionHeading>Pattern</SectionHeading>
          <div className="mt-2 mb-2.5">
            <label htmlFor={patternId} className="sr-only">
              Regular expression pattern
            </label>
            <Input
              id={patternId}
              mono
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              placeholder="\d{4}-(?<month>[a-z]+)"
              aria-invalid={Boolean(result.error)}
            />
          </div>

          <div
            role="group"
            aria-label="Regular expression flags"
            className="flex flex-wrap items-center gap-1.5"
          >
            {FLAG_ORDER.map((flag) => (
              <Button
                key={flag}
                size="sm"
                variant={flags.includes(flag) ? 'primary' : 'secondary'}
                aria-pressed={flags.includes(flag)}
                title={FLAG_HINTS[flag]}
                aria-label={`Flag ${flag}: ${FLAG_HINTS[flag]}`}
                onClick={() => toggleFlag(flag)}
                className="w-8 px-0"
              >
                {flag}
              </Button>
            ))}
          </div>

          <div className="mt-3 mb-2">
            <label htmlFor={dataId} className="sr-only">
              Test data to match against
            </label>
            <TextArea
              id={dataId}
              mono
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder="Paste the text to test against…"
              className="h-40"
            />
          </div>
        </Panel>

        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>Results</SectionHeading>
          </div>

          {!hasInput ? (
            <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
              <p className="text-[12.5px] text-dim">Write a pattern and some test data.</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
                Matches update live as you type — nothing leaves this machine.
              </p>
            </div>
          ) : (
            <>
              <p role="status" aria-live="polite" className="mb-2 text-[12px] text-dim tnum">
                {result.error
                  ? 'Cannot run the current pattern.'
                  : capped
                    ? `${MAX_MATCHES}+ matches (showing first ${MAX_MATCHES})`
                    : `${result.total} ${result.total === 1 ? 'match' : 'matches'}`}
              </p>

              {result.error ? (
                <ErrorNote
                  error={{
                    code: 'VALIDATION',
                    userMessage: result.error,
                    recoverable: true
                  }}
                />
              ) : (
                <>
                  {segments.length > 0 && (
                    <div
                      aria-label="Highlighted matches preview"
                      className="mb-2.5 max-h-28 overflow-auto rounded-md border border-line bg-base p-2.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-ink"
                    >
                      {segments.map((segment, i) =>
                        segment.match ? (
                          <span key={i} className="rounded-xs bg-accent-soft text-accent">
                            {segment.text}
                          </span>
                        ) : (
                          <span key={i}>{segment.text}</span>
                        )
                      )}
                    </div>
                  )}

                  {result.matches.length === 0 ? (
                    <p className="py-6 text-center text-[12px] text-faint">
                      No matches in the current test data.
                    </p>
                  ) : (
                    <ul
                      aria-label="Match list"
                      className="max-h-44 overflow-auto rounded-md border border-line bg-base"
                    >
                      {result.matches.map((match, i) => (
                        <li
                          key={`${match.index}-${i}`}
                          className="flex items-baseline gap-3 border-b border-line/60 px-2.5 py-1.5 last:border-b-0"
                        >
                          <span className="shrink-0 font-mono text-[10.5px] text-faint tnum">
                            @{match.index}
                          </span>
                          <span
                            className="min-w-0 truncate font-mono text-[12px] text-ink"
                            title={match.text || '(empty match)'}
                          >
                            {match.text || <span className="text-faint">(empty)</span>}
                          </span>
                          {(match.groups.length > 0 || match.named) && (
                            <span
                              className="ml-auto shrink-0 truncate font-mono text-[10.5px] text-faint"
                              title={
                                [
                                  ...match.groups.map((g) => `"${g}"`),
                                  ...(match.named
                                    ? Object.entries(match.named).map(([k, v]) => `${k}: "${v}"`)
                                    : [])
                                ].join(', ') || undefined
                              }
                            >
                              {[
                                ...match.groups.map((g) => `"${g}"`),
                                ...(match.named
                                  ? Object.entries(match.named).map(([k, v]) => `${k}: "${v}"`)
                                  : [])
                              ].join(' · ')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}
