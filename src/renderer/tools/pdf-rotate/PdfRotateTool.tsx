import { useCallback, useState } from 'react'
import { RotateCw, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import {
  ErrorNote,
  Panel,
  ProgressBar,
  SectionHeading,
  SuccessNote
} from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { FieldRow, Input, Select } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { OutputNameField } from '../shared/OutputNameField'
import { validateOutputName } from '../shared/output-name'
import { normalizeError, type StashError } from '../../../shared/errors'
import type { PdfInfoResult, PdfRotateResult } from '../../../shared/ipc'
import type { PageSequenceParse } from '../../../shared/utils/page-ranges'
import { parsePageSequence } from '../../../shared/utils/page-ranges'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { CopyPathButton, RevealButton } from '../shared/result-actions'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'

const ANGLES = [90, 180, 270] as const
type Angle = (typeof ANGLES)[number]

function isAngle(value: string): value is `${Angle}` {
  return (ANGLES as readonly number[]).includes(Number(value))
}

export default function PdfRotateTool() {
  const [pdf, setPdf] = useState<SelectedPdf | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [pageSpec, setPageSpec] = useState('')
  const [angle, setAngle] = useState<Angle>(90)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<(PdfRotateResult & { target: string }) | null>(null)
  const [error, setError] = useState<StashError | null>(null)
  const [outputName, setOutputName] = useState('')

  // Empty spec means every page; anything else is validated live.
  const isAll = pageSpec.trim().toLowerCase() === 'all'
  const validation: PageSequenceParse | null =
    pdf?.info && pageSpec.length > 0 && !isAll
      ? parsePageSequence(pageSpec, pdf.info.pageCount)
      : null

  const outputCheck = validateOutputName(outputName, '.pdf')
  const nameError = outputCheck.ok ? null : outputCheck.error

  const canRun =
    pdf !== null && pdf.info !== null && !running && validation === null && outputCheck.ok

  const loadFile = useCallback(async (paths: string[]): Promise<void> => {
    const path = paths[0]
    if (!path) return
    setPdf({ path, info: null })
    setResult(null)
    setError(null)
    setPageSpec('')
    setOutputName(defaultRotatedName(path))
    setInfoLoading(true)
    try {
      const info = await window.stash.pdfs.getInfo(path)
      setPdf((prev) => (prev?.path === path ? { path, info } : prev))
    } catch (err) {
      const normalized = normalizeError(err)
      setPdf(null)
      setError(normalized)
      recordHistoryQuietly({
        toolId: 'pdf-rotate',
        operation: 'rotate-pdf',
        inputs: [fileNameOf(path)],
        outputs: [],
        status: 'failure',
        message: normalized.userMessage
      })
    } finally {
      setInfoLoading(false)
    }
  }, [])

  const rotate = async (): Promise<void> => {
    if (!pdf?.info || running) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const dialog = await window.stash.dialogs.saveFile({
        defaultName: outputName,
        filters: [{ name: 'PDF document', extensions: ['pdf'] }],
        title: 'Save rotated PDF as…'
      })
      if (dialog.cancelled || !dialog.path) return
      const res = await window.stash.pdfs.rotate({
        path: pdf.path,
        pageSpec: pageSpec.trim().length === 0 || isAll ? 'all' : pageSpec,
        angle,
        targetPdf: dialog.path
      })
      setResult({ ...res, target: dialog.path })
      toastSuccess(
        `Rotated ${res.rotatedCount} page${res.rotatedCount === 1 ? '' : 's'}`,
        `${fileNameOf(dialog.path)} · ${formatBytes(res.bytesWritten)}`
      )
      recordHistoryQuietly({
        toolId: 'pdf-rotate',
        operation: 'rotate-pdf',
        inputs: [fileNameOf(pdf.path)],
        outputs: [fileNameOf(dialog.path)],
        status: 'success'
      })
    } catch (err) {
      const normalized = normalizeError(err)
      setError(normalized)
      toastError(err)
      recordHistoryQuietly({
        toolId: 'pdf-rotate',
        operation: 'rotate-pdf',
        inputs: pdf ? [fileNameOf(pdf.path)] : [],
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
      {!pdf ? (
        <DropZone
          accept={['.pdf']}
          label="Drop a PDF here to rotate"
          hint="One document at a time · rotate 90°, 180°, or 270° · click to browse"
          dialogTitle="Choose a PDF document to rotate"
          onFiles={(paths) => void loadFile(paths)}
        />
      ) : (
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
          <SectionHeading>Rotation</SectionHeading>
          <div className="mt-2 flex flex-col gap-2">
            <FieldRow label="Pages" htmlFor="rotate-pages">
              <Input
                id="rotate-pages"
                value={pageSpec}
                placeholder="all or e.g. 1-3, 7"
                invalid={validation !== null && 'error' in validation}
                onChange={(e) => {
                  setPageSpec(e.target.value)
                  setResult(null)
                }}
                spellCheck={false}
              />
            </FieldRow>
            {validation && 'error' in validation ? (
              <p role="alert" className="pl-[5.75rem] text-[11.5px] leading-snug text-danger">
                {validation.error}
              </p>
            ) : validation && 'pages' in validation ? (
              <p className="tnum pl-[5.75rem] text-[11.5px] text-ok">
                {validation.pages.length} page{validation.pages.length === 1 ? '' : 's'} selected
              </p>
            ) : (
              <p className="tnum pl-[5.75rem] text-[11.5px] text-faint">
                Every page will be rotated.
              </p>
            )}
            <FieldRow label="Angle" htmlFor="rotate-angle">
              <Select
                id="rotate-angle"
                className="w-full"
                value={angle}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (isAngle(String(next))) setAngle(next as Angle)
                }}
              >
                {ANGLES.map((option) => (
                  <option key={option} value={option}>
                    {option}° clockwise
                  </option>
                ))}
              </Select>
            </FieldRow>
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
              onClick={() => void rotate()}
            >
              <RotateCw size={13} /> Save rotated PDF…
            </Button>
            {!canRun && !running && (
              <span className="text-[11px] text-faint">
                {nameError ?? 'Fix the highlighted pages first.'}
              </span>
            )}
          </div>
        </>
      )}

      {running && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar ratio={null} indeterminate label="Rotating pages" />
          <p className="tnum text-[11.5px] text-faint">Writing the rotated copy…</p>
        </div>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SuccessNote
              message={`Saved ${fileNameOf(result.target)} — ${result.rotatedCount} page${
                result.rotatedCount === 1 ? '' : 's'
              } turned ${angle}° clockwise, ${formatBytes(result.bytesWritten)}`}
            />
          </div>
          <RevealButton path={result.target} />
          <CopyPathButton path={result.target} />
        </div>
      )}
    </div>
  )
}

interface SelectedPdf {
  path: string
  info: PdfInfoResult | null
}

function defaultRotatedName(sourcePath: string): string {
  const base = fileNameOf(sourcePath)
  const dot = base.lastIndexOf('.')
  const stem = dot <= 0 ? base : base.slice(0, dot)
  return `${stem}-rotated.pdf`
}
