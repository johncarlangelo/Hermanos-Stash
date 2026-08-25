import { useEffect, useMemo, useState } from 'react'
import { Check, TriangleAlert } from 'lucide-react'
import type { HistoryEntry } from '../../../shared/ipc'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Inputs'
import { EmptyState, Panel, Spinner } from '../../components/ui/Feedback'
import { toastError } from '../../stores/toasts'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { useNav } from '../../stores/nav'

const HISTORY_LIMIT = 200

function formatTimestamp(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(new Date(ms))
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

export function HistoryView({ seedToolId }: { seedToolId?: string }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [toolFilter, setToolFilter] = useState(seedToolId ?? 'all')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const openTool = useNav((s) => s.openTool)

  useEffect(() => {
    window.stash.history
      .list(HISTORY_LIMIT)
      .then(setEntries)
      .catch((err) => {
        setEntries([])
        toastError(err)
      })
  }, [])

  const reload = async () => {
    try {
      setEntries(await window.stash.history.list(HISTORY_LIMIT))
    } catch (err) {
      toastError(err)
    }
  }

  const clearHistory = async () => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      setTimeout(() => setConfirmingClear(false), 3000)
      return
    }
    try {
      await window.stash.history.clear()
      await reload()
    } catch (err) {
      toastError(err)
    } finally {
      setConfirmingClear(false)
    }
  }

  const filtered = useMemo(() => {
    if (!entries) return []
    return toolFilter === 'all' ? entries : entries.filter((e) => e.toolId === toolFilter)
  }, [entries, toolFilter])

  const distinctTools = useMemo(
    () => [...new Set((entries ?? []).map((e) => e.toolId))].sort(),
    [entries]
  )

  if (!entries) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner label="Loading history" />
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative mx-auto w-full max-w-3xl px-8 py-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight text-ink">Activity History</h1>
            <p className="mt-0.5 text-[12.5px] text-dim">
              {filtered.length === entries.length
                ? `${entries.length} recent ${entries.length === 1 ? 'entry' : 'entries'}`
                : `${filtered.length} of ${entries.length} entries`}{' '}
              · file names only, never contents
            </p>
          </div>
          <Button
            variant={confirmingClear ? 'primary' : 'danger'}
            size="sm"
            onClick={() => void clearHistory()}
          >
            {confirmingClear ? 'Confirm clear?' : 'Clear all'}
          </Button>
        </div>

        {entries.length > 0 && (
          <div className="mb-4 w-56">
            <Select
              aria-label="Filter by tool"
              value={toolFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setToolFilter(e.target.value)}
            >
              <option value="all">All tools</option>
              {distinctTools.map((id) => (
                <option key={id} value={id}>
                  {toolRegistry.get(id)?.name ?? id}
                </option>
              ))}
            </Select>
          </div>
        )}

        {entries.length === 0 ? (
          <EmptyState
            icon="clock"
            title="Nothing here yet."
            hint="Run any tool and its activity shows up here — the tool used, file names and outcome. File contents are never recorded."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="clock"
            title="No entries for this tool."
            hint="Pick another tool from the filter above."
          />
        ) : (
          <Panel className="divide-y divide-line overflow-hidden">
            {filtered.map((entry) => {
              const toolName = toolRegistry.get(entry.toolId)?.name ?? entry.toolId
              const failure = entry.status === 'failure'
              return (
                <div key={entry.id} className={`px-4 py-2.5 ${failure ? 'bg-danger/8' : ''}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openTool(entry.toolId)}
                      className="cursor-pointer text-[12.5px] font-medium text-ink underline-offset-2 transition-colors duration-150 hover:text-accent hover:underline"
                    >
                      {toolName}
                    </button>
                    <span className="tnum shrink-0 text-[11px] text-faint">
                      {formatTimestamp(entry.timestampMs)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] leading-snug">
                    <span
                      className={`inline-flex items-center gap-1 shrink-0 ${
                        failure ? 'text-danger' : 'text-ok'
                      }`}
                    >
                      {failure ? (
                        <TriangleAlert size={11} aria-hidden />
                      ) : (
                        <Check size={11} aria-hidden />
                      )}
                      {failure ? 'Failed' : 'Success'}
                    </span>
                    <span className="text-dim">{entry.operation}</span>
                    {typeof entry.durationMs === 'number' && (
                      <span className="tnum shrink-0 text-faint">
                        {formatDuration(entry.durationMs)}
                      </span>
                    )}
                  </div>
                  {(entry.inputs.length > 0 || entry.outputs.length > 0 || entry.message) && (
                    <p
                      className="mt-1 truncate font-mono text-[10.5px] text-faint"
                      title={[
                        entry.inputs.length ? `in: ${entry.inputs.join(', ')}` : '',
                        entry.outputs.length ? `out: ${entry.outputs.join(', ')}` : '',
                        entry.message ?? ''
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    >
                      {[
                        entry.inputs.length ? entry.inputs.join(', ') : '',
                        entry.outputs.length ? `→ ${entry.outputs.join(', ')}` : '',
                        entry.message ?? ''
                      ]
                        .filter(Boolean)
                        .join('  →  ')}
                    </p>
                  )}
                </div>
              )
            })}
            {entries.length >= HISTORY_LIMIT && (
              <p className="px-4 py-2 text-center text-[11px] text-faint">
                Showing the most recent {HISTORY_LIMIT} entries.
              </p>
            )}
          </Panel>
        )}
      </div>
    </div>
  )
}
