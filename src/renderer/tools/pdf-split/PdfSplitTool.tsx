import { useCallback, useState } from 'react'
import { FileOutput, X } from 'lucide-react'
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
import { FieldRow, Input } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, type StashError } from '../../../shared/errors'
import type { PdfInfoResult, PdfSplitResult } from '../../../shared/ipc'
import type { PageRangeParse } from '../../../shared/utils/page-ranges'
import { parsePageRanges } from '../../../shared/utils/page-ranges'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { CopyPathButton, RevealButton } from '../shared/result-actions'
import { useOutputDir } from '../shared/use-output-dir'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly, useProgressEvent } from '../shared/use-progress-event'

interface SelectedPdf {
  path: string
  info: PdfInfoResult | null
}

export default function PdfSplitTool() {
  const [pdf, setPdf] = useState<SelectedPdf | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [pageSpec, setPageSpec] = useState('')
  const [destination, setDestination] = useOutputDir('pdf-split')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PdfSplitResult | null>(null)
  const [error, setError] = useState<StashError | null>(null)
  const liveEvent = useProgressEvent()

  // Live validation against the fetched page count; the main process
  // re-validates authoritatively before splitting.
  const validation: PageRangeParse | null =
    pdf?.info && pageSpec.length > 0 ? parsePageRanges(pageSpec, pdf.info.pageCount) : null

  const canRun =
    pdf?.info !== null &&
    pdf !== undefined &&
    destination !== '' &&
    validation !== null &&
    'groups' in validation &&
    !running

  const live = running && liveEvent?.status === 'active' ? liveEvent : null

  const loadFile = useCallback(async (paths: string[]): Promise<void> => {
    const path = paths[0]
    if (!path) return
    setPdf({ path, info: null })
    setResult(null)
    setError(null)
    setInfoLoading(true)
    try {
      const info = await window.stash.pdfs.getInfo(path)
      setPdf((prev) => (prev?.path === path ? { path, info } : prev))
    } catch (err) {
      const normalized = normalizeError(err)
      setPdf(null)
      setError(normalized)
      recordHistoryQuietly({
        toolId: 'pdf-split',
        operation: 'split-pdf',
        inputs: [fileNameOf(path)],
        outputs: [],
        status: 'failure',
        message: normalized.userMessage
      })
    } finally {
      setInfoLoading(false)
    }
  }, [])

  const chooseDestination = async (): Promise<void> => {
    try {
      const res = await window.stash.dialogs.chooseDirectory({ title: 'Choose output folder' })
      if (!res.cancelled && res.path) setDestination(res.path)
    } catch (err) {
      toastError(err)
    }
  }

  const split = async (): Promise<void> => {
    if (!pdf?.info || destination === '' || !validation || !('groups' in validation)) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await window.stash.pdfs.split({
        path: pdf.path,
        pageSpec,
        outputDir: destination
      })
      setResult(res)
      const okCount = res.succeeded.length
      if (res.cancelled) {
        toastSuccess('Split cancelled', `${okCount} finished before stopping.`)
      } else if (okCount > 0) {
        toastSuccess(
          `Wrote ${okCount} PDF${okCount === 1 ? '' : 's'}`,
          `${res.failed.length} part${res.failed.length === 1 ? '' : 's'} failed.`
        )
      }
      for (const entry of res.succeeded) {
        recordHistoryQuietly({
          toolId: 'pdf-split',
          operation: 'split-pdf',
          inputs: [fileNameOf(pdf.path)],
          outputs: [fileNameOf(entry.output)],
          status: 'success'
        })
      }
      for (const entry of res.failed) {
        recordHistoryQuietly({
          toolId: 'pdf-split',
          operation: 'split-pdf',
          inputs: [fileNameOf(pdf.path)],
          outputs: [],
          status: 'failure',
          message: entry.error.userMessage
        })
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
        accept={['.pdf']}
        label={pdf ? `Replace ${fileNameOf(pdf.path)}` : 'Drop a PDF here'}
        hint="One document at a time · click to browse"
        dialogTitle="Choose a PDF document to split"
        onFiles={(paths) => void loadFile(paths)}
      />

      {!pdf && (
        <EmptyState
          icon="file-text"
          title="No document selected yet."
          hint="Drop or browse for a .pdf above, describe which pages go into each output file — e.g. one range per chapter — and pick a folder. Each group becomes its own PDF."
        />
      )}

      {pdf && (
        <Panel className="p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeading>Document</SectionHeading>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label={`Close ${fileNameOf(pdf.path)}`}
              title="Close document"
              onClick={() => {
                setPdf(null)
                setPageSpec('')
              }}
            >
              <X size={13} />
            </IconButton>
          </div>
          {infoLoading || !pdf.info ? (
            <p role="status" aria-live="polite" className="mt-1 text-[12px] text-faint">
              Reading document…
            </p>
          ) : (
            <p className="tnum mt-1 text-[12px] text-dim">
              <span className="mr-3 truncate font-mono" title={fileNameOf(pdf.path)}>
                {fileNameOf(pdf.path)}
              </span>
              {pdf.info.pageCount} page{pdf.info.pageCount === 1 ? '' : 's'} ·{' '}
              {formatBytes(pdf.info.sizeBytes)}
            </p>
          )}
        </Panel>
      )}

      {pdf && !infoLoading && pdf.info && (
        <Panel className="p-3.5">
          <SectionHeading>Page groups</SectionHeading>
          <div className="mt-2 flex flex-col gap-1.5">
            <FieldRow label="Pages" htmlFor="split-pages">
              <Input
                id="split-pages"
                value={pageSpec}
                placeholder="e.g. 1-3, 7, 10-12"
                invalid={pageSpec.length > 0 && validation !== null && 'error' in validation}
                onChange={(e) => setPageSpec(e.target.value)}
                spellCheck={false}
              />
            </FieldRow>
            {validation && 'error' in validation ? (
              <p role="alert" className="pl-[5.75rem] text-[11.5px] leading-snug text-danger">
                {validation.error}
              </p>
            ) : validation && 'groups' in validation ? (
              <p className="tnum pl-[5.75rem] text-[11.5px] text-ok">
                {validation.groups.length} file{validation.groups.length === 1 ? '' : 's'} ·{' '}
                {validation.groups.map((group) => group.length).join(' + ')} pages
              </p>
            ) : (
              <p className="pl-[5.75rem] text-[11.5px] text-faint">
                Comma-separate ranges; every group becomes its own PDF.
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
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-faint">
            Outputs are named automatically from the document name — e.g. report-p1.pdf,
            report-p1-p3.pdf, one file per group.
          </p>
        </Panel>
      )}

      {pdf && !infoLoading && pdf.info && (
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            loading={running}
            disabled={!canRun}
            onClick={() => void split()}
          >
            <FileOutput size={13} /> Split
          </Button>
          {live && (
            <IconButton
              variant="surface"
              size="sm"
              aria-label="Cancel split"
              title="Cancel"
              onClick={() => void window.stash.progress.cancel(live.operationId)}
            >
              <X size={13} />
            </IconButton>
          )}
          {!canRun && !running && (
            <span className="text-[11px] text-faint">
              {destination === ''
                ? 'Choose an output folder first.'
                : pageSpec.length === 0
                  ? 'Enter the page ranges to extract.'
                  : ''}
            </span>
          )}
        </div>
      )}

      {live && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={live.ratio ?? null} label="Splitting PDF" />
          <p className="tnum text-[11.5px] text-faint">{live.message}</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && result.succeeded.length > 0 && (
        <>
          <SuccessNote
            message={`Split into ${result.succeeded.length} file${
              result.succeeded.length === 1 ? '' : 's'
            }${result.cancelled ? ' (cancelled early)' : ''}.`}
          />
          <SectionHeading>Results</SectionHeading>
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
        </>
      )}
    </div>
  )
}
