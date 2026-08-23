import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FieldRow, Input, Toggle } from '../../components/ui/Inputs'
import { ErrorNote, Panel, SectionHeading, SuccessNote } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { formatUuid, isValidUuidV4, MAX_UUID_BATCH } from './logic'

export default function UuidGeneratorTool() {
  const [count, setCount] = useState('5')
  const [uppercase, setUppercase] = useState(false)
  const [braces, setBraces] = useState(false)
  const [results, setResults] = useState<string[] | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const parsedCount = Number.parseInt(count, 10)
  const countError =
    count.trim() === '' || !Number.isInteger(parsedCount) || parsedCount < 1
      ? 'Enter a whole number between 1 and 100.'
      : parsedCount > MAX_UUID_BATCH
        ? `Generate at most ${MAX_UUID_BATCH} at a time.`
        : null

  const generate = () => {
    if (countError) return
    setResults(
      Array.from({ length: parsedCount }, () =>
        formatUuid(crypto.randomUUID(), { uppercase, braces })
      )
    )
  }

  const copyAll = async () => {
    if (!results?.length) return
    try {
      await navigator.clipboard.writeText(results.join('\n'))
      toastSuccess(`Copied ${results.length} UUIDs`)
    } catch {
      toastError('Clipboard write was blocked by the system.')
    }
  }

  const copyOne = async (value: string, index: number) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex((c) => (c === index ? null : c)), 1200)
    } catch {
      toastError('Clipboard write was blocked by the system.')
    }
  }

  const allValid = useMemo(
    () => results?.every((u) => isValidUuidV4(u.replace(/[{}]/g, ''))) ?? true,
    [results]
  )

  return (
    <div className="space-y-4">
      <Panel className="space-y-3 px-4 py-4">
        <SectionHeading>Options</SectionHeading>
        <FieldRow label="Quantity" htmlFor="uuid-count">
          <Input
            id="uuid-count"
            inputMode="numeric"
            value={count}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setCount(e.target.value)
              setResults(null)
            }}
            invalid={!!countError}
            className="w-24"
          />
          <span className="text-[11.5px] text-faint">1–{MAX_UUID_BATCH}</span>
        </FieldRow>
        <FieldRow label="Uppercase">
          <Toggle
            checked={uppercase}
            onChange={(v: boolean) => {
              setUppercase(v)
              setResults(null)
            }}
            label="Use uppercase"
          />
        </FieldRow>
        <FieldRow label="Braces">
          <Toggle
            checked={braces}
            onChange={(v: boolean) => {
              setBraces(v)
              setResults(null)
            }}
            label="Wrap in braces"
          />
        </FieldRow>
        {countError && (
          <p role="alert" className="text-[12px] text-danger">
            {countError}
          </p>
        )}
        <div className="flex items-center gap-3 pt-1">
          <Button variant="primary" onClick={generate} disabled={!!countError}>
            Generate
          </Button>
          {results && results.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => void copyAll()}>
              <Copy size={13} aria-hidden />
              Copy all
            </Button>
          )}
        </div>
      </Panel>

      {results && results.length > 0 && (
        <Panel className="px-4 py-4">
          <div className="mb-2.5 flex items-center justify-between">
            <SectionHeading>
              Generated {results.length} UUID{results.length === 1 ? '' : 's'}
            </SectionHeading>
            {allValid && <SuccessNote message="All v4 format" />}
          </div>
          <ul className="divide-y divide-line">
            {results.map((uuid, index) => (
              <li
                key={`${uuid}-${index}`}
                className="flex items-center justify-between gap-3 py-1.5"
              >
                <code className="min-w-0 truncate font-mono text-[12.5px] text-ink" title={uuid}>
                  {uuid}
                </code>
                <button
                  type="button"
                  aria-label={`Copy ${uuid}`}
                  onClick={() => void copyOne(uuid, index)}
                  className="shrink-0 cursor-pointer rounded-sm p-1 text-faint transition-colors duration-150 hover:bg-surface hover:text-ink"
                >
                  {copiedIndex === index ? (
                    <Check size={13} className="text-ok" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!results && !countError && (
        <p className="text-[12px] leading-relaxed text-faint">
          Generates random version-4 UUIDs using the operating system's secure random source.
          Nothing is stored or transmitted.
        </p>
      )}
      {countError && (
        <ErrorNote error={{ code: 'VALIDATION', userMessage: countError, recoverable: true }} />
      )}
    </div>
  )
}
