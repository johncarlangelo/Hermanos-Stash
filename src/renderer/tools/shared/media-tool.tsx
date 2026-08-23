import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import {
  EmptyState,
  ErrorNote,
  Panel,
  ProgressBar,
  SectionHeading,
  SuccessNote
} from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { FieldRow } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, type StashError } from '../../../shared/errors'
import type { MediaBatchResult, MediaInfo } from '../../../shared/ipc'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { fileNameOf } from './use-file-list'
import { recordHistoryQuietly, useProgressEvent } from './use-progress-event'

/**
 * Shared workspace for single-file FFmpeg tools: capability gating, one-file
 * input with automatic probing, output-folder choice, progress + cancellation
 * and verified results. Individual tools only supply their options panel and
 * the IPC call (TOOL_SPEC.md → UI contract).
 */

/** Latest media capabilities from main; null until the first answer lands. */
export function useMediaCapabilities(): {
  available: boolean
  ffmpegVersion?: string
} | null {
  const [caps, setCaps] = useState<{
    available: boolean
    ffmpegVersion?: string
  } | null>(null)
  useEffect(() => {
    let active = true
    void window.stash.media
      .getCapabilities()
      .then((res) => {
        if (active) setCaps(res)
      })
      .catch(() => {
        if (active) setCaps({ available: false })
      })
    return () => {
      active = false
    }
  }, [])
  return caps
}

/** Compact `m:ss` duration, tolerant of missing data. */
export function formatDuration(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—'
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** One-line human summary of probed metadata, e.g. "0:31 · 1280×720 · h264". */
export function mediaSummaryLine(info: MediaInfo | null, sizeBytes?: number): string {
  if (!info) return ''
  const parts: string[] = []
  parts.push(formatDuration(info.durationSec))
  const video = info.streams.find((stream) => stream.type === 'video')
  if (video?.width !== undefined && video?.height !== undefined) {
    parts.push(`${video.width}×${video.height}`)
  }
  const audio = info.streams.find((stream) => stream.type === 'audio')
  const codec = video?.codec ?? audio?.codec
  if (codec) parts.push(codec)
  if (sizeBytes !== undefined && sizeBytes > 0) parts.push(formatBytes(sizeBytes))
  return parts.join(' · ')
}

export interface SingleFileMediaToolProps {
  /** Stable tool id used for history records. */
  toolId: string
  /** History operation label, e.g. 'convert'. */
  operation: string
  /** Toast + button verb, e.g. 'Converted'. */
  verb: string
  accept: string[]
  dropLabel: string
  dropHint: string
  dialogTitle: string
  /** Shown when FFmpeg is unavailable — where to place the binaries. */
  emptyHint: string
  actionLabel: string
  progressLabel: string
  icon?: string
  /** One restrained line shown under the input, e.g. a caveat. */
  note?: string
  /** Extra readiness gate beyond file + folder (e.g. an option picked). */
  readyOverride?: boolean
  renderOptions: () => React.ReactNode
  runRequest: (inputPath: string, outputDir: string) => Promise<MediaBatchResult>
}

export function SingleFileMediaTool(props: SingleFileMediaToolProps): React.JSX.Element {
  const capabilities = useMediaCapabilities()
  const [inputPath, setInputPath] = useState<string | null>(null)
  const [probed, setProbed] = useState<MediaInfo | null>(null)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [destination, setDestination] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<MediaBatchResult | null>(null)
  const [error, setError] = useState<StashError | null>(null)
  const liveEvent = useProgressEvent()

  const handleFile = useCallback((paths: string[]) => {
    const next = paths[0] ?? null
    setResult(null)
    setError(null)
    setProbed(null)
    setProbeError(null)
    setInputPath(next)
    if (next === null) return
    void window.stash.media
      .probe(next)
      .then((res) => setProbed(res.info))
      .catch((err) => setProbeError(normalizeError(err).userMessage))
  }, [])

  const canRun =
    inputPath !== null && destination !== null && !running && (props.readyOverride ?? true)

  const live = running && liveEvent?.status === 'active' ? liveEvent : null

  const chooseDestination = async (): Promise<void> => {
    try {
      const res = await window.stash.dialogs.chooseDirectory({ title: 'Choose output folder' })
      if (!res.cancelled && res.path) setDestination(res.path)
    } catch (err) {
      toastError(err)
    }
  }

  const run = async (): Promise<void> => {
    if (inputPath === null || destination === null) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await props.runRequest(inputPath, destination)
      setResult(res)

      for (const entry of res.succeeded) {
        recordHistoryQuietly({
          toolId: props.toolId,
          operation: props.operation,
          inputs: [fileNameOf(entry.source)],
          outputs: [fileNameOf(entry.output)],
          status: 'success',
          message: formatBytes(entry.bytesWritten)
        })
      }
      for (const entry of res.failed) {
        recordHistoryQuietly({
          toolId: props.toolId,
          operation: props.operation,
          inputs: [fileNameOf(entry.source)],
          outputs: [],
          status: 'failure',
          message: entry.error.userMessage
        })
      }

      if (res.cancelled) {
        toastSuccess(`${props.verb} cancelled`)
      } else if (res.failed.length > 0) {
        toastSuccess(
          `${props.verb} finished with ${res.failed.length} failure${res.failed.length === 1 ? '' : 's'}`
        )
      } else {
        toastSuccess(
          `${props.verb} ${fileNameOf(inputPath)}`,
          res.succeeded[0] ? formatBytes(res.succeeded[0].bytesWritten) : undefined
        )
      }
    } catch (err) {
      setError(normalizeError(err))
      toastError(err)
    } finally {
      setRunning(false)
    }
  }

  if (capabilities !== null && !capabilities.available) {
    return (
      <EmptyState
        icon={props.icon ?? 'film'}
        title="FFmpeg not found."
        hint={
          props.emptyHint ??
          'Place ffmpeg.exe and ffprobe.exe into the resources/ffmpeg folder of this application, then reopen the tool.'
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {!inputPath ? (
        <DropZone
          accept={[...props.accept]}
          label={props.dropLabel}
          hint={props.dropHint}
          dialogTitle={props.dialogTitle}
          onFiles={handleFile}
        />
      ) : (
        <Panel className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate text-[13px]" title={inputPath}>
              {fileNameOf(inputPath)}
            </p>
            <p className="tnum mt-0.5 text-[11.5px] text-faint">
              {probed ? mediaSummaryLine(probed) : (probeError ?? 'Inspecting…')}
            </p>
          </div>
          <IconButton
            variant="surface"
            size="sm"
            aria-label="Remove selected file"
            title="Remove"
            disabled={running}
            onClick={() => handleFile([])}
          >
            <X size={13} />
          </IconButton>
        </Panel>
      )}

      {props.note && <p className="text-[11.5px] text-faint">{props.note}</p>}

      <Panel className="p-3.5">
        <SectionHeading>Options</SectionHeading>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          {props.renderOptions()}
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
        <Button variant="primary" loading={running} disabled={!canRun} onClick={() => void run()}>
          {props.actionLabel}
        </Button>
        {live && (
          <IconButton
            variant="surface"
            size="sm"
            aria-label={`Cancel ${props.progressLabel}`}
            title="Cancel"
            onClick={() => void window.stash.progress.cancel(live.operationId)}
          >
            <X size={13} />
          </IconButton>
        )}
        {!canRun && !running && (
          <span className="text-[11px] text-faint">
            {inputPath === null
              ? 'Add a file first.'
              : destination === null
                ? 'Choose an output folder first.'
                : ''}
          </span>
        )}
      </div>

      {live && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={live.ratio ?? null} label={props.progressLabel} />
          <p className="tnum text-[11.5px] text-faint">{live.message}</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <>
          <SectionHeading>Results</SectionHeading>
          <ul className="flex flex-col gap-1.5">
            {result.succeeded.map((entry) => {
              const original = probed?.sizeBytes
              const saved =
                original !== undefined && original > 0 && entry.bytesWritten < original
                  ? Math.max(1, Math.round((1 - entry.bytesWritten / original) * 100))
                  : null
              return (
                <li key={entry.source} className="flex flex-col gap-1">
                  <p className="text-[12.5px] text-ok" title={entry.output}>
                    {fileNameOf(entry.output)}
                    <span className="tnum ml-2 text-faint">
                      {original !== undefined ? `${formatBytes(original)} → ` : ''}
                      {formatBytes(entry.bytesWritten)}
                      {saved !== null ? ` · saved ${saved}%` : ''}
                    </span>
                  </p>
                  {entry.verified && <SuccessNote message="Output verified" />}
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
              {result.cancelled && 'Stopped early. '}
              {result.failed.length} failure{result.failed.length === 1 ? '' : 's'}.
            </p>
          )}
        </>
      )}
    </div>
  )
}
