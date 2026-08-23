import { useCallback, useState } from 'react'
import { FileDown, X } from 'lucide-react'
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
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, type StashError } from '../../../shared/errors'
import type { PdfCompressResult, PdfInfoResult } from '../../../shared/ipc'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'

interface SelectedPdf {
  path: string
  info: PdfInfoResult | null
}

export default function PdfCompressTool() {
  const [pdf, setPdf] = useState<SelectedPdf | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<(PdfCompressResult & { target: string }) | null>(null)
  const [error, setError] = useState<StashError | null>(null)

  const canRun = pdf !== null && pdf.info !== null && !running

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
        toolId: 'pdf-compress',
        operation: 'compress-pdf',
        inputs: [fileNameOf(path)],
        outputs: [],
        status: 'failure',
        message: normalized.userMessage
      })
    } finally {
      setInfoLoading(false)
    }
  }, [])

  const compress = async (): Promise<void> => {
    if (!pdf?.info || running) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const dialog = await window.stash.dialogs.saveFile({
        defaultName: defaultCompressedName(pdf.path),
        filters: [{ name: 'PDF document', extensions: ['pdf'] }],
        title: 'Save optimized PDF as…'
      })
      if (dialog.cancelled || !dialog.path) return
      const res = await window.stash.pdfs.compress({ path: pdf.path, targetPdf: dialog.path })
      setResult({ ...res, target: dialog.path })
      toastSuccess(
        'Optimized PDF saved',
        `${fileNameOf(dialog.path)} · ${formatBytes(res.bytesWritten)}`
      )
      recordHistoryQuietly({
        toolId: 'pdf-compress',
        operation: 'compress-pdf',
        inputs: [fileNameOf(pdf.path)],
        outputs: [fileNameOf(dialog.path)],
        status: 'success'
      })
    } catch (err) {
      const normalized = normalizeError(err)
      setError(normalized)
      toastError(err)
      recordHistoryQuietly({
        toolId: 'pdf-compress',
        operation: 'compress-pdf',
        inputs: pdf ? [fileNameOf(pdf.path)] : [],
        outputs: [],
        status: 'failure',
        message: normalized.userMessage
      })
    } finally {
      setRunning(false)
    }
  }

  const sizeBefore = pdf?.info?.sizeBytes ?? null
  // Negative savings mean the re-serialized file came out larger — reported
  // honestly in a neutral tone instead of a success badge.
  const savedBytes = result && sizeBefore !== null ? sizeBefore - result.bytesWritten : null
  const savedPercent =
    savedBytes !== null && sizeBefore !== null && sizeBefore > 0
      ? Math.round((savedBytes / sizeBefore) * 1000) / 10
      : null

  return (
    <div className="flex flex-col gap-4">
      <DropZone
        accept={['.pdf']}
        label={pdf ? `Replace ${fileNameOf(pdf.path)}` : 'Drop a PDF here'}
        hint="One document at a time · click to browse"
        dialogTitle="Choose a PDF document to optimize"
        onFiles={(paths) => void loadFile(paths)}
      />

      {!pdf && (
        <EmptyState
          icon="file-text"
          title="No document selected yet."
          hint="Drop or browse for a .pdf above to rewrite its internal structure as compactly as possible — useful for documents exported with bloated object tables."
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
              onClick={() => setPdf(null)}
            >
              <X size={13} />
            </IconButton>
          </div>
          {infoLoading || !pdf.info ? (
            <p role="status" aria-live="polite" className="mt-1 text-[12px] text-faint">
              Reading document…
            </p>
          ) : (
            <p className="tnum mt-1 truncate text-[12px] text-dim">
              <span className="mr-3 font-mono" title={fileNameOf(pdf.path)}>
                {fileNameOf(pdf.path)}
              </span>
              {pdf.info.pageCount} page{pdf.info.pageCount === 1 ? '' : 's'} ·{' '}
              {formatBytes(pdf.info.sizeBytes)}
            </p>
          )}
        </Panel>
      )}

      <Panel className="p-3.5">
        <SectionHeading>What this does</SectionHeading>
        <p className="mt-1.5 text-[12px] leading-relaxed text-dim">
          Lossless structure optimization — does not downsample images.
        </p>
      </Panel>

      {pdf && !infoLoading && pdf.info && (
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            loading={running}
            disabled={!canRun}
            onClick={() => void compress()}
          >
            <FileDown size={13} /> Save optimized copy…
          </Button>
        </div>
      )}

      {running && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={null} indeterminate label="Optimizing PDF" />
          <p className="tnum text-[11.5px] text-faint">Rewriting document structures…</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <>
          {savedBytes !== null && savedBytes >= 0 ? (
            <SuccessNote
              message={`${formatBytes(sizeBefore ?? 0)} → ${formatBytes(result.bytesWritten)} · ${formatBytes(savedBytes)} smaller (${savedPercent}%)`}
            />
          ) : (
            <Panel className="border-line px-3 py-2.5">
              <p className="text-[12.5px] leading-snug text-dim">
                The optimized copy came out slightly larger ({formatBytes(sizeBefore ?? 0)} →{' '}
                {formatBytes(result.bytesWritten)}) — this document was already efficiently
                structured.
              </p>
            </Panel>
          )}
        </>
      )}
    </div>
  )
}

function defaultCompressedName(sourcePath: string): string {
  const base = fileNameOf(sourcePath)
  const dot = base.lastIndexOf('.')
  const stem = dot <= 0 ? base : base.slice(0, dot)
  return `${stem}-optimized.pdf`
}
