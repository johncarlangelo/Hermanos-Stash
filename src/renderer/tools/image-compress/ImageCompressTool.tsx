import { useCallback, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import {
  EmptyState,
  ErrorNote,
  Panel,
  ProgressBar,
  SectionHeading
} from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { Slider } from '../../components/ui/Slider'
import { FieldRow, Input, Select } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, type StashError } from '../../../shared/errors'
import type { CompressImagesRequest, ImageBatchResult } from '../../../shared/ipc'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { FileListPanel } from '../shared/file-list-panel'
import { CopyPathButton, RevealButton } from '../shared/result-actions'
import { useOutputDir } from '../shared/use-output-dir'
import { fileNameOf, useFileList } from '../shared/use-file-list'
import { recordHistoryQuietly, useProgressEvent } from '../shared/use-progress-event'

const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.avif']
const MAX_DIMENSION_OPTIONS = [0, 1920, 1280, 800] as const

export default function ImageCompressTool() {
  const { items, addPaths, removePath, clearAll } = useFileList()
  const [sizes, setSizes] = useState<Map<string, number>>(new Map())
  const [quality, setQuality] = useState(75)
  const [maxDimension, setMaxDimension] = useState<number>(0)
  const [namePattern, setNamePattern] = useState('')
  const [destination, setDestination] = useOutputDir('image-compress')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ImageBatchResult | null>(null)
  const [error, setError] = useState<StashError | null>(null)
  const liveEvent = useProgressEvent()

  // Live pattern validation; the main process re-checks the token at the IPC
  // boundary before any file is written.
  const patternError =
    namePattern.trim().length > 0 && !namePattern.includes('{name}')
      ? 'Pattern must include {name}.'
      : null

  const canRun = items.length > 0 && destination !== '' && !running && patternError === null
  const live = running && liveEvent?.status === 'active' ? liveEvent : null

  const fetchSize = useCallback(async (path: string): Promise<void> => {
    try {
      const stat = await window.stash.fs.stat(path)
      if (!stat.isDirectory) {
        setSizes((prev) => new Map(prev).set(path, stat.sizeBytes))
      }
    } catch {
      // Size display is cosmetic; the batch reports its own failures.
    }
  }, [])

  const handleAdd = useCallback(
    (paths: string[]) => {
      addPaths(paths)
      for (const path of paths) void fetchSize(path)
    },
    [addPaths, fetchSize]
  )

  const chooseDestination = async (): Promise<void> => {
    try {
      const res = await window.stash.dialogs.chooseDirectory({ title: 'Choose output folder' })
      if (!res.cancelled && res.path) setDestination(res.path)
    } catch (err) {
      toastError(err)
    }
  }

  const compress = async (): Promise<void> => {
    if (destination === '') return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const req: CompressImagesRequest = {
        paths: items.map((item) => item.path),
        outputDir: destination,
        quality,
        ...(maxDimension > 0 ? { maxDimension } : {}),
        ...(namePattern.trim().length > 0 ? { namePattern } : {})
      }
      const res = await window.stash.processing.compressImages(req)
      setResult(res)

      for (const entry of res.succeeded) {
        recordHistoryQuietly({
          toolId: 'image-compress',
          operation: 'compress',
          inputs: [fileNameOf(entry.source)],
          outputs: [fileNameOf(entry.output)],
          status: 'success',
          message: `${formatBytes(sizes.get(entry.source) ?? entry.bytesWritten)} → ${formatBytes(entry.bytesWritten)}`
        })
      }
      for (const entry of res.failed) {
        recordHistoryQuietly({
          toolId: 'image-compress',
          operation: 'compress',
          inputs: [fileNameOf(entry.source)],
          outputs: [],
          status: 'failure',
          message: entry.error.userMessage
        })
      }

      const ok = res.succeeded.length
      const bad = res.failed.length
      if (res.cancelled) {
        toastSuccess('Compression cancelled', `${ok} finished before stopping.`)
      } else if (bad > 0) {
        toastSuccess(
          `Compressed ${ok} of ${ok + bad} files`,
          `${bad} file${bad === 1 ? '' : 's'} failed.`
        )
      } else {
        toastSuccess(`Compressed ${ok} file${ok === 1 ? '' : 's'}`)
      }
    } catch (err) {
      setError(normalizeError(err))
      toastError(err)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DropZone
        multiple
        accept={[...ACCEPTED_EXTENSIONS]}
        label="Drop images here"
        hint="PNG · JPG · WebP · TIFF · AVIF — originals are never modified"
        dialogTitle="Choose images to compress"
        onFiles={handleAdd}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="image"
          title="Nothing queued yet."
          hint="Drop images above, tune quality and size limits, then compress into a folder you choose. Saved copies get a -min suffix."
        />
      ) : (
        <FileListPanel
          items={items}
          onRemove={removePath}
          onClearAll={clearAll}
          detail={(item) => {
            const size = sizes.get(item.path)
            return size === undefined ? null : formatBytes(size)
          }}
        />
      )}

      <Panel className="p-3.5">
        <SectionHeading>Options</SectionHeading>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <FieldRow label="Quality">
            <Slider
              min={1}
              max={100}
              step={1}
              value={quality}
              aria-label={`Quality, ${quality} percent`}
              onValueChange={setQuality}
              className="w-40"
            />
            <span className="tnum w-8 text-[12px] text-dim">{quality}</span>
          </FieldRow>
          <FieldRow label="Max size" htmlFor="compress-maxdim">
            <Select
              id="compress-maxdim"
              value={maxDimension}
              onChange={(e) => setMaxDimension(Number(e.target.value))}
              className="w-28"
            >
              {MAX_DIMENSION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 0 ? 'Original' : `${option} px`}
                </option>
              ))}
            </Select>
          </FieldRow>
        </div>

        <div className="mt-2 flex flex-col gap-1">
          <FieldRow label="Name pattern" htmlFor="compress-pattern">
            <Input
              id="compress-pattern"
              mono
              value={namePattern}
              placeholder="{name}-min"
              invalid={patternError !== null}
              spellCheck={false}
              onChange={(e) => setNamePattern(e.target.value)}
            />
          </FieldRow>
          {patternError !== null ? (
            <p role="alert" className="pl-[5.75rem] text-[11.5px] leading-snug text-danger">
              {patternError}
            </p>
          ) : (
            <p className="pl-[5.75rem] text-[11.5px] text-faint">
              Use {'{name}'} for the original file name.
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
          <FieldRow label="Save to">
            <Button size="sm" onClick={() => void chooseDestination()}>
              Choose folder…
            </Button>
          </FieldRow>
          {destination && (
            <span
              className="min-w-0 max-w-56 truncate font-mono text-[11px] text-faint"
              title={destination}
            >
              {destination}
            </span>
          )}
        </div>
      </Panel>

      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          loading={running}
          disabled={!canRun}
          onClick={() => void compress()}
        >
          Compress {items.length > 0 ? `${items.length} image${items.length === 1 ? '' : 's'}` : ''}
        </Button>
        {live && (
          <IconButton
            variant="surface"
            size="sm"
            aria-label="Cancel compression"
            title="Cancel"
            onClick={() => void window.stash.progress.cancel(live.operationId)}
          >
            <X size={13} />
          </IconButton>
        )}
        {!canRun && !running && (
          <span className="text-[11px] text-faint">
            {items.length === 0 ? 'Add at least one image.' : 'Choose an output folder first.'}
          </span>
        )}
      </div>

      {live && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={live.ratio ?? null} label="Compressing images" />
          <p className="tnum text-[11.5px] text-faint">{live.message}</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <>
          <SectionHeading>Results</SectionHeading>
          <ul className="flex flex-col gap-1.5">
            {result.succeeded.map((entry) => {
              const original = sizes.get(entry.source)
              const saved =
                original !== undefined && original > 0
                  ? Math.max(0, Math.round((1 - entry.bytesWritten / original) * 100))
                  : null
              return (
                <li key={entry.source} className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-[12.5px] text-ok" title={entry.output}>
                    {fileNameOf(entry.source)} → {fileNameOf(entry.output)}
                    <span className="tnum ml-2 text-faint">
                      {original !== undefined ? `${formatBytes(original)} → ` : ''}
                      {formatBytes(entry.bytesWritten)}
                      {saved !== null ? ` · saved ${saved}%` : ''}
                    </span>
                  </p>
                  <RevealButton path={entry.output} />
                  <CopyPathButton path={entry.output} />
                </li>
              )
            })}
            {result.failed.map((entry) => (
              <li key={entry.source}>
                <ErrorNote error={entry.error} />
              </li>
            ))}
          </ul>
          {(result.failed.length > 0 || result.cancelled) && (
            <p className="text-[11.5px] text-faint">
              {result.cancelled && 'Stopped early — remaining files were skipped. '}
              {result.failed.length} file{result.failed.length === 1 ? '' : 's'} failed.
            </p>
          )}
        </>
      )}
    </div>
  )
}
