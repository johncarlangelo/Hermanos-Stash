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
import { FieldRow } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import type { IconPackResult } from '../../../shared/ipc'
import { toastError, toastSuccess } from '../../stores/toasts'
import { fileNameOf } from '../shared/use-file-list'
import { CopyPathButton, RevealButton } from '../shared/result-actions'
import { useOutputDir } from '../shared/use-output-dir'
import { recordHistoryQuietly, useProgressEvent } from '../shared/use-progress-event'

const ACCEPTED_EXTENSIONS = ['.png', '.svg']

/** Display size for a pack artifact name, e.g. "icon-128.png" → "128×128". */
function sizeLabel(name: string): string | null {
  const match = /^icon-(\d+)\.png$/.exec(name)
  if (match) return `${match[1]}×${match[1]}`
  return name === 'favicon.ico' ? '256×256 · .ico' : null
}

export default function IconPackTool() {
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [destination, setDestination] = useOutputDir('icon-pack')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<IconPackResult | null>(null)
  const [error, setError] = useState<StashError | null>(null)
  const liveEvent = useProgressEvent()

  const canRun = logoPath !== null && destination !== '' && !running
  const live = running && liveEvent?.status === 'active' ? liveEvent : null

  const chooseDestination = async (): Promise<void> => {
    try {
      const res = await window.stash.dialogs.chooseDirectory({ title: 'Choose output folder' })
      if (!res.cancelled && res.path) setDestination(res.path)
    } catch (err) {
      toastError(err)
    }
  }

  const recordOutcomes = (res: IconPackResult): void => {
    if (!logoPath) return
    for (const entry of res.succeeded) {
      recordHistoryQuietly({
        toolId: 'icon-pack',
        operation: 'generate-pack',
        inputs: [fileNameOf(logoPath)],
        outputs: [entry.name],
        status: 'success'
      })
    }
    for (const entry of res.failed) {
      recordHistoryQuietly({
        toolId: 'icon-pack',
        operation: 'generate-pack',
        inputs: [fileNameOf(logoPath)],
        outputs: [],
        status: 'failure',
        message: entry.error.userMessage
      })
    }
  }

  const generate = async (): Promise<void> => {
    if (!canRun || !logoPath) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await window.stash.icons.generatePack({
        path: logoPath,
        outputDir: destination
      })
      setResult(res)
      recordOutcomes(res)
      const ok = res.succeeded.length
      if (res.cancelled) {
        toastSuccess('Pack cancelled', `${ok} files finished before stopping.`)
      } else if (res.failed.length > 0) {
        toastSuccess(`Generated ${ok} of ${ok + res.failed.length} files`)
      } else {
        toastSuccess(`Generated ${ok} icon files`, `Saved into ${fileNameOf(destination)}`)
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
      {!logoPath && (
        <DropZone
          accept={[...ACCEPTED_EXTENSIONS]}
          label="Drop your logo here"
          hint="PNG or SVG · square sources crop best — everything else is center-cropped"
          dialogTitle="Choose a logo image"
          onFiles={(paths) => setLogoPath(paths[0] ?? null)}
        />
      )}

      {logoPath && (
        <Panel className="p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeading>Logo</SectionHeading>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label={`Remove ${fileNameOf(logoPath)}`}
              title="Remove logo"
              disabled={running}
              onClick={() => setLogoPath(null)}
            >
              <X size={13} />
            </IconButton>
          </div>
          <p className="mt-1 truncate font-mono text-[12px] text-dim" title={logoPath}>
            {fileNameOf(logoPath)}
          </p>
        </Panel>
      )}

      <Panel className="p-3.5">
        <SectionHeading>What you get</SectionHeading>
        <p className="mt-2 text-[12px] leading-relaxed text-dim">
          Nine PNG sizes plus a favicon.ico — generated locally in one pass:
        </p>
        <p className="tnum mt-1.5 font-mono text-[11px] leading-relaxed text-faint">
          icon-16 · icon-32 · icon-48 · icon-64 · icon-128 · icon-180 · icon-192 · icon-256 ·
          icon-512 · favicon.ico
        </p>
        <p className="mt-2 border-t border-line pt-2.5 text-[11.5px] leading-relaxed text-faint">
          The logo is center-cropped to a square master before resizing. SVG logos rasterize at
          their natural size first, so very small SVG sources may soften when upscaled.
        </p>
      </Panel>

      <Panel className="p-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
          onClick={() => void generate()}
        >
          Generate pack
        </Button>
        {live && (
          <IconButton
            variant="surface"
            size="sm"
            aria-label="Cancel generation"
            title="Cancel"
            onClick={() => void window.stash.progress.cancel(live.operationId)}
          >
            <X size={13} />
          </IconButton>
        )}
        {!canRun && !running && (
          <span className="text-[11px] text-faint">
            {logoPath === null ? 'Add a logo first.' : 'Choose an output folder first.'}
          </span>
        )}
      </div>

      {live && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={live.ratio ?? null} label="Generating icon pack" />
          <p className="tnum text-[11.5px] text-faint">{live.message}</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && result.succeeded.length > 0 && (
        <>
          <SectionHeading>Results</SectionHeading>
          <ul className="flex flex-col gap-1.5">
            {result.succeeded.map((entry) => (
              <li key={entry.path} className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[12.5px] text-ok" title={entry.path}>
                  {entry.name}
                  {sizeLabel(entry.name) && (
                    <span className="tnum ml-2 text-faint">{sizeLabel(entry.name)}</span>
                  )}
                  <span className="tnum ml-2 text-faint">{formatBytes(entry.bytesWritten)}</span>
                </p>
                <RevealButton path={entry.path} />
                <CopyPathButton path={entry.path} />
              </li>
            ))}
            {result.failed.map((entry) => (
              <li key={entry.name}>
                <ErrorNote error={entry.error} />
              </li>
            ))}
          </ul>
          {(result.failed.length > 0 || result.cancelled) && (
            <p className="text-[11.5px] text-faint">
              {result.cancelled && 'Stopped early — remaining sizes were skipped. '}
              {result.failed.length} file{result.failed.length === 1 ? '' : 's'} failed.
            </p>
          )}
        </>
      )}

      {!logoPath && !error && (
        <EmptyState
          icon="image"
          title="No logo selected yet."
          hint="Drop or browse for a PNG or SVG above — Stash derives every standard app and favicon size from it, entirely offline."
        />
      )}
    </div>
  )
}
