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
import { FieldRow, Input, Select } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import type { ConvertImagesRequest, ImageBatchResult, ImageOutputFormat } from '../../../shared/ipc'
import { toastError, toastSuccess } from '../../stores/toasts'
import { FileListPanel } from '../shared/file-list-panel'
import { CopyPathButton, RevealButton } from '../shared/result-actions'
import { useOutputDir } from '../shared/use-output-dir'
import { fileNameOf, useFileList } from '../shared/use-file-list'
import { recordHistoryQuietly, useProgressEvent } from '../shared/use-progress-event'

const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.tiff', '.avif']
const LOSSY_FORMATS: readonly ImageOutputFormat[] = ['jpeg', 'webp', 'avif']

const FORMAT_OPTIONS: Array<{ value: ImageOutputFormat; label: string }> = [
  { value: 'webp', label: 'WebP' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'avif', label: 'AVIF' },
  { value: 'tiff', label: 'TIFF' }
]

export default function ImageConvertTool() {
  const { items, addPaths, removePath, clearAll } = useFileList()
  const [format, setFormat] = useState<ImageOutputFormat>('webp')
  const [quality, setQuality] = useState(80)
  const [namePattern, setNamePattern] = useState('')
  const [destination, setDestination] = useOutputDir('image-convert')
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

  const lossy = (LOSSY_FORMATS as readonly string[]).includes(format)
  const canRun = items.length > 0 && destination !== '' && !running && patternError === null
  // While the batch invoke is awaiting its result, progress events carry the
  // operation id — bind the bar and cancel button to whatever is live.
  const live = running && liveEvent?.status === 'active' ? liveEvent : null

  const chooseDestination = async (): Promise<void> => {
    try {
      const res = await window.stash.dialogs.chooseDirectory({ title: 'Choose output folder' })
      if (!res.cancelled && res.path) setDestination(res.path)
    } catch (err) {
      toastError(err)
    }
  }

  const summarizeToast = (verb: string, res: ImageBatchResult): void => {
    const ok = res.succeeded.length
    const bad = res.failed.length
    if (res.cancelled) {
      toastSuccess('Conversion cancelled', `${ok} finished before stopping.`)
    } else if (bad > 0) {
      toastSuccess(
        `${verb} ${ok} of ${ok + bad} files`,
        `${bad} file${bad === 1 ? '' : 's'} failed.`
      )
    } else {
      toastSuccess(`${verb} ${ok} file${ok === 1 ? '' : 's'}`)
    }
  }

  const recordOutcomes = (res: ImageBatchResult): void => {
    for (const entry of res.succeeded) {
      recordHistoryQuietly({
        toolId: 'image-convert',
        operation: 'convert',
        inputs: [fileNameOf(entry.source)],
        outputs: [fileNameOf(entry.output)],
        status: 'success'
      })
    }
    for (const entry of res.failed) {
      recordHistoryQuietly({
        toolId: 'image-convert',
        operation: 'convert',
        inputs: [fileNameOf(entry.source)],
        outputs: [],
        status: 'failure',
        message: entry.error.userMessage
      })
    }
  }

  const convert = async (): Promise<void> => {
    if (destination === '') return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const req: ConvertImagesRequest = {
        paths: items.map((item) => item.path),
        outputDir: destination,
        format,
        quality,
        ...(namePattern.trim().length > 0 ? { namePattern } : {})
      }
      const res = await window.stash.processing.convertImages(req)
      setResult(res)
      recordOutcomes(res)
      summarizeToast('Converted', res)
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
        dialogTitle="Choose images to convert"
        onFiles={addPaths}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="image"
          title="Nothing queued yet."
          hint="Drop or browse for images above, pick an output format and folder, then convert. Everything runs locally — originals stay untouched."
        />
      ) : (
        <FileListPanel items={items} onRemove={removePath} onClearAll={clearAll} />
      )}

      <Panel className="p-3.5">
        <SectionHeading>Options</SectionHeading>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <FieldRow label="Format" htmlFor="convert-format">
            <Select
              id="convert-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as ImageOutputFormat)}
              className="w-28"
            >
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldRow>
          {lossy && (
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
          )}
        </div>

        <div className="mt-2 flex flex-col gap-1">
          <FieldRow label="Name pattern" htmlFor="convert-pattern">
            <Input
              id="convert-pattern"
              mono
              value={namePattern}
              placeholder="{name}"
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
          onClick={() => void convert()}
        >
          Convert {items.length > 0 ? `${items.length} image${items.length === 1 ? '' : 's'}` : ''}
        </Button>
        {live && (
          <IconButton
            variant="surface"
            size="sm"
            aria-label="Cancel conversion"
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
          <ProgressBar ratio={live.ratio ?? null} label="Converting images" />
          <p className="tnum text-[11.5px] text-faint">{live.message}</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <>
          <SectionHeading>Results</SectionHeading>
          <ul className="flex flex-col gap-1.5">
            {result.succeeded.map((entry) => (
              <li key={entry.source} className="flex items-center gap-2">
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
