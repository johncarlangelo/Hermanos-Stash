import { useId, useMemo, useState } from 'react'
import { Panel, SectionHeading } from '../../components/ui/Feedback'
import { Input } from '../../components/ui/Inputs'
import { toastError, toastSuccess } from '../../stores/toasts'
import { MIME_BY_EXTENSION, searchMimeTypes, type MimeRow } from './logic'

export default function MimeLookupTool() {
  const [query, setQuery] = useState('')
  const inputId = useId()

  const rows = useMemo(() => searchMimeTypes(query), [query])

  const copyMime = async (row: MimeRow) => {
    try {
      await navigator.clipboard.writeText(row.mime)
      toastSuccess(`${row.mime} copied to clipboard`)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-3.5">
        <SectionHeading>Search extensions and MIME types</SectionHeading>
        <div className="mt-2">
          <label htmlFor={inputId} className="sr-only">
            Search by file extension or MIME type
          </label>
          <Input
            id={inputId}
            mono
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="png, image/, application/pdf…"
          />
        </div>
        <p aria-live="polite" role="status" className="mt-2 text-[11.5px] text-faint tnum">
          {rows.length} of {Object.keys(MIME_BY_EXTENSION).length} entries · click a row to copy its
          MIME type
        </p>
      </Panel>

      <Panel>
        <div className="flex items-center gap-3 border-b border-line px-3.5 py-2">
          <span className="w-24 shrink-0 text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">
            Extension
          </span>
          <span className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">
            MIME type
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[12.5px] text-dim">Nothing matches “{query.trim()}”.</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
              Try a bare extension like “webm” or a type prefix like “audio/”.
            </p>
          </div>
        ) : (
          <ul
            className="max-h-[26rem] divide-y divide-line/60 overflow-auto"
            aria-label="MIME type results"
          >
            {rows.map((row) => (
              <li key={row.ext}>
                <button
                  type="button"
                  onClick={() => void copyMime(row)}
                  title={`Copy ${row.mime}`}
                  aria-label={`Copy MIME type ${row.mime} for ${row.ext.slice(1)} files`}
                  className="flex w-full cursor-pointer items-center gap-3 px-3.5 py-1.5 text-left transition-colors duration-150 hover:bg-overlay"
                >
                  <span className="tnum w-24 shrink-0 font-mono text-[12.5px] font-medium text-ink">
                    {row.ext}
                  </span>
                  <span className="min-w-0 truncate font-mono text-[12px] text-dim">
                    {row.mime}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
