import { useId, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { FieldRow, Select, TextArea } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { stashError, ERROR_CODES, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { formatSql, type KeywordCase, type SqlLanguage } from './logic'

const LANGUAGE_LABELS: Array<[SqlLanguage, string]> = [
  ['sql', 'Standard SQL'],
  ['postgresql', 'PostgreSQL'],
  ['mysql', 'MySQL'],
  ['sqlite', 'SQLite']
]

const CASE_LABELS: Array<[KeywordCase, string]> = [
  ['preserve', 'Preserve'],
  ['upper', 'UPPERCASE'],
  ['lower', 'lowercase']
]

export default function SqlFormatterTool() {
  const [input, setInput] = useState('')
  const [language, setLanguage] = useState<SqlLanguage>('sql')
  const [keywordCase, setKeywordCase] = useState<KeywordCase>('preserve')

  const inputId = useId()
  const languageId = useId()
  const caseId = useId()

  const hasInput = input.trim().length > 0

  const result = useMemo(
    () => formatSql(input, { language, keywordCase }),
    [input, language, keywordCase]
  )

  const stats = useMemo(() => {
    if (!hasInput) return null
    const inBytes = formatBytes(new TextEncoder().encode(input).length)
    if (!result.ok) return `In ${inBytes}`
    const outBytes = new TextEncoder().encode(result.output).length
    return `In ${inBytes} · Out ${formatBytes(outBytes)}`
  }, [input, result, hasInput])

  const copyOutput = async () => {
    if (!result.ok) return
    try {
      await navigator.clipboard.writeText(result.output)
      toastSuccess('Formatted SQL copied to clipboard')
    } catch (err) {
      toastError(err)
    }
  }

  const error: StashError | null =
    hasInput && !result.ok ? stashError(ERROR_CODES.VALIDATION, result.error.message) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>SQL query</SectionHeading>
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
            SQL query to format
          </label>
          <TextArea
            id={inputId}
            mono
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'select id, name\nfrom users\nwhere active = 1'}
            aria-invalid={Boolean(error)}
            className="h-56"
          />
        </Panel>

        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>Formatted output</SectionHeading>
            <IconButton
              variant="surface"
              size="sm"
              aria-label="Copy formatted SQL"
              disabled={!result.ok || !result.output}
              onClick={() => void copyOutput()}
            >
              <Copy size={13} />
            </IconButton>
          </div>

          {!hasInput ? (
            <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
              <p className="text-[12.5px] text-dim">Paste a SQL query on the left to begin.</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
                Formatting happens live — nothing leaves this machine.
              </p>
            </div>
          ) : !result.ok ? (
            <ErrorNote error={stashError(ERROR_CODES.VALIDATION, result.error.message)} />
          ) : (
            <output
              aria-label="Formatted SQL output"
              className="h-56 overflow-auto rounded-md border border-line bg-base p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-ink"
            >
              {result.output || <span className="text-faint">(empty)</span>}
            </output>
          )}
        </Panel>
      </div>

      <Panel className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3">
        <FieldRow label="Dialect" htmlFor={languageId}>
          <Select
            id={languageId}
            value={language}
            onChange={(e) => setLanguage(e.target.value as SqlLanguage)}
            className="w-40"
          >
            {LANGUAGE_LABELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FieldRow>
        <FieldRow label="Keywords" htmlFor={caseId}>
          <Select
            id={caseId}
            value={keywordCase}
            onChange={(e) => setKeywordCase(e.target.value as KeywordCase)}
            className="w-36"
          >
            {CASE_LABELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
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
