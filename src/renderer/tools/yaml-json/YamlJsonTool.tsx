import { useId, useMemo, useState } from 'react'
import { ArrowLeftRight, Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { TextArea } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { stashError, ERROR_CODES, type StashError } from '../../../shared/errors'
import { toastError, toastSuccess } from '../../stores/toasts'
import { jsonToYaml, yamlToJson, type ConvertResult } from './logic'

type Direction = 'yaml-to-json' | 'json-to-yaml'

const LABELS = {
  'yaml-to-json': { source: 'YAML input', target: 'JSON output', hint: 'YAML → JSON' },
  'json-to-yaml': { source: 'JSON input', target: 'YAML output', hint: 'JSON → YAML' }
} as const

function toStashError(issue: { message: string; line?: number; column?: number }): StashError {
  const location =
    issue.line !== undefined && issue.column !== undefined
      ? ` (line ${issue.line}, column ${issue.column})`
      : ''
  return stashError(ERROR_CODES.VALIDATION, `${issue.message}${location}`, {
    technicalMessage: issue.message
  })
}

export default function YamlJsonTool() {
  const [direction, setDirection] = useState<Direction>('yaml-to-json')
  const [input, setInput] = useState('')

  const inputId = useId()
  const hasInput = input.length > 0

  const result = useMemo<ConvertResult | null>(
    () => (hasInput ? run(direction, input) : null),
    [direction, input, hasInput]
  )

  const stats = useMemo(() => {
    if (!hasInput) return null
    const lines = input.split('\n').length
    if (!result?.ok) return `${lines} lines`
    return `${lines} in · ${result.output.split('\n').length} out`
  }, [input, result, hasInput])

  const swap = () => {
    const next: Direction = direction === 'yaml-to-json' ? 'json-to-yaml' : 'yaml-to-json'
    // Carry the output over so the user can immediately reverse it.
    setInput(result?.ok ? result.output : input)
    setDirection(next)
  }

  const copyOutput = async () => {
    if (!result?.ok) return
    try {
      await navigator.clipboard.writeText(result.output)
      toastSuccess(`${direction === 'yaml-to-json' ? 'JSON' : 'YAML'} copied to clipboard`)
    } catch (err) {
      toastError(err)
    }
  }

  const error = result && !result.ok ? toStashError(result.error) : null
  const labels = LABELS[direction]

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Conversion direction" className="flex items-center gap-2">
        <Button
          size="sm"
          variant={direction === 'yaml-to-json' ? 'primary' : 'secondary'}
          aria-pressed={direction === 'yaml-to-json'}
          onClick={() => setDirection('yaml-to-json')}
        >
          YAML → JSON
        </Button>
        <Button
          size="sm"
          variant={direction === 'json-to-yaml' ? 'primary' : 'secondary'}
          aria-pressed={direction === 'json-to-yaml'}
          onClick={() => setDirection('json-to-yaml')}
        >
          JSON → YAML
        </Button>
        <span className="text-[11.5px] text-faint">{labels.hint}</span>
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
            <SectionHeading>{labels.source}</SectionHeading>
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
            {labels.source}
          </label>
          <TextArea
            id={inputId}
            mono
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              direction === 'yaml-to-json'
                ? 'name: hermanos\nversion: 1\nitems:\n  - a\n  - b'
                : '{"name": "hermanos", "version": 1}'
            }
            aria-invalid={Boolean(error)}
            className="h-56"
          />
        </Panel>

        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>{labels.target}</SectionHeading>
            <IconButton
              variant="surface"
              size="sm"
              aria-label="Copy output"
              disabled={!result?.ok || !result.output}
              onClick={() => void copyOutput()}
            >
              <Copy size={13} />
            </IconButton>
          </div>

          {!hasInput ? (
            <EmptyStateForDirection direction={direction} />
          ) : error ? (
            <ErrorNote error={error} />
          ) : (
            <output
              aria-label={`${labels.target}`}
              className="h-56 overflow-auto rounded-md border border-line bg-base p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-ink"
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

function EmptyStateForDirection({ direction }: { direction: Direction }) {
  return direction === 'yaml-to-json' ? (
    <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
      <p className="text-[12.5px] text-dim">Paste YAML on the left to convert it.</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
        Conversion happens live — duplicate keys are reported instead of silently overridden.
      </p>
    </div>
  ) : (
    <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
      <p className="text-[12.5px] text-dim">Paste JSON on the left to convert it.</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
        Output uses two-space indentation and stays fully local.
      </p>
    </div>
  )
}

function run(direction: Direction, input: string): ConvertResult {
  return direction === 'yaml-to-json' ? yamlToJson(input) : jsonToYaml(input)
}
