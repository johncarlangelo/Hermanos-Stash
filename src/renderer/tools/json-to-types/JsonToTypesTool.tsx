import { useId, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { FieldRow, Input, Select, TextArea, Toggle } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { ERROR_CODES, stashError, type StashError } from '../../../shared/errors'
import { toastError, toastSuccess } from '../../stores/toasts'
import { generateTypes, type ExportStyle } from './logic'

function toStashError(issue: { message: string; line?: number; column?: number }): StashError {
  const location =
    issue.line !== undefined && issue.column !== undefined
      ? ` (line ${issue.line}, column ${issue.column})`
      : ''
  return stashError(ERROR_CODES.VALIDATION, `${issue.message}${location}`, {
    technicalMessage: issue.message
  })
}

export default function JsonToTypesTool() {
  const [input, setInput] = useState('')
  const [rootName, setRootName] = useState('Root')
  const [exportStyle, setExportStyle] = useState<ExportStyle>('interface')
  const [optionalFields, setOptionalFields] = useState(false)

  const inputId = useId()
  const rootId = useId()
  const styleId = useId()

  const hasInput = input.trim().length > 0

  const result = useMemo(
    () => generateTypes(input, { rootName, exportStyle, optionalFields }),
    [input, rootName, exportStyle, optionalFields]
  )

  const stats = useMemo(() => {
    if (!hasInput) return null
    if (result.ok && result.interfaceCount > 0) {
      return `${result.interfaceCount} interface${result.interfaceCount === 1 ? '' : 's'} generated`
    }
    return null
  }, [hasInput, result])

  const copyOutput = async () => {
    if (!result.ok) return
    try {
      await navigator.clipboard.writeText(result.output)
      toastSuccess('TypeScript types copied to clipboard')
    } catch (err) {
      toastError(err)
    }
  }

  const shownError = result.ok ? null : toStashError(result.error)

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
            placeholder='{"user": {"id": 1, "roles": ["admin"]}}'
            aria-invalid={Boolean(shownError)}
            className="h-56"
          />
        </Panel>

        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>TypeScript output</SectionHeading>
            <IconButton
              variant="surface"
              size="sm"
              aria-label="Copy output"
              disabled={!result.ok || !result.output}
              onClick={() => void copyOutput()}
            >
              <Copy size={13} />
            </IconButton>
          </div>

          {!hasInput ? (
            <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
              <p className="text-[12.5px] text-dim">Paste JSON on the left to begin.</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
                Types are inferred live — nested objects become their own interfaces.
              </p>
            </div>
          ) : shownError ? (
            <ErrorNote error={shownError} />
          ) : result.ok ? (
            <output
              aria-label="Generated TypeScript types"
              className="h-56 overflow-auto rounded-md border border-line bg-base p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-ink"
            >
              {result.output}
            </output>
          ) : null}
        </Panel>
      </div>

      <Panel className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3">
        <FieldRow label="Root name" htmlFor={rootId}>
          <Input
            id={rootId}
            value={rootName}
            onChange={(e) => setRootName(e.target.value)}
            placeholder="Root"
            className="w-32"
          />
        </FieldRow>
        <FieldRow label="Style" htmlFor={styleId}>
          <Select
            id={styleId}
            value={exportStyle}
            onChange={(e) => setExportStyle(e.target.value as ExportStyle)}
            className="w-32"
          >
            <option value="interface">interface</option>
            <option value="type">type alias</option>
          </Select>
        </FieldRow>
        <FieldRow label="Optional">
          <Toggle
            checked={optionalFields}
            onChange={setOptionalFields}
            label="Mark fields missing from some array members as optional"
          />
        </FieldRow>
        {hasInput && (
          <Button size="sm" variant="ghost" onClick={() => setInput('')} className="ml-auto">
            Clear input
          </Button>
        )}
      </Panel>
    </div>
  )
}
