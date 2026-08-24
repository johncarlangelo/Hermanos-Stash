import { useCallback, useState } from 'react'
import { ArrowDownUp, X } from 'lucide-react'
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
import { OutputNameField } from '../shared/OutputNameField'
import { validateOutputName } from '../shared/output-name'
import { normalizeError, type StashError } from '../../../shared/errors'
import type { PdfInfoResult, PdfReorderResult } from '../../../shared/ipc'
import type { PageSequenceParse } from '../../../shared/utils/page-ranges'
import { parsePageSequence } from '../../../shared/utils/page-ranges'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'

interface SelectedPdf {
  path: string
  info: PdfInfoResult | null
}

export default function PdfReorderTool() {
  const [pdf, setPdf] = useState<SelectedPdf | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [pageSpec, setPageSpec] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<(PdfReorderResult & { target: string }) | null>(null)
  const [error, setError] = useState<StashError | null>(null)

  const [outputName, setOutputName] = useState('')

  // A full explicit sequence is required — 'all' carries no ordering intent.
  const isAll = pageSpec.trim().toLowerCase() === 'all'
  const validation: PageSequenceParse | null =
    pdf?.info && pageSpec.length > 0 && !isAll
      ? parsePageSequence(pageSpec, pdf.info.pageCount)
      : null

  const outputCheck = validateOutputName(outputName, '.pdf')
  const nameError = outputCheck.ok ? null : outputCheck.error

  const canRun =
    pdf !== null &&
    pdf.info !== null &&
    !running &&
    validation !== null &&
    'pages' in validation &&
    outputCheck.ok

  const loadFile = useCallback(async (paths: string[]): Promise<void> => {
    const path = paths[0]
    if (!path) return
    setPdf({ path, info: null })
    setResult(null)
    setError(null)
    setPageSpec('')
    setOutputName(defaultReorderedName(path))
    setInfoLoading(true)
    try {
      const info = await window.stash.pdfs.getInfo(path)
      setPdf((prev) => (prev?.path === path ? { path, info } : prev))
    } catch (err) {
      const normalized = normalizeError(err)
      setPdf(null)
      setError(normalized)
      recordHistoryQuietly({
        toolId: 'pdf-reorder',
        operation: 'reorder-pdf',
        inputs: [fileNameOf(path)],
        outputs: [],
        status: 'failure',
        message: normalized.userMessage
      })
    } finally {
      setInfoLoading(false)
    }
  }, [])

  const reorder = async (): Promise<void> => {
    if (!pdf?.info || running || !validation || !('pages' in validation)) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const dialog = await window.stash.dialogs.saveFile({
        defaultName: outputName,
        filters: [{ name: 'PDF document', extensions: ['pdf'] }],
        title: 'Save reordered PDF as…'
      })
      if (dialog.cancelled || !dialog.path) return
      const res = await window.stash.pdfs.reorder({
        path: pdf.path,
        pageSpec,
        targetPdf: dialog.path
      })
      setResult({ ...res, target: dialog.path })
      toastSuccess(
        `Arranged ${res.pageCount} page${res.pageCount === 1 ? '' : 's'}`,
        `${fileNameOf(dialog.path)} · ${formatBytes(res.bytesWritten)}`
      )
      recordHistoryQuietly({
        toolId: 'pdf-reorder',
        operation: 'reorder-pdf',
        inputs: [fileNameOf(pdf.path)],
        outputs: [fileNameOf(dialog.path)],
        status: 'success'
      })
    } catch (err) {
      const normalized = normalizeError(err)
      setError(normalized)
      toastError(err)
      recordHistoryQuietly({
        toolId: 'pdf-reorder',
        operation: 'reorder-pdf',
        inputs: [fileNameOf(pdf.path)],
        outputs: [],
        status: 'failure',
        message: normalized.userMessage
      })
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
        dialogTitle="Choose a PDF document to rearrange"
        onFiles={(paths) => void loadFile(paths)}
      />

      {!pdf && (
        <EmptyState
          icon="file-text"
          title="No document selected yet."
          hint={
            'Write the new page order as a sequence — e.g. "3, 1-2" puts page 3 first. The output contains exactly the pages you list, in exactly the order you list them.'
          }
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

      {pdf && !infoLoading && pdf.info && (
        <Panel className="p-3.5">
          <SectionHeading>New order</SectionHeading>
          <div className="mt-2 flex flex-col gap-1.5">
            <FieldRow label="Pages" htmlFor="reorder-pages">
              <Input
                id="reorder-pages"
                value={pageSpec}
                placeholder="e.g. 3, 1-2"
                invalid={
                  (validation !== null && 'error' in validation) || (isAll && pageSpec.length > 0)
                }
                onChange={(e) => {
                  setPageSpec(e.target.value)
                  setResult(null)
                }}
                spellCheck={false}
              />
            </FieldRow>
            {isAll && pageSpec.length > 0 ? (
              <p role="alert" className="pl-[5.75rem] text-[11.5px] leading-snug text-danger">
                List every page explicitly — "all" has no defined order here.
              </p>
            ) : validation && 'error' in validation ? (
              <p role="alert" className="pl-[5.75rem] text-[11.5px] leading-snug text-danger">
                {validation.error}
              </p>
            ) : validation && 'pages' in validation ? (
              <p className="tnum pl-[5.75rem] text-[11.5px] text-ok">
                New document will have {validation.pages.length} page
                {validation.pages.length === 1 ? '' : 's'}.
              </p>
            ) : (
              <p className="pl-[5.75rem] text-[11.5px] leading-snug text-faint">
                Every page must appear at most once; ranges run low to high.
              </p>
            )}
          </div>
        </Panel>
      )}

      {pdf && !infoLoading && pdf.info && (
        <>
          <OutputNameField value={outputName} onChange={setOutputName} error={nameError} />
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              loading={running}
              disabled={!canRun}
              onClick={() => void reorder()}
            >
              <ArrowDownUp size={13} /> Save rearranged PDF…
            </Button>
            {!canRun && !running && (
              <span className="text-[11px] text-faint">
                {nameError ?? 'Enter the full page sequence first.'}
              </span>
            )}
          </div>
        </>
      )}

      {running && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={null} indeterminate label="Rearranging pages" />
          <p className="tnum text-[11.5px] text-faint">Copying pages into the new order…</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <SuccessNote
          message={`Saved ${fileNameOf(result.target)} — ${result.pageCount} page${
            result.pageCount === 1 ? '' : 's'
          } in your chosen order, ${formatBytes(result.bytesWritten)}`}
        />
      )}
    </div>
  )
}

function defaultReorderedName(sourcePath: string): string {
  const base = fileNameOf(sourcePath)
  const dot = base.lastIndexOf('.')
  const stem = dot <= 0 ? base : base.slice(0, dot)
  return `${stem}-reordered.pdf`
}
