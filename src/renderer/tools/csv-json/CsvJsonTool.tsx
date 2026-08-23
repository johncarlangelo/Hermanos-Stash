import { useId, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { FieldRow, Select, TextArea, Toggle } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { stashError, ERROR_CODES, type StashError } from '../../../shared/errors'
import { toastError, toastSuccess } from '../../stores/toasts'
import {
  csvToJson,
  describeShape,
  jsonToCsv,
  parseCsv,
  type CsvDelimiter,
  type CsvIssue
} from './logic'

type Direction = 'csv-to-json' | 'json-to-csv'

function toStashError(issue: CsvIssue): StashError {
  const location = issue.line !== undefined ? ` (line ${issue.line})` : ''
  return stashError(ERROR_CODES.VALIDATION, `${issue.message}${location}`, {
    technicalMessage: issue.message
  })
}

export default function CsvJsonTool() {
  const [direction, setDirection] = useState<Direction>('csv-to-json')
  const [input, setInput] = useState('')
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(',')
  const [headerRow, setHeaderRow] = useState(true)

  const inputId = useId()
  const delimiterId = useId()

  const hasInput = input.length > 0
  const options = { delimiter, headerRow }

  const result = useMemo(
    () =>
      !hasInput
        ? null
        : direction === 'csv-to-json'
          ? csvToJson(input, options)
          : jsonToCsv(input, options),
    // options is rebuilt each render; individual fields are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [direction, input, delimiter, headerRow, hasInput]
  )

  const shapeStats = useMemo(() => {
    if (!hasInput || direction !== 'csv-to-json') return null
    const parsed = parseCsv(input, delimiter)
    if (!parsed.ok) return null
    if (parsed.rows.length === 0) return null
    return headerRow ? `${parsed.rows.length - 1} data rows` : describeShape(parsed.rows)
  }, [input, delimiter, direction, headerRow, hasInput])

  const copyOutput = async () => {
    if (!result?.ok) return
    try {
      await navigator.clipboard.writeText(result.output)
      toastSuccess(`${direction === 'csv-to-json' ? 'JSON' : 'CSV'} copied to clipboard`)
    } catch (err) {
      toastError(err)
    }
  }

  const error = result && !result.ok ? toStashError(result.error) : null

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3">
        <div role="group" aria-label="Conversion direction" className="flex items-center gap-2">
          <Button
            size="sm"
            variant={direction === 'csv-to-json' ? 'primary' : 'secondary'}
            aria-pressed={direction === 'csv-to-json'}
            onClick={() => setDirection('csv-to-json')}
          >
            CSV → JSON
          </Button>
          <Button
            size="sm"
            variant={direction === 'json-to-csv' ? 'primary' : 'secondary'}
            aria-pressed={direction === 'json-to-csv'}
            onClick={() => setDirection('json-to-csv')}
          >
            JSON → CSV
          </Button>
        </div>

        <FieldRow label="Delimiter" htmlFor={delimiterId}>
          <Select
            id={delimiterId}
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value as CsvDelimiter)}
            className="w-28"
          >
            <option value=",">Comma ,</option>
            <option value={';'}>Semicolon ;</option>
            <option value={'\t'}>Tab</option>
          </Select>
        </FieldRow>

        <div className="flex items-center gap-2">
          <Toggle checked={headerRow} onChange={setHeaderRow} label="First row is a header" />
          <span className="text-[12px] text-faint">First row is a header</span>
        </div>

        <span className="text-[11.5px] text-faint">
          {direction === 'csv-to-json'
            ? headerRow
              ? 'Rows become objects keyed by the first row.'
              : 'Rows become arrays of strings.'
            : 'Arrays export as rows; objects use their keys as columns.'}
        </span>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>
              {direction === 'csv-to-json' ? 'CSV input' : 'JSON input'}
            </SectionHeading>
            {shapeStats && (
              <span
                role="status"
                className="truncate font-mono text-[10.5px] text-faint tnum"
                title={shapeStats}
              >
                {shapeStats}
              </span>
            )}
          </div>
          <label htmlFor={inputId} className="sr-only">
            {direction === 'csv-to-json' ? 'Delimited text input' : 'JSON array input'}
          </label>
          <TextArea
            id={inputId}
            mono
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              direction === 'csv-to-json'
                ? 'name,qty\nbolt,12\nnut,"4,5 mm"'
                : '[{"name": "bolt", "qty": 12}]'
            }
            aria-invalid={Boolean(error)}
            className="h-56"
          />
        </Panel>

        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>
              {direction === 'csv-to-json' ? 'JSON output' : 'CSV output'}
            </SectionHeading>
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
            <EmptyState
              icon="braces"
              title={
                direction === 'csv-to-json'
                  ? 'Paste delimited text on the left to convert it.'
                  : 'Paste a JSON array on the left to convert it.'
              }
              hint="Quoted fields, escaped quotes and embedded newlines are handled per RFC 4180 — everything stays local."
            />
          ) : error ? (
            <ErrorNote error={error} />
          ) : (
            <output
              aria-label={`${direction === 'csv-to-json' ? 'JSON' : 'CSV'} output`}
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
