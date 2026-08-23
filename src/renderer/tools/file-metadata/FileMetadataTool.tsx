import { Fragment, useCallback, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorNote, Panel, SectionHeading, Spinner } from '../../components/ui/Feedback'
import { TagChip } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, type StashError } from '../../../shared/errors'
import { buildFileDisplayInfos, type FileDisplayInfo } from './logic'

interface Item {
  id: number
  path: string
  status: 'loading' | 'ready' | 'error'
  info?: FileDisplayInfo
  error?: StashError
}

let nextItemId = 1

export default function FileMetadataTool() {
  const [items, setItems] = useState<Item[]>([])
  const knownPaths = useRef(new Set<string>())

  const forgetPath = useCallback((path: string) => {
    knownPaths.current.delete(path)
  }, [])

  const clearAll = useCallback(() => {
    knownPaths.current.clear()
    setItems([])
  }, [])

  const inspect = useCallback(async (entry: Item): Promise<void> => {
    const startedAt = performance.now()
    try {
      const stat = await window.stash.fs.stat(entry.path)
      const [info] = buildFileDisplayInfos([stat], Date.now())
      setItems((prev) =>
        prev.map((it) => (it.id === entry.id ? { ...it, status: 'ready', info } : it))
      )
      recordHistory(entry.path, 'success', performance.now() - startedAt)
    } catch (err) {
      const normalized = normalizeError(err)
      setItems((prev) =>
        prev.map((it) => (it.id === entry.id ? { ...it, status: 'error', error: normalized } : it))
      )
      recordHistory(entry.path, 'failure', performance.now() - startedAt, normalized.userMessage)
    }
  }, [])

  const addPaths = useCallback(
    (paths: string[]) => {
      const fresh = paths.filter((p) => !knownPaths.current.has(p))
      if (fresh.length === 0) return
      fresh.forEach((p) => knownPaths.current.add(p))

      const entries: Item[] = fresh.map((path) => ({
        id: nextItemId++,
        path,
        status: 'loading'
      }))
      setItems((prev) => [...prev, ...entries])
      for (const entry of entries) void inspect(entry)
    },
    [inspect]
  )

  const readyCount = items.filter((i) => i.status === 'ready').length

  return (
    <div className="flex flex-col gap-4">
      <DropZone
        multiple
        label="Drop files here"
        hint="Any file type · click to browse"
        dialogTitle="Choose files to inspect"
        onFiles={addPaths}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="folder"
          title="Nothing inspected yet."
          hint="Drop one or more files above to see size, timestamps, MIME type and full path. Files are read locally only — nothing is uploaded."
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <SectionHeading>
              Inspected files · {readyCount}/{items.length}
            </SectionHeading>
            <Button size="sm" variant="ghost" onClick={clearAll}>
              Clear all
            </Button>
          </div>

          <ul className="flex flex-col gap-2.5">
            {items.map((item) => (
              <li key={item.id}>
                <Panel className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className="truncate text-[13.5px] font-medium text-ink"
                        title={item.info?.name ?? item.path}
                      >
                        {item.info?.name ?? fileNameOf(item.path)}
                      </span>
                      {(item.info?.extension || extensionOfName(fileNameOf(item.path))) && (
                        <TagChip
                          tag={
                            (
                              item.info?.extension ??
                              extensionOfName(fileNameOf(item.path)) ??
                              ''
                            ).toUpperCase() || 'FILE'
                          }
                        />
                      )}
                    </div>
                    <IconButtonRemove
                      label={`Remove ${fileNameOf(item.path)} from the list`}
                      onClick={() => {
                        forgetPath(item.path)
                        setItems((prev) => prev.filter((x) => x.id !== item.id))
                      }}
                    />
                  </div>

                  {item.status === 'loading' && (
                    <p
                      role="status"
                      className="mt-2 flex items-center gap-2 text-[12px] text-faint"
                    >
                      <Spinner label={`Reading ${fileNameOf(item.path)}`} />
                      Reading file…
                    </p>
                  )}

                  {item.status === 'error' && item.error && (
                    <div className="mt-2">
                      <ErrorNote error={item.error} />
                    </div>
                  )}

                  {item.status === 'ready' && item.info && <MetadataGrid info={item.info} />}
                </Panel>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function IconButtonRemove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="shrink-0 cursor-pointer rounded-sm p-1 text-faint transition-colors duration-150 ease-out hover:bg-surface hover:text-danger"
    >
      <X size={14} />
    </button>
  )
}

function MetadataGrid({ info }: { info: FileDisplayInfo }) {
  const rows: Array<[string, React.ReactNode]> = [
    ['Size', <span className="tnum">{info.sizeLabel}</span>],
    ['Type', info.mimeTypeLabel],
    ['Created', <time>{info.createdLabel}</time>],
    [
      'Modified',
      <>
        <time>{info.modifiedLabel}</time>{' '}
        <span className="text-faint">· {info.modifiedRelative}</span>
      </>
    ],
    [
      'Path',
      <span className="block truncate font-mono text-[11.5px] text-dim" title={info.path}>
        {info.path}
      </span>
    ]
  ]

  return (
    <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5">
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <dt className="w-16 shrink-0 text-right text-[12px] text-faint">{label}</dt>
          <dd className="min-w-0 text-[12.5px] leading-snug text-ink">{value}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function extensionOfName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}

/**
 * History is best-effort (TOOL_SPEC.md → History): failures must never break
 * the inspection flow, so the promise is fire-and-forget inside try/catch.
 */
function recordHistory(
  path: string,
  status: 'success' | 'failure',
  durationMs: number,
  message?: string
): void {
  try {
    void window.stash.history.record({
      toolId: 'file-metadata',
      operation: 'inspect',
      inputs: [path],
      outputs: [],
      status,
      durationMs: Math.round(durationMs),
      ...(message ? { message } : {})
    })
  } catch {
    // Ignore — activity history must not surface errors into the tool UI.
  }
}
