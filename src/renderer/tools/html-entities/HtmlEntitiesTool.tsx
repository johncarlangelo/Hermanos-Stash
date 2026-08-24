import { useId, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel, SectionHeading } from '../../components/ui/Feedback'
import { TextArea } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { decodeEntities, encodeEntities, slugify } from './logic'

type Mode = 'encode' | 'decode' | 'slug'

const MODE_HINTS: Record<Mode, string> = {
  encode: 'Text → HTML-safe entities',
  decode: 'HTML entities → plain text',
  slug: 'Text → URL-safe slug'
}

export default function HtmlEntitiesTool() {
  const [mode, setMode] = useState<Mode>('encode')
  const [input, setInput] = useState('')

  const inputId = useId()
  const hasInput = input.length > 0

  const result = useMemo(() => {
    if (!hasInput) return ''
    return mode === 'encode'
      ? encodeEntities(input)
      : mode === 'decode'
        ? decodeEntities(input)
        : slugify(input)
  }, [mode, input, hasInput])

  const stats = useMemo(() => {
    if (!hasInput) return null
    return `In ${formatBytes(new TextEncoder().encode(input).length)} · Out ${formatBytes(
      new TextEncoder().encode(result).length
    )}`
  }, [input, result, hasInput])

  const copyOutput = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      toastSuccess(`${MODE_LABEL[mode]} copied to clipboard`)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Conversion mode" className="flex items-center gap-2">
        {(['encode', 'decode', 'slug'] as Mode[]).map((candidate) => (
          <Button
            key={candidate}
            size="sm"
            variant={mode === candidate ? 'primary' : 'secondary'}
            aria-pressed={mode === candidate}
            onClick={() => setMode(candidate)}
          >
            {MODE_LABEL[candidate]}
          </Button>
        ))}
        <span className="text-[11.5px] text-faint">{MODE_HINTS[mode]}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>{SOURCE_LABEL[mode]}</SectionHeading>
            {stats && (
              <span
                role="status"
                className="truncate font-mono text-[10.5px] text-faint tnum"
                title={stats}
              >
                {stats}
              </span>
            )}
          </div>
          <label htmlFor={inputId} className="sr-only">
            {SOURCE_LABEL[mode]}
          </label>
          <TextArea
            id={inputId}
            mono
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'encode'
                ? 'Café & crème — text to escape…'
                : mode === 'decode'
                  ? '&amp; &lt;tag&gt; &#233; …'
                  : 'My Great Post! (2026)'
            }
            className="h-56"
          />
        </Panel>

        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>Result</SectionHeading>
            <IconButton
              variant="surface"
              size="sm"
              aria-label="Copy result"
              disabled={!result}
              onClick={() => void copyOutput()}
            >
              <Copy size={13} />
            </IconButton>
          </div>

          {!hasInput ? (
            <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
              <p className="text-[12.5px] text-dim">Enter something on the left to convert.</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
                Decoding is a pure text transform — markup is never executed.
              </p>
            </div>
          ) : (
            <output
              aria-label={`${MODE_LABEL[mode]} result`}
              className="h-56 overflow-auto rounded-md border border-line bg-base p-3 font-mono text-[12px] leading-relaxed break-all whitespace-pre-wrap text-ink"
            >
              {result || <span className="text-faint">(empty)</span>}
            </output>
          )}
        </Panel>
      </div>

      {hasInput && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setInput('')}>
            Clear input
          </Button>
        </div>
      )}
    </div>
  )
}

const MODE_LABEL: Record<Mode, string> = {
  encode: 'Encode',
  decode: 'Decode',
  slug: 'Slug'
}

const SOURCE_LABEL: Record<Mode, string> = {
  encode: 'Plain text',
  decode: 'Encoded text',
  slug: 'Title or phrase'
}
