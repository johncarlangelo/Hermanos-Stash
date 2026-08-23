import { useId, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ErrorNote, Panel, SectionHeading, SuccessNote } from '../../components/ui/Feedback'
import { FieldRow, Select, TextArea } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { stashError, ERROR_CODES, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { formatJson, validateJson, type JsonIndent } from './logic'

type Mode = 'pretty' | 'minify' | 'validate'
type IndentChoice = '2' | '4' | '\t'

const TAB = '\t'

function toStashError(issue: { message: string; line?: number; column?: number }): StashError {
  const location =
    issue.line !== undefined && issue.column !== undefined
      ? ` (line ${issue.line}, column ${issue.column})`
      : ''
  return stashError(ERROR_CODES.VALIDATION, `${issue.message}${location}`, {
    technicalMessage: issue.message
  })
}

export default function JsonFormatTool() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<Mode>('pretty')
  const [indentChoice, setIndentChoice] = useState<IndentChoice>('2')

  const inputId = useId()
  const modeId = useId()
  const indentId = useId()

  const hasInput = input.trim().length > 0

  const indent: JsonIndent =
    mode === 'minify' ? 'minify' : indentChoice === TAB ? TAB : Number(indentChoice)

  const result = useMemo(
    () => (mode === 'validate' ? null : formatJson(input, indent)),
    [input, mode, indent]
  )
  const validation = useMemo(
    () => (mode === 'validate' ? validateJson(input) : null),
    [input, mode]
  )

  const stats = useMemo(() => {
    if (!hasInput) return null
    const encoder = new TextEncoder()
    const inputPart = `${formatBytes(encoder.encode(input).length)} · ${input.split('\n').length} lines`
    const output = mode === 'validate' ? null : result?.ok ? result.output : null
    const outputPart =
      output === null
        ? ''
        : ` · Out ${formatBytes(encoder.encode(output).length)} · ${output.split('\n').length} lines`
    return `${inputPart}${outputPart}`
  }, [input, mode, result, hasInput])

  const copyOutput = async () => {
    if (!result?.ok) return
    try {
      await navigator.clipboard.writeText(result.output)
      toastSuccess('Formatted JSON copied to clipboard')
    } catch (err) {
      toastError(err)
    }
  }

  const shownError = (() => {
    if (result && !result.ok) return toStashError(result.error)
    if (validation && !validation.valid && validation.error) {
      return toStashError(validation.error)
    }
    return null
  })()

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>JSON input</SectionHeading>
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
            JSON input
          </label>
          <TextArea
            id={inputId}
            mono
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"hello": "world"}'
            aria-invalid={Boolean(shownError)}
            className="h-56"
          />
        </Panel>

        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>{mode === 'validate' ? 'Validation' : 'Output'}</SectionHeading>
            {mode !== 'validate' && (
              <IconButton
                variant="surface"
                size="sm"
                aria-label="Copy output"
                disabled={!result?.ok || !result.output}
                onClick={() => void copyOutput()}
              >
                <Copy size={13} />
              </IconButton>
            )}
          </div>

          {!hasInput ? (
            <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
              <p className="text-[12.5px] text-dim">Paste JSON on the left to begin.</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
                Formatting happens live — nothing leaves this machine.
              </p>
            </div>
          ) : shownError ? (
            <ErrorNote error={shownError} />
          ) : validation?.valid ? (
            <SuccessNote message="Valid JSON." />
          ) : result?.ok ? (
            <output
              aria-label="Formatted JSON output"
              className="h-56 overflow-auto rounded-md border border-line bg-base p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-ink"
            >
              {result.output || <span className="text-faint">(empty)</span>}
            </output>
          ) : null}
        </Panel>
      </div>

      <Panel className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3">
        <FieldRow label="Mode" htmlFor={modeId}>
          <Select
            id={modeId}
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="w-36"
          >
            <option value="pretty">Pretty</option>
            <option value="minify">Minify</option>
            <option value="validate">Validate only</option>
          </Select>
        </FieldRow>
        {mode === 'pretty' && (
          <FieldRow label="Indent" htmlFor={indentId}>
            <Select
              id={indentId}
              value={indentChoice}
              onChange={(e) => setIndentChoice(e.target.value as IndentChoice)}
              className="w-24"
            >
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
              <option value={TAB}>Tabs</option>
            </Select>
          </FieldRow>
        )}
        {hasInput && (
          <Button size="sm" variant="ghost" onClick={() => setInput('')} className="ml-auto">
            Clear input
          </Button>
        )}
      </Panel>
    </div>
  )
}
