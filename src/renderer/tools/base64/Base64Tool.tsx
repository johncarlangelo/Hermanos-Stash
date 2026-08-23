import { useId, useMemo, useState } from 'react'
import { ArrowLeftRight, Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { TextArea } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { stashError, ERROR_CODES, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { decodeBase64Utf8, encodeBase64Utf8 } from './logic'

type Direction = 'encode' | 'decode'

export default function Base64Tool() {
  const [direction, setDirection] = useState<Direction>('encode')
  const [input, setInput] = useState('')

  const inputId = useId()
  const hasInput = input.length > 0

  const result = useMemo(
    () => (hasInput ? run(direction, input) : null),
    [direction, input, hasInput]
  )

  const stats = useMemo(() => {
    if (!hasInput) return null
    const inBytes = formatBytes(new TextEncoder().encode(input).length)
    if (!result?.ok) return `${direction === 'encode' ? 'Text' : 'Base64'} · ${inBytes}`
    const outLabel = direction === 'encode' ? 'Base64' : 'Text'
    const outBytes = new TextEncoder().encode(result.output).length
    return `In ${inBytes} · Out ${formatBytes(outBytes)} ${outLabel}`
  }, [input, direction, result, hasInput])

  const swap = () => {
    const nextDirection: Direction = direction === 'encode' ? 'decode' : 'encode'
    // Carry the current output over so the user can immediately reverse it.
    setInput(result?.ok ? result.output : input)
    setDirection(nextDirection)
  }

  const copyOutput = async () => {
    if (!result?.ok) return
    try {
      await navigator.clipboard.writeText(result.output)
      toastSuccess(`${direction === 'encode' ? 'Encoded' : 'Decoded'} text copied to clipboard`)
    } catch (err) {
      toastError(err)
    }
  }

  const error: StashError | null =
    result && !result.ok ? stashError(ERROR_CODES.VALIDATION, result.error) : null

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Conversion direction" className="flex items-center gap-2">
        <Button
          size="sm"
          variant={direction === 'encode' ? 'primary' : 'secondary'}
          aria-pressed={direction === 'encode'}
          onClick={() => setDirection('encode')}
        >
          Encode
        </Button>
        <Button
          size="sm"
          variant={direction === 'decode' ? 'primary' : 'secondary'}
          aria-pressed={direction === 'decode'}
          onClick={() => setDirection('decode')}
        >
          Decode
        </Button>
        <span className="text-[11.5px] text-faint">
          {direction === 'encode' ? 'UTF-8 text → Base64' : 'Base64 → UTF-8 text'}
        </span>
        <IconButton
          className="ml-auto"
          variant="surface"
          size="sm"
          aria-label="Swap directions and carry output into the input"
          title="Swap directions"
          onClick={swap}
        >
          <ArrowLeftRight size={13} />
        </IconButton>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>
              {direction === 'encode' ? 'Plain text' : 'Base64 input'}
            </SectionHeading>
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
            {direction === 'encode' ? 'Plain text to encode' : 'Base64 payload to decode'}
          </label>
          <TextArea
            id={inputId}
            mono
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              direction === 'encode' ? 'Type or paste any UTF-8 text…' : 'Paste a Base64 payload…'
            }
            aria-invalid={Boolean(error)}
            className="h-56"
          />
        </Panel>

        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>
              {direction === 'encode' ? 'Base64 output' : 'Decoded text'}
            </SectionHeading>
            <IconButton
              variant="surface"
              size="sm"
              aria-label="Copy output"
              disabled={!result || !result.ok || result.output.length === 0}
              onClick={() => void copyOutput()}
            >
              <Copy size={13} />
            </IconButton>
          </div>

          {!hasInput ? (
            <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
              <p className="text-[12.5px] text-dim">Enter something on the left to {direction}.</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
                Unicode-safe encoding — emoji and CJK round-trip correctly.
              </p>
            </div>
          ) : error ? (
            <ErrorNote error={error} />
          ) : (
            <output
              aria-label={`${direction}ed output`}
              className="h-56 overflow-auto rounded-md border border-line bg-base p-3 font-mono text-[12px] leading-relaxed break-all whitespace-pre-wrap text-ink"
            >
              {(result && result.ok && result.output) || (
                <span className="text-faint">(empty)</span>
              )}
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

function run(direction: Direction, input: string) {
  return direction === 'encode' ? encodeBase64Utf8(input) : decodeBase64Utf8(input)
}
