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
import { Slider } from '../../components/ui/Slider'
import { FieldRow, Input } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import type { ImageBatchResult, WatermarkPosition } from '../../../shared/ipc'
import { toastError, toastSuccess } from '../../stores/toasts'
import { FileListPanel } from '../shared/file-list-panel'
import { CopyPathButton, RevealButton } from '../shared/result-actions'
import { useOutputDir } from '../shared/use-output-dir'
import { fileNameOf, useFileList } from '../shared/use-file-list'
import { recordHistoryQuietly, useProgressEvent } from '../shared/use-progress-event'

const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.tiff', '.avif']

const POSITION_GRID: Array<WatermarkPosition | null> = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'center',
  'bottom-right',
  null,
  'bottom-center',
  null
]

function positionLabel(position: WatermarkPosition): string {
  return `Position ${position.replaceAll('-', ' ')}`
}

const FULL_HEX = /^#[0-9a-fA-F]{6}$/

export default function ImageWatermarkTool() {
  const { items, addPaths, removePath, clearAll } = useFileList()
  const [text, setText] = useState('')
  const [position, setPosition] = useState<WatermarkPosition>('bottom-right')
  const [fontSize, setFontSize] = useState(32)
  const [opacityPct, setOpacityPct] = useState(50)
  const [color, setColor] = useState('#ffffff')
  const [destination, setDestination] = useOutputDir('image-watermark')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ImageBatchResult | null>(null)
  const [error, setError] = useState<StashError | null>(null)
  const liveEvent = useProgressEvent()

  const canRun = items.length > 0 && destination !== '' && !running && text.trim().length > 0
  const live = running && liveEvent?.status === 'active' ? liveEvent : null

  const chooseDestination = async (): Promise<void> => {
    try {
      const res = await window.stash.dialogs.chooseDirectory({ title: 'Choose output folder' })
      if (!res.cancelled && res.path) setDestination(res.path)
    } catch (err) {
      toastError(err)
    }
  }

  const summarizeToast = (res: ImageBatchResult): void => {
    const ok = res.succeeded.length
    const bad = res.failed.length
    if (res.cancelled) {
      toastSuccess('Watermarking cancelled', `${ok} finished before stopping.`)
    } else if (bad > 0) {
      toastSuccess(
        `Stamped ${ok} of ${ok + bad} files`,
        `${bad} file${bad === 1 ? '' : 's'} failed.`
      )
    } else {
      toastSuccess(`Stamped ${ok} file${ok === 1 ? '' : 's'}`)
    }
  }

  const recordOutcomes = (res: ImageBatchResult): void => {
    for (const entry of res.succeeded) {
      recordHistoryQuietly({
        toolId: 'image-watermark',
        operation: 'watermark',
        inputs: [fileNameOf(entry.source)],
        outputs: [fileNameOf(entry.output)],
        status: 'success'
      })
    }
    for (const entry of res.failed) {
      recordHistoryQuietly({
        toolId: 'image-watermark',
        operation: 'watermark',
        inputs: [fileNameOf(entry.source)],
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
      const res = await window.stash.processing.watermarkImages({
        paths: items.map((item) => item.path),
        outputDir: destination,
        text,
        position,
        fontSize,
        color,
        opacity: opacityPct / 100
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
        hint="PNG · JPG · WebP · GIF · TIFF · AVIF — add as many as you like"
        dialogTitle="Choose images to watermark"
        onFiles={addPaths}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="image"
          title="Nothing queued yet."
          hint="Drop or browse for images above, write your watermark text and pick a spot — every output is a new file, originals stay untouched."
        />
      ) : (
        <FileListPanel items={items} onRemove={removePath} onClearAll={clearAll} />
      )}

      <Panel className="p-3.5">
        <SectionHeading>Options</SectionHeading>
        <div className="mt-2 flex flex-col gap-2">
          <FieldRow label="Text" htmlFor="wm-text">
            <Input
              id="wm-text"
              mono
              value={text}
              placeholder="© Your Studio"
              maxLength={60}
              onChange={(e) => setText(e.target.value)}
            />
          </FieldRow>

          <FieldRow label="Position">
            <div
              role="group"
              aria-label="Watermark position"
              className="grid w-fit grid-cols-3 gap-1"
            >
              {POSITION_GRID.map((cell, index) =>
                cell === null ? (
                  <span key={`empty-${index}`} />
                ) : (
                  <button
                    key={cell}
                    type="button"
                    aria-pressed={position === cell}
                    aria-label={positionLabel(cell)}
                    onClick={() => setPosition(cell)}
                    className={`h-7 w-[4.5rem] cursor-pointer rounded-md border text-[11px] transition-colors duration-150 ease-out ${
                      position === cell
                        ? 'border-accent/60 bg-accent-soft text-accent'
                        : 'border-line text-faint hover:border-line-strong hover:text-dim'
                    }`}
                  >
                    {cell.replaceAll('-', ' ')}
                  </button>
                )
              )}
            </div>
          </FieldRow>

          <FieldRow label="Size">
            <Slider
              min={12}
              max={144}
              step={1}
              value={fontSize}
              aria-label={`Font size, ${fontSize} pixels`}
              onValueChange={setFontSize}
              className="w-40"
            />
            <span className="tnum w-12 text-[12px] text-dim">{fontSize}px</span>
          </FieldRow>

          <FieldRow label="Opacity">
            <Slider
              min={5}
              max={100}
              step={1}
              value={opacityPct}
              aria-label={`Opacity, ${opacityPct} percent`}
              onValueChange={setOpacityPct}
              className="w-40"
            />
            <span className="tnum w-12 text-[12px] text-dim">{opacityPct}%</span>
          </FieldRow>

          <FieldRow label="Color" htmlFor="wm-color">
            <Input
              id="wm-color"
              mono
              value={color}
              invalid={!/^#[0-9a-fA-F]{3}$/.test(color) && !FULL_HEX.test(color)}
              className="w-24"
              spellCheck={false}
              onChange={(e) => setColor(e.target.value)}
            />
            <input
              type="color"
              aria-label="Pick watermark color"
              value={FULL_HEX.test(color) ? color.toLowerCase() : '#ffffff'}
              onChange={(e) => setColor(e.target.value)}
              className="h-8.5 w-10 shrink-0 cursor-pointer rounded-md border border-line bg-base p-0.5"
            />
          </FieldRow>
        </div>
        {!/^#[0-9a-fA-F]{3}$/.test(color) && !FULL_HEX.test(color) ? (
          <p role="alert" className="mt-2 pl-[5.75rem] text-[11.5px] leading-snug text-danger">
            Color must be hex, like {'#ffffff'} or {'#fff'}.
          </p>
        ) : (
          <p className="mt-2 pl-[5.75rem] text-[11.5px] text-faint">
            Up to 60 characters · stamped as vector-sharp overlay text.
          </p>
        )}

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
        <Button variant="primary" loading={running} disabled={!canRun} onClick={() => void run()}>
          Watermark{' '}
          {items.length > 0 ? `${items.length} image${items.length === 1 ? '' : 's'}` : ''}
        </Button>
        {live && (
          <IconButton
            variant="surface"
            size="sm"
            aria-label="Cancel watermarking"
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
              : text.trim().length === 0
                ? 'Write your watermark text first.'
                : 'Choose an output folder first.'}
          </span>
        )}
      </div>

      {live && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={live.ratio ?? null} label="Watermarking images" />
          <p className="tnum text-[11.5px] text-faint">{live.message}</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <>
          <SectionHeading>Results</SectionHeading>
          <ul className="flex flex-col gap-1.5">
            {result.succeeded.map((entry) => (
              <li key={entry.output} className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[12.5px] text-ok" title={entry.output}>
                  {fileNameOf(entry.source)} → {fileNameOf(entry.output)}
                  <span className="tnum ml-2 text-faint">{formatBytes(entry.bytesWritten)}</span>
                </p>
                <RevealButton path={entry.output} />
                <CopyPathButton path={entry.output} />
              </li>
            ))}
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
