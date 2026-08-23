import { useEffect, useId, useState } from 'react'
import { Copy } from 'lucide-react'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { Input } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { stashError, type StashError } from '../../../shared/errors'
import { toastError, toastSuccess } from '../../stores/toasts'
import { formatTimestamp, parseTimestampInput, type TimestampParts } from './logic'

export default function TimestampConverterTool() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <NowCard nowMs={now} />
      <LiveConverter />
      <ReverseConverter />
    </div>
  )
}

function NowCard({ nowMs }: { nowMs: number }) {
  const parts = formatTimestamp(nowMs)
  const copyIso = async () => {
    try {
      await navigator.clipboard.writeText(parts.isoUtc)
      toastSuccess('Current ISO timestamp copied')
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <Panel className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5 px-3.5 py-3">
      <span className="font-mono text-[10.5px] tracking-[0.08em] text-faint uppercase">Now</span>
      <span className="tnum font-mono text-[13px] text-ink">{parts.isoUtc}</span>
      <span className="tnum text-[12px] text-dim">{Math.floor(nowMs / 1000)} s</span>
      <span className="tnum text-[12px] text-dim">{nowMs} ms</span>
      <IconButton
        className="ml-auto self-center"
        variant="surface"
        size="sm"
        aria-label="Copy current time as ISO string"
        onClick={() => void copyIso()}
      >
        <Copy size={13} />
      </IconButton>
    </Panel>
  )
}

function LiveConverter() {
  const [input, setInput] = useState('')
  const inputId = useId()

  const parsed = input.trim().length > 0 ? parseTimestampInput(input) : null
  const parts: TimestampParts | null = parsed && 'ms' in parsed ? formatTimestamp(parsed.ms) : null

  const error: StashError | null =
    parsed && 'error' in parsed ? stashError('VALIDATION', parsed.error) : null

  return (
    <Panel className="p-3.5">
      <SectionHeading>Unix timestamp → date</SectionHeading>
      <div className="mt-2 mb-2.5">
        <label htmlFor={inputId} className="sr-only">
          Unix timestamp in seconds or milliseconds
        </label>
        <Input
          id={inputId}
          mono
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="1755936000 — seconds or milliseconds are detected automatically"
          aria-invalid={Boolean(error)}
        />
      </div>

      {!parsed ? (
        <p className="py-3 text-center text-[12px] text-faint">
          Type a timestamp above — values over 100 billion are treated as milliseconds.
        </p>
      ) : error ? (
        <ErrorNote error={error} />
      ) : (
        parts && (
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <ResultRow label="ISO (UTC)" value={parts.isoUtc} mono />
            <ResultRow label="UTC" value={parts.utcString} />
            <ResultRow label="Local" value={parts.localString} />
            <ResultRow label="Relative" value={parts.relative} />
          </div>
        )
      )}
    </Panel>
  )
}

function ReverseConverter() {
  const [value, setValue] = useState('')

  let unixSeconds: number | null = null
  if (value) {
    const ms = new Date(value).getTime()
    if (!Number.isNaN(ms)) unixSeconds = Math.floor(ms / 1000)
  }

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toastSuccess(`${label} copied`)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <Panel className="p-3.5">
      <SectionHeading>Date → Unix timestamp</SectionHeading>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label htmlFor="reverse-date" className="text-[12px] text-faint">
          Local date &amp; time
        </label>
        <input
          id="reverse-date"
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8.5 rounded-md border border-line bg-base px-2.5 text-[13px] text-ink transition-colors duration-150 ease-out hover:border-line-strong focus:border-accent/70 focus:outline-none"
        />
        {unixSeconds !== null ? (
          <>
            <ResultRow
              label="Seconds"
              value={String(unixSeconds)}
              mono
              copyable
              onCopy={() => void copy(String(unixSeconds), 'Unix seconds')}
            />
            <ResultRow
              label="Milliseconds"
              value={String(unixSeconds * 1000)}
              mono
              copyable
              onCopy={() => void copy(String(unixSeconds! * 1000), 'Unix milliseconds')}
            />
          </>
        ) : (
          <span aria-live="polite" className="text-[12px] text-faint">
            Pick a date and time to get its Unix values.
          </span>
        )}
      </div>
    </Panel>
  )
}

function ResultRow({
  label,
  value,
  mono = false,
  copyable = false,
  onCopy
}: {
  label: string
  value: string
  mono?: boolean
  copyable?: boolean
  onCopy?: () => void
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 py-0.5">
      <span className="w-24 shrink-0 text-right text-[11.5px] text-faint">{label}</span>
      <span
        className={`min-w-0 flex-1 truncate ${mono ? 'font-mono' : ''} tnum text-[12.5px] text-ink`}
        title={value}
      >
        {value}
      </span>
      {copyable && onCopy && (
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={`Copy ${label.toLowerCase()} value`}
          onClick={onCopy}
        >
          <Copy size={12} />
        </IconButton>
      )}
    </div>
  )
}
