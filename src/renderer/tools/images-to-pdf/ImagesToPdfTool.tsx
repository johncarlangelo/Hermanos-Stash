import { useState } from 'react'
import { ArrowDown, ArrowUp, FileText, Image as ImageIcon, X } from 'lucide-react'
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
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'

/**
 * Ordered image queue — one page per image, so each row carries explicit
 * up/down ordering controls (same interaction model as PDF Merger).
 */
export default function ImagesToPdfTool() {
  const [paths, setPaths] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<(PdfMergeResult & { target: string }) | null>(null)
  const [error, setError] = useState<StashError | null>(null)
  const [outputName, setOutputName] = useState('images.pdf')

  const outputCheck = validateOutputName(outputName, '.pdf')
  const nameError = outputCheck.ok ? null : outputCheck.error

  const canRun = paths.length > 0 && !running && outputCheck.ok

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
      const current = next[index]!
      next[index] = next[other]!
      next[other] = current
      return next
    })
  }

  const clearAll = (): void => setPaths([])

  const build = async (): Promise<void> => {
    if (!canRun) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const dialog = await window.stash.dialogs.saveFile({
        defaultName: outputName,
        filters: [{ name: 'PDF document', extensions: ['pdf'] }],
        title: 'Save images as PDF…'
      })
      if (dialog.cancelled || !dialog.path) return
      const res = await window.stash.pdfs.imagesToPdf({ paths, targetPdf: dialog.path })
      setResult({ ...res, target: dialog.path })
      toastSuccess(
        `Built ${res.pageCount}-page PDF`,
        `${fileNameOf(dialog.path)} · ${formatBytes(res.bytesWritten)}`
      )
      recordHistoryQuietly({
        toolId: 'images-to-pdf',
        operation: 'images-to-pdf',
        inputs: paths.map((p) => fileNameOf(p)),
        outputs: [fileNameOf(dialog.path)],
        status: 'success'
      })
    } catch (err) {
      const normalized = normalizeError(err)
      setError(normalized)
      toastError(err)
      recordHistoryQuietly({
        toolId: 'images-to-pdf',
        operation: 'images-to-pdf',
        inputs: paths.map((p) => fileNameOf(p)),
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
        multiple
        accept={['.jpg', '.jpeg', '.png']}
        label="Drop JPG or PNG images here"
        hint="One page per image · drag or browse to add · pages follow the order below"
        dialogTitle="Choose images to combine into a PDF"
        onFiles={addPaths}
      />

      {paths.length === 0 ? (
        <EmptyState
          icon="image"
          title="Nothing queued yet."
          hint="Drop one or more images above and they become the pages of a single PDF. Each page matches its image's pixel size at full bleed — reorder entries before building."
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <SectionHeading>
              Page order · {paths.length} image{paths.length === 1 ? '' : 's'}
            </SectionHeading>
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
                    <ImageIcon size={13} className="shrink-0 text-faint" aria-hidden />
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
          <p className="text-[11.5px] leading-relaxed text-faint">
            One page per image · each page takes the image's natural pixel size.
          </p>
        </>
      )}

      <Panel className="p-3.5">
        <SectionHeading>Output document</SectionHeading>
        <p className="mt-1.5 flex items-center gap-2 text-[12px] leading-relaxed text-dim">
          <FileText size={14} className="shrink-0 text-faint" aria-hidden /> You'll pick the save
          location when you press Build.
        </p>
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          <OutputNameField value={outputName} onChange={setOutputName} error={nameError} />
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              loading={running}
              disabled={!canRun}
              onClick={() => void build()}
            >
              <FileText size={13} /> Build PDF…
            </Button>
            {!canRun && !running && (
              <span className="text-[11px] text-faint">
                {nameError ?? 'Add at least one image first.'}
              </span>
            )}
          </div>
        </div>
      </Panel>

      {running && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={null} indeterminate label="Building PDF" />
          <p className="tnum text-[11.5px] text-faint">Embedding {paths.length} images…</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <SuccessNote
          message={`Created ${fileNameOf(result.target)} — ${result.pageCount} page${
            result.pageCount === 1 ? '' : 's'
          }, ${formatBytes(result.bytesWritten)}`}
        />
      )}
    </div>
  )
}
