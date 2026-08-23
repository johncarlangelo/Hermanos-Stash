import { useId, useMemo, useState } from 'react'
import { ArrowLeftRight, Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { Input, TextArea } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { stashError, type StashError } from '../../../shared/errors'
import { toastError, toastSuccess } from '../../stores/toasts'
import { decodeComponent, encodeComponent, parseUrlComponents, type ComponentResult } from './logic'

type Mode = 'parse' | 'encode' | 'decode'

export default function UrlUtilsTool() {
  const [mode, setMode] = useState<Mode>('parse')

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="URL tool mode" className="flex items-center gap-2">
        <Button
          size="sm"
          variant={mode === 'parse' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'parse'}
          onClick={() => setMode('parse')}
        >
          Parse
        </Button>
        <Button
          size="sm"
          variant={mode === 'encode' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'encode'}
          onClick={() => setMode('encode')}
        >
          Encode
        </Button>
        <Button
          size="sm"
          variant={mode === 'decode' ? 'primary' : 'secondary'}
          aria-pressed={mode === 'decode'}
          onClick={() => setMode('decode')}
        >
          Decode
        </Button>
      </div>

      {mode === 'parse' ? <ParseView /> : <CodecView mode={mode} />}
    </div>
  )
}

function CopyRow({ value, label }: { value: string; label: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      toastSuccess(`${label} copied`)
    } catch (err) {
      toastError(err)
    }
  }
  return (
    <IconButton
      variant="ghost"
      size="sm"
      aria-label={`Copy ${label.toLowerCase()}`}
      onClick={() => void copy()}
    >
      <Copy size={12} />
    </IconButton>
  )
}

function ParseView() {
  const [input, setInput] = useState('')
  const inputId = useId()

  const parsed = useMemo(() => (input.trim() ? parseUrlComponents(input) : null), [input])

  const error: StashError | null =
    parsed && !parsed.ok ? stashError('VALIDATION', parsed.error) : null

  const rows = parsed?.ok
    ? ([
        ['href', parsed.parts.href],
        ['protocol', parsed.parts.protocol],
        ['host', parsed.parts.host],
        ['hostname', parsed.parts.hostname],
        ...(parsed.parts.port !== undefined ? [['port', parsed.parts.port] as const] : []),
        ['pathname', parsed.parts.pathname],
        ['search', parsed.parts.search],
        ['hash', parsed.parts.hash],
        ['origin', parsed.parts.origin]
      ] as Array<readonly [string, string]>)
    : []

  return (
    <Panel className="p-3.5">
      <SectionHeading>URL</SectionHeading>
      <div className="mt-2 mb-2.5">
        <label htmlFor={inputId} className="sr-only">
          URL to inspect
        </label>
        <Input
          id={inputId}
          mono
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://example.com/path?query=1#hash — https:// is added if missing"
          aria-invalid={Boolean(error)}
        />
      </div>

      {!parsed ? (
        <p className="py-3 text-center text-[12px] text-faint">
          Type a URL above to break it into its components.
        </p>
      ) : error ? (
        <ErrorNote error={error} />
      ) : (
        <>
          <div
            className="rounded-md border border-line bg-base"
            role="table"
            aria-label="URL components"
          >
            {rows.map(([key, value]) => (
              <div
                key={key}
                className="flex min-w-0 items-center gap-3 border-b border-line/60 px-3 py-1.5 last:border-b-0"
              >
                <span className="w-20 shrink-0 text-[11.5px] text-faint">{key}</span>
                <span
                  className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink tnum"
                  title={value}
                >
                  {value || <span className="text-faint">(empty)</span>}
                </span>
                <CopyRow value={value} label={`${key} component`} />
              </div>
            ))}
          </div>

          {parsed.ok && parsed.parts.searchParams.length > 0 && (
            <div className="mt-3">
              <SectionHeading>Query parameters</SectionHeading>
              <ul
                className="mt-1.5 rounded-md border border-line bg-base"
                aria-label="Query parameters"
              >
                {parsed.parts.searchParams.map((param, i) => (
                  <li
                    key={`${param.key}-${i}`}
                    className="flex min-w-0 items-center gap-3 border-b border-line/60 px-3 py-1.5 last:border-b-0"
                  >
                    <span className="shrink-0 font-mono text-[12px] text-dim">{param.key}</span>
                    <span className="text-faint">=</span>
                    <span
                      className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink"
                      title={param.value}
                    >
                      {param.value || <span className="text-faint">(empty)</span>}
                    </span>
                    <CopyRow value={param.value} label={`value of "${param.key}"`} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  )
}

function CodecView({ mode }: { mode: 'encode' | 'decode' }) {
  const [input, setInput] = useState('')
  const hasInput = input.length > 0

  const result: ComponentResult | null = useMemo(
    () => (hasInput ? (mode === 'encode' ? encodeComponent(input) : decodeComponent(input)) : null),
    [input, mode, hasInput]
  )

  const swap = () => {
    // Carry the current output over so the user can reverse it immediately.
    if (result?.ok) setInput(result.output)
  }

  const copyOutput = async () => {
    if (!result?.ok) return
    try {
      await navigator.clipboard.writeText(result.output)
      toastSuccess(`${mode === 'encode' ? 'Encoded' : 'Decoded'} text copied to clipboard`)
    } catch (err) {
      toastError(err)
    }
  }

  const error: StashError | null =
    result && !result.ok ? stashError('VALIDATION', result.error) : null

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-3.5">
        <SectionHeading>{mode === 'encode' ? 'Plain text' : 'Percent-encoded'}</SectionHeading>
        <label htmlFor="url-codec-input" className="sr-only">
          {mode === 'encode' ? 'Plain text to encode' : 'Percent-encoded text to decode'}
        </label>
        <TextArea
          id="url-codec-input"
          mono
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            mode === 'encode' ? 'Type or paste any UTF-8 text…' : 'hello%20world%2Fpath…'
          }
          aria-invalid={Boolean(error)}
          className="mt-2 h-56"
        />
      </Panel>

      <Panel className="relative p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <SectionHeading>{mode === 'encode' ? 'Percent-encoded' : 'Decoded text'}</SectionHeading>
          <IconButton
            variant="surface"
            size="sm"
            aria-label="Copy output"
            disabled={!result?.ok}
            onClick={() => void copyOutput()}
          >
            <Copy size={13} />
          </IconButton>
        </div>

        {!hasInput ? (
          <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
            <p className="text-[12.5px] text-dim">Enter something on the left to {mode}.</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
              Uses encodeURIComponent semantics — safe for URLs and query values.
            </p>
          </div>
        ) : error ? (
          <ErrorNote error={error} />
        ) : (
          <output
            aria-label={`${mode}d output`}
            className="h-56 overflow-auto rounded-md border border-line bg-base p-3 font-mono text-[12px] leading-relaxed break-all whitespace-pre-wrap text-ink"
          >
            {(result?.ok && result.output) || <span className="text-faint">(empty)</span>}
          </output>
        )}

        {hasInput && (
          <IconButton
            className="absolute top-11 right-3.5 lg:-right-10 lg:top-1/2 lg:-translate-y-1/2"
            variant="surface"
            size="sm"
            aria-label="Swap directions and carry output into the input"
            title="Swap directions"
            disabled={!result?.ok}
            onClick={swap}
          >
            <ArrowLeftRight size={13} />
          </IconButton>
        )}
      </Panel>
    </div>
  )
}
