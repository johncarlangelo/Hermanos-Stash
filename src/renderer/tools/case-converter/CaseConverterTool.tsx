import { useId, useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { Panel, SectionHeading } from '../../components/ui/Feedback'
import { TextArea } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { toastError, toastSuccess } from '../../stores/toasts'
import { convertCase, counts, type CaseKind } from './logic'

const CONVERSIONS: Array<[CaseKind, string]> = [
  ['camel', 'camelCase'],
  ['pascal', 'PascalCase'],
  ['snake', 'snake_case'],
  ['kebab', 'kebab-case'],
  ['constant', 'CONSTANT_CASE'],
  ['title', 'Title Case'],
  ['sentence', 'Sentence case'],
  ['upper', 'UPPERCASE'],
  ['lower', 'lowercase']
]

export default function CaseConverterTool() {
  const [input, setInput] = useState('')
  const inputId = useId()

  const hasInput = input.trim().length > 0
  const stats = useMemo(() => (hasInput ? counts(input) : null), [input, hasInput])

  const copyValue = async (value: string, label: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      toastSuccess(`${label} copied to clipboard`)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <SectionHeading>Text</SectionHeading>
          {stats && (
            <span
              role="status"
              className="truncate font-mono text-[10.5px] text-faint tnum"
              title="Words · characters · no-whitespace chars · lines · sentences · reading time"
            >
              {stats.words} words · {stats.chars} chars · {stats.noWhitespaceChars} nospace ·{' '}
              {stats.lines} lines · {stats.sentences} sentences · ~{stats.readingTimeMin} min read
            </span>
          )}
        </div>
        <label htmlFor={inputId} className="sr-only">
          Text to convert between naming conventions
        </label>
        <TextArea
          id={inputId}
          mono
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={'myVariableName — or any mix of camelCase, snake_case, kebab-case…'}
          className="h-28"
        />
      </Panel>

      {!hasInput ? (
        <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
          <p className="text-[12.5px] text-dim">Enter some text above to see every case at once.</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
            Word boundaries are detected across camelCase, PascalCase, snake_case and kebab-case.
          </p>
        </div>
      ) : (
        <Panel className="divide-y divide-line/60">
          {CONVERSIONS.map(([kind, label]) => {
            const value = convertCase(input, kind)
            return (
              <div key={kind} className="flex items-center gap-3 px-3.5 py-2">
                <span className="w-32 shrink-0 text-right text-[11.5px] text-faint">{label}</span>
                <output
                  aria-label={`${label} result`}
                  className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink"
                  title={value || '(empty)'}
                >
                  {value || <span className="text-faint">(empty)</span>}
                </output>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={`Copy ${label} result`}
                  disabled={!value}
                  onClick={() => void copyValue(value, label)}
                >
                  <Copy size={12} />
                </IconButton>
              </div>
            )
          })}
        </Panel>
      )}
    </div>
  )
}
