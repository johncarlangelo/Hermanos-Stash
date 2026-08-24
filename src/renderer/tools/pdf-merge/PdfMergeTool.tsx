import { useState } from 'react'
import { ArrowDown, ArrowUp, FileText, X } from 'lucide-react'
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
import { OutputNameField } from '../shared/OutputNameField'
import { validateOutputName } from '../shared/output-name'
import { normalizeError, type StashError } from '../../../shared/errors'
import type { PdfMergeResult } from '../../../shared/ipc'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { CopyPathButton, RevealButton } from '../shared/result-actions'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'

/**
 * Ordered merge queue. Unlike the batch tools this is a sequence, so each
 * row carries explicit up/down ordering controls (keyboard-reachable).
 */
export default function PdfMergeTool() {
  const [paths, setPaths] = useState<string[]>([])
  const [merging, setMerging] = useState(false)
  const [result, setResult] = useState<(PdfMergeResult & { target: string }) | null>(null)
  const [error, setError] = useState<StashError | null>(null)
  const [outputName, setOutputName] = useState('merged.pdf')

  const outputCheck = validateOutputName(outputName, '.pdf')
  const nameError = outputCheck.ok ? null : outputCheck.error

  const canRun = paths.length > 1 && !merging && outputCheck.ok

  const addPaths = (incoming: string[]): void => {
    setPaths((prev) => [...prev, ...incoming.filter((p) => !prev.includes(p))])
    setResult(null)
    setError(null)
  }

  const removePath = (target: string): void => {
    setPaths((prev) => prev.filter((p) => p !== target))
  }

  const move = (index: number, delta: -1 | 1): void => {
    setPaths((prev) => {
      const next = [...prev]
      const other = index + delta
      if (other < 0 || other >= next.length) return prev
      const current = next[index]
      next[index] = next[other]
      next[other] = current
      return next
    })
  }

  const clearAll = (): void => setPaths([])

  const merge = async (): Promise<void> => {
    setMerging(true)
    setError(null)
    setResult(null)
    try {
      const dialog = await window.stash.dialogs.saveFile({
        defaultName: outputName,
        filters: [{ name: 'PDF document', extensions: ['pdf'] }],
        title: 'Save merged PDF as…'
      })
      if (dialog.cancelled || !dialog.path) return
      const res = await window.stash.pdfs.merge({
        paths,
        targetPdf: dialog.path
      })
      setResult({ ...res, target: dialog.path })
      toastSuccess(
        `Merged ${paths.length} document${paths.length === 1 ? '' : 's'}`,
        `${res.pageCount} pages · ${fileNameOf(dialog.path)} · ${formatBytes(res.bytesWritten)}`
      )
      recordHistoryQuietly({
        toolId: 'pdf-merge',
        operation: 'merge-pdfs',
        inputs: paths.map((p) => fileNameOf(p)),
        outputs: [fileNameOf(dialog.path)],
        status: 'success'
      })
    } catch (err) {
      const normalized = normalizeError(err)
      setError(normalized)
      recordHistoryQuietly({
        toolId: 'pdf-merge',
        operation: 'merge-pdfs',
        inputs: paths.map((p) => fileNameOf(p)),
        outputs: [],
        status: 'failure',
        message: normalized.userMessage
      })
      toastError(err)
    } finally {
      setMerging(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DropZone
        multiple
        accept={['.pdf']}
        label="Drop PDFs here"
        hint="Order matters · drag or browse to add · merged top to bottom"
        dialogTitle="Choose PDF documents to merge"
        onFiles={addPaths}
      />

      {paths.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="Nothing queued yet."
          hint="Drop two or more PDFs above and combine them into one document. Pages are copied in the order shown below — reorder any entry before merging."
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <SectionHeading>Merge order · {paths.length}</SectionHeading>
            <Button size="sm" variant="ghost" onClick={clearAll}>
              Clear all
            </Button>
          </div>
          <ul className="flex flex-col gap-1.5">
            {paths.map((itemPath, index) => (
              <li key={itemPath}>
                <Panel className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="tnum w-6 shrink-0 text-right text-[12px] text-faint">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={itemPath}>
                      {fileNameOf(itemPath)}
                    </span>
                    <IconButton
                      size="sm"
                      aria-label="Move up"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp size={13} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      aria-label="Move down"
                      title="Move down"
                      disabled={index === paths.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown size={13} />
                    </IconButton>
                    <button
                      type="button"
                      aria-label={`Remove ${fileNameOf(itemPath)} from the list`}
                      onClick={() => removePath(itemPath)}
                      className="shrink-0 cursor-pointer rounded-sm p-1 text-faint transition-colors duration-150 ease-out hover:bg-surface hover:text-danger"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        </>
      )}

      <Panel className="p-3.5">
        <SectionHeading>Merged document</SectionHeading>
        <p className="mt-1.5 flex items-center gap-2 text-[12px] leading-relaxed text-dim">
          <FileText size={14} className="shrink-0 text-faint" aria-hidden /> You'll pick the save
          location when you press Merge.
        </p>
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <OutputNameField value={outputName} onChange={setOutputName} error={nameError} />
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              loading={merging}
              disabled={!canRun}
              onClick={() => void merge()}
            >
              <FileText size={13} /> Merge PDFs…
            </Button>
            {!canRun && !merging && (
              <span className="text-[11px] text-faint">
                {nameError ??
                  (paths.length === 0
                    ? 'Add at least two PDFs first.'
                    : `Add another PDF to merge (${paths.length} queued).`)}
              </span>
            )}
          </div>
        </div>
      </Panel>

      {merging && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={null} indeterminate label="Merging PDFs" />
          <p className="tnum text-[11.5px] text-faint">Copying pages from {paths.length} files…</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SuccessNote
              message={`Created ${fileNameOf(result.target)} — ${result.pageCount} page${
                result.pageCount === 1 ? '' : 's'
              }, ${formatBytes(result.bytesWritten)}`}
            />
          </div>
          <RevealButton path={result.target} />
          <CopyPathButton path={result.target} />
        </div>
      )}
    </div>
  )
}
