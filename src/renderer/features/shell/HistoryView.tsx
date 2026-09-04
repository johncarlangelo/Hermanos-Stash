import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  TriangleAlert,
  Clock,
  Search,
  RotateCcw,
  ArrowRight,
  ExternalLink
} from 'lucide-react'
import type { HistoryEntry } from '../../../shared/ipc'
import { Button } from '../../components/ui/Button'
import { Select, Input } from '../../components/ui/Inputs'
import { Badge } from '../../components/ui/badge'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { useNav } from '../../stores/nav'
import { getIcon } from '../../components/icons'

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all')
  const [searchQuery, setSearchQuery] = useState('')
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
      toastSuccess('History cleared')
    } catch (err) {
      toastError(err)
    } finally {
      setConfirmingClear(false)
    }
  }

  const filtered = useMemo(() => {
    if (!entries) return []
    let list = entries

    if (toolFilter !== 'all') {
      list = list.filter((e) => e.toolId === toolFilter)
    }

    if (statusFilter !== 'all') {
      list = list.filter((e) => e.status === statusFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((e) => {
        const toolName = toolRegistry.get(e.toolId)?.name?.toLowerCase() ?? e.toolId.toLowerCase()
        const op = e.operation.toLowerCase()
        const inputs = e.inputs.join(' ').toLowerCase()
        const outputs = e.outputs.join(' ').toLowerCase()
        const msg = e.message?.toLowerCase() ?? ''
        return (
          toolName.includes(q) ||
          op.includes(q) ||
          inputs.includes(q) ||
          outputs.includes(q) ||
          msg.includes(q)
        )
      })
    }

    return list
  }, [entries, toolFilter, statusFilter, searchQuery])

  const distinctTools = useMemo(
    () => [...new Set((entries ?? []).map((e) => e.toolId))].sort(),
    [entries]
  )

  if (!entries) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner label="Loading activity history" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl 2xl:max-w-6xl px-6 sm:px-8 py-8 space-y-7">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-raised/80 shadow-[0_0_24px_-8px_var(--color-accent-glow)]">
            <Clock size={22} className="text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">Activity History</h1>
              <Badge
                variant="outline"
                className="border-accent/40 text-accent font-mono text-[10px]"
              >
                LOCAL AUDIT LOG
              </Badge>
            </div>
            <p className="text-[13px] text-dim mt-0.5">
              Zero-cloud execution audit trail. File names and operations only, never file contents.
            </p>
          </div>
        </div>

        {/* Clear Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {entries.length > 0 && (
            <Button
              variant={confirmingClear ? 'primary' : 'danger'}
              size="sm"
              onClick={() => void clearHistory()}
              className="cursor-pointer text-xs"
            >
              {confirmingClear ? 'Confirm clear?' : 'Clear history'}
            </Button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      {entries.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-line/70 bg-surface/50 p-3 backdrop-blur-sm">
          <div className="flex flex-1 items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <Input
                placeholder="Search tools, operations, or filenames..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>

            {/* Tool Filter Dropdown */}
            <div className="w-48 shrink-0">
              <Select
                aria-label="Filter by tool"
                value={toolFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setToolFilter(e.target.value)
                }
                className="text-xs h-8"
              >
                <option value="all">All tools ({entries.length})</option>
                {distinctTools.map((id) => (
                  <option key={id} value={id}>
                    {toolRegistry.get(id)?.name ?? id}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center rounded-lg border border-line bg-raised/50 p-0.5">
              {(['all', 'success', 'failure'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-all ${
                    statusFilter === st
                      ? 'bg-accent text-base shadow-sm font-semibold'
                      : 'text-dim hover:text-ink'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-mono text-faint ml-1">
              {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        </div>
      )}

      {/* Main List / Content */}
      <div>
        {entries.length === 0 ? (
          <EmptyState
            icon="clock"
            title="Nothing here yet."
            hint="Run any tool and its activity shows up here — tool used, file names, and duration. File contents are never recorded."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="clock"
            title="No matching history entries."
            hint="Try changing your search terms or clearing the active filters."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setToolFilter('all')
                  setStatusFilter('all')
                  setSearchQuery('')
                }}
                className="cursor-pointer text-xs"
              >
                <RotateCcw size={13} className="mr-1" />
                Reset filters
              </Button>
            }
          />
        ) : (
          <div className="space-y-2.5">
            {filtered.map((entry) => {
              const tool = toolRegistry.get(entry.toolId)
              const toolName = tool?.name ?? entry.toolId
              const failure = entry.status === 'failure'
              const Icon = tool ? getIcon(tool.icon) : Clock

              return (
                <div
                  key={entry.id}
                  className={`rounded-lg border p-4 transition-all duration-150 space-y-2.5 ${
                    failure
                      ? 'border-danger/40 bg-danger/5'
                      : 'border-line/70 bg-surface/60 hover:border-line-strong'
                  }`}
                >
                  {/* Top line: Tool name, status badge, duration, timestamp */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-raised text-accent">
                        <Icon size={14} aria-hidden />
                      </span>
                      <button
                        type="button"
                        onClick={() => openTool(entry.toolId)}
                        className="cursor-pointer text-xs font-semibold text-ink hover:text-accent flex items-center gap-1 transition-colors truncate"
                      >
                        <span className="truncate">{toolName}</span>
                        <ExternalLink size={11} className="opacity-60 shrink-0" />
                      </button>
                      <span className="text-dim text-xs">·</span>
                      <span className="text-xs text-dim truncate">{entry.operation}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium font-mono ${
                          failure
                            ? 'bg-danger/15 text-danger border border-danger/30'
                            : 'bg-ok/15 text-ok border border-ok/30'
                        }`}
                      >
                        {failure ? (
                          <TriangleAlert size={10} aria-hidden />
                        ) : (
                          <Check size={10} aria-hidden />
                        )}
                        {failure ? 'FAILED' : 'SUCCESS'}
                      </span>

                      {typeof entry.durationMs === 'number' && (
                        <span className="text-[11px] font-mono text-faint">
                          {formatDuration(entry.durationMs)}
                        </span>
                      )}

                      <span className="text-[11px] font-mono text-faint">
                        {formatTimestamp(entry.timestampMs)}
                      </span>
                    </div>
                  </div>

                  {/* Failure message if any */}
                  {failure && entry.message && (
                    <div className="rounded-md bg-danger/10 border border-danger/25 p-2 text-xs font-mono text-danger">
                      {entry.message}
                    </div>
                  )}

                  {/* File inputs & outputs */}
                  {(entry.inputs.length > 0 || entry.outputs.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono pt-0.5">
                      {entry.inputs.length > 0 && (
                        <div className="flex items-center gap-1 text-faint">
                          <span className="text-[10px] uppercase tracking-wider text-faint/70 font-semibold">
                            IN:
                          </span>
                          <span className="rounded bg-base/50 border border-line px-1.5 py-0.5 truncate max-w-sm">
                            {entry.inputs.map((f) => f.split(/[\\/]/).pop()).join(', ')}
                          </span>
                        </div>
                      )}

                      {entry.inputs.length > 0 && entry.outputs.length > 0 && (
                        <ArrowRight size={11} className="text-faint shrink-0" />
                      )}

                      {entry.outputs.length > 0 && (
                        <div className="flex items-center gap-1 text-ok">
                          <span className="text-[10px] uppercase tracking-wider text-ok/70 font-semibold">
                            OUT:
                          </span>
                          <span className="rounded bg-ok/10 border border-ok/30 px-1.5 py-0.5 truncate max-w-sm text-ok">
                            {entry.outputs.map((f) => f.split(/[\\/]/).pop()).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {entries.length >= HISTORY_LIMIT && (
              <p className="py-3 text-center text-xs text-faint font-mono">
                Showing the most recent {HISTORY_LIMIT} entries.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryView
