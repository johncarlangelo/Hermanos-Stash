import { useId, useMemo, useState } from 'react'
import { Panel } from '../../components/ui/Feedback'
import { Input } from '../../components/ui/Inputs'
import { toastError, toastSuccess } from '../../stores/toasts'
import type { StatusClass } from './data'
import { filterStatuses, HTTP_STATUSES } from './logic'

type ClassFilter = 'all' | StatusClass

const FILTERS: Array<{ value: ClassFilter; label: string; count?: number }> = [
  { value: 'all', label: 'All' },
  { value: 1, label: 'Informational' },
  { value: 2, label: 'Success' },
  { value: 3, label: 'Redirection' },
  { value: 4, label: 'Client Error' },
  { value: 5, label: 'Server Error' }
]

const CLASS_CODE_TONE: Record<StatusClass, string> = {
  1: 'text-dim',
  2: 'text-ok',
  3: 'text-dim',
  4: 'text-danger',
  5: 'text-danger/90'
}

export default function HttpStatusTool() {
  const [query, setQuery] = useState('')
  const [classFilter, setClassFilter] = useState<ClassFilter>('all')
  const inputId = useId()

  const { matches } = useMemo(() => filterStatuses(HTTP_STATUSES, query), [query])

  const visible = useMemo(
    () =>
      classFilter === 'all'
        ? matches
        : matches.filter((m) => Math.floor(m.code / 100) === classFilter),
    [matches, classFilter]
  )

  const copyCode = async (code: number, name: string) => {
    try {
      await navigator.clipboard.writeText(`${code} ${name}`)
      toastSuccess(`${code} ${name} copied to clipboard`)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-3.5">
        <label htmlFor={inputId} className="sr-only">
          Search status codes by code, name or meaning
        </label>
        <Input
          id={inputId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="404, “not found”, “rate limit”…"
        />
        <div
          role="group"
          aria-label="Filter by status class"
          className="mt-2.5 flex flex-wrap gap-1.5"
        >
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={classFilter === filter.value}
              onClick={() => setClassFilter(filter.value)}
              className={`cursor-pointer rounded-sm border px-2 py-0.5 text-[11.5px] transition-colors duration-150 ${
                classFilter === filter.value
                  ? 'border-accent/50 bg-accent-soft text-accent'
                  : 'border-line bg-transparent text-dim hover:border-line-strong hover:text-ink'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <p aria-live="polite" role="status" className="mt-2 text-[11.5px] text-faint tnum">
          {visible.length} of {HTTP_STATUSES.length} codes · click a card to copy it
        </p>
      </Panel>

      {visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
          <p className="text-[12.5px] text-dim">No status codes match your filters.</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
            Try a shorter query like “40” or clear the class filter.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((entry) => (
            <button
              key={entry.code}
              type="button"
              onClick={() => void copyCode(entry.code, entry.name)}
              title={`Copy ${entry.code} ${entry.name}`}
              aria-label={`Copy ${entry.code} ${entry.name}`}
              className="cursor-pointer rounded-md border border-line bg-surface px-3 py-2.5 text-left transition-colors duration-150 hover:border-line-strong hover:bg-overlay"
            >
              <span
                className={`tnum font-mono text-[19px] leading-none font-semibold ${
                  CLASS_CODE_TONE[entry.code as StatusClass]
                }`}
              >
                {entry.code}
              </span>
              <span className="mt-1 block truncate text-[12.5px] font-medium text-ink">
                {entry.name}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-faint">
                {entry.meaning}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
