import { useState } from 'react'
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
import { DropZone } from '../../components/ui/DropZone'
import { DEFAULT_SELECTED_PRESETS, PRESET_LIST } from '../../../shared/utils/social-presets'
import { normalizeError, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import type { SocialResizeResult } from '../../../shared/ipc'
import { toastError, toastSuccess } from '../../stores/toasts'
import { FileListPanel } from '../shared/file-list-panel'
import { CopyPathButton, RevealButton } from '../shared/result-actions'
import { useOutputDir } from '../shared/use-output-dir'
import { fileNameOf, useFileList } from '../shared/use-file-list'
import { recordHistoryQuietly, useProgressEvent } from '../shared/use-progress-event'

const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.tiff', '.avif']

function toggleSelected(selected: Set<string>, id: string): Set<string> {
  const next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export default function SocialResizerTool() {
  const { items, addPaths, removePath, clearAll } = useFileList()
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED_PRESETS))
  const [destination, setDestination] = useOutputDir('social-resizer')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SocialResizeResult | null>(null)
  const [error, setError] = useState<StashError | null>(null)
  const liveEvent = useProgressEvent()

  const canRun = items.length > 0 && destination !== '' && !running && selected.size > 0
  const totalOutputs = items.length * selected.size
  const live = running && liveEvent?.status === 'active' ? liveEvent : null

  const chooseDestination = async (): Promise<void> => {
    try {
      const res = await window.stash.dialogs.chooseDirectory({ title: 'Choose output folder' })
      if (!res.cancelled && res.path) setDestination(res.path)
    } catch (err) {
      toastError(err)
    }
  }

  const summarizeToast = (res: SocialResizeResult): void => {
    const ok = res.succeeded.length
    const bad = res.failed.length
    if (res.cancelled) {
      toastSuccess('Resizing cancelled', `${ok} finished before stopping.`)
    } else if (bad > 0) {
      toastSuccess(`Resized ${ok} of ${ok + bad}`, `${bad} failed.`)
    } else {
      toastSuccess(`Created ${ok} image${ok === 1 ? '' : 's'}`)
    }
  }

  const recordOutcomes = (res: SocialResizeResult): void => {
    for (const entry of res.succeeded) {
      recordHistoryQuietly({
        toolId: 'social-resizer',
        operation: 'resize',
        inputs: [fileNameOf(entry.source)],
        outputs: [fileNameOf(entry.output)],
        status: 'success',
        message: entry.label
      })
    }
    for (const entry of res.failed) {
      recordHistoryQuietly({
        toolId: 'social-resizer',
        operation: 'resize',
        inputs: [],
        outputs: [],
        status: 'failure',
        message: entry.error.userMessage
      })
    }
  }

  const run = async (): Promise<void> => {
    if (!canRun) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await window.stash.processing.socialResize({
        paths: items.map((item) => item.path),
        outputDir: destination,
        presets: PRESET_LIST.filter((preset) => selected.has(preset.id)).map((preset) => preset.id)
      })
      setResult(res)
      recordOutcomes(res)
      summarizeToast(res)
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
        hint="PNG · JPG · WebP · GIF · TIFF · AVIF — one or many"
        dialogTitle="Choose images to resize"
        onFiles={addPaths}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="crop"
          title="Nothing queued yet."
          hint="Drop or browse for images above and tick the sizes you need — smart cropping keeps the subject in frame. Originals stay untouched."
        />
      ) : (
        <FileListPanel items={items} onRemove={removePath} onClearAll={clearAll} />
      )}

      <Panel className="p-3.5">
        <SectionHeading>Presets</SectionHeading>
        <fieldset className="mt-2">
          <legend className="sr-only">Social media sizes</legend>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {PRESET_LIST.map((preset) => (
              <label
                key={preset.id}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 transition-colors duration-150 ease-out ${
                  selected.has(preset.id)
                    ? 'border-accent/50 bg-accent-soft/50'
                    : 'border-line hover:border-line-strong'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(preset.id)}
                  onChange={() => setSelected(toggleSelected(selected, preset.id))}
                  className="mt-0.5 accent-accent"
                  aria-label={`${preset.label}, ${preset.w} by ${preset.h}`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] text-dim">{preset.label}</span>
                  <span className="tnum block font-mono text-[10.5px] text-faint">
                    {preset.w} × {preset.h}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
          <FieldRowWrapper>
            <Button size="sm" onClick={() => void chooseDestination()}>
              Choose folder…
            </Button>
          </FieldRowWrapper>
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
        <Button variant="primary" loading={running} disabled={!canRun} onClick={() => void run()}>
          Resize {items.length > 0 ? `${items.length} × ${selected.size} ` : ''}
        </Button>
        {live && (
          <IconButton
            variant="surface"
            size="sm"
            aria-label="Cancel resizing"
            title="Cancel"
            onClick={() => void window.stash.progress.cancel(live.operationId)}
          >
            <X size={13} />
          </IconButton>
        )}
        {!canRun && !running && (
          <span className="text-[11px] text-faint">
            {items.length === 0
              ? 'Add at least one image.'
              : selected.size === 0
                ? 'Select at least one preset.'
                : 'Choose an output folder first.'}
          </span>
        )}
      </div>

      {live && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={live.ratio ?? null} label="Resizing to social presets" />
          <p className="tnum text-[11.5px] text-faint">{live.message}</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <>
          <SectionHeading>
            Results{totalOutputs > 0 ? ` — ${result.succeeded.length} of ${totalOutputs}` : ''}
          </SectionHeading>
          <ul className="flex flex-col gap-1.5">
            {result.succeeded.map((entry) => (
              <li key={entry.output} className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[12.5px] text-ok" title={entry.output}>
                  {entry.label}
                  <span className="tnum ml-2 text-faint">{formatBytes(entry.bytesWritten)}</span>
                </p>
                <RevealButton path={entry.output} />
                <CopyPathButton path={entry.output} />
              </li>
            ))}
            {result.failed.map((entry) => (
              <li key={entry.label}>
                <ErrorNote error={entry.error} />
              </li>
            ))}
          </ul>
          {(result.failed.length > 0 || result.cancelled) && (
            <p className="text-[11.5px] text-faint">
              {result.cancelled && 'Stopped early — remaining outputs were skipped. '}
              {result.failed.length} failed.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** Local stand-in for FieldRow so the destination row aligns with other tools. */
function FieldRowWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-20 shrink-0 text-right text-[12px] text-faint">Save to</span>
      {children}
    </div>
  )
}
