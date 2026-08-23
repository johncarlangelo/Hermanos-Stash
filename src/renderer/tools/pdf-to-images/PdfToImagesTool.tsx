import { useCallback, useEffect, useRef, useState } from 'react'
import { FileImage, X } from 'lucide-react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { Button } from '../../components/ui/Button'
import {
  EmptyState,
  ErrorNote,
  Panel,
  ProgressBar,
  SectionHeading,
  Spinner,
  SuccessNote
} from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { FieldRow, Select } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, stashError, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { mapPdfJsError, pdfjsLib } from '../shared/pdfjs'
import {
  clampQuality,
  DEFAULT_QUALITY,
  parseExportFormat,
  parseScale,
  paddedPageName,
  QUALITY_MAX,
  QUALITY_MIN,
  SCALE_OPTIONS,
  type ExportImageFormat
} from './logic'

interface OpenedPdf {
  path: string
  name: string
  sizeBytes: number
  pageCount: number
}

interface RenderProgress {
  current: number
  total: number
}

export default function PdfToImagesTool() {
  const [opened, setOpened] = useState<OpenedPdf | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StashError | null>(null)

  const [format, setFormat] = useState<ExportImageFormat>('png')
  const [quality, setQuality] = useState(DEFAULT_QUALITY)
  const [scale, setScale] = useState<number>(1)

  const [rendering, setRendering] = useState(false)
  const [progress, setProgress] = useState<RenderProgress | null>(null)
  const [result, setResult] = useState<{ target: string; pages: number } | null>(null)
  const [cancelledNotice, setCancelledNotice] = useState(false)

  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null)
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const shouldCancelRef = useRef(false)

  /** Tear down the current document exactly once per change or unmount. */
  const releaseDocument = useCallback((): void => {
    void loadingTaskRef.current?.destroy()
    loadingTaskRef.current = null
    docRef.current = null
  }, [])

  useEffect(() => releaseDocument, [releaseDocument])

  const closePdf = useCallback((): void => {
    releaseDocument()
    setOpened(null)
    setError(null)
    setResult(null)
    setCancelledNotice(false)
    setProgress(null)
  }, [releaseDocument])

  const loadFile = useCallback(
    async (paths: string[]): Promise<void> => {
      const path = paths[0]
      if (!path) return
      const name = fileNameOf(path)
      setLoading(true)
      setError(null)
      setOpened(null)
      setResult(null)
      setCancelledNotice(false)
      releaseDocument()
      try {
        const { bytes, truncated, sizeBytes } = await window.stash.fs.readFileBytes({ path })
        if (truncated) {
          throw stashError('FS_READ', `"${name}" is too large to export (limit is 64 MB).`)
        }
        // pdf.js may transfer and detach the buffer it receives, so hand it
        // a private copy and keep the original intact.
        const data = new Uint8Array(bytes.slice(0))
        const task = pdfjsLib.getDocument({ data })
        loadingTaskRef.current = task
        const doc = await task.promise
        docRef.current = doc
        setOpened({ path, name, sizeBytes, pageCount: doc.numPages })
      } catch (err) {
        loadingTaskRef.current = null
        const normalized = mapPdfJsError(err, name)
        setError(normalized)
        recordHistoryQuietly({
          toolId: 'pdf-to-images',
          operation: 'pdf-to-images',
          inputs: [name],
          outputs: [],
          status: 'failure',
          message: normalized.userMessage
        })
      } finally {
        setLoading(false)
      }
    },
    [releaseDocument]
  )

  const exportAll = async (): Promise<void> => {
    if (!opened || rendering || !docRef.current) return
    setRendering(true)
    setError(null)
    setResult(null)
    setCancelledNotice(false)
    let opDir: string | null = null
    try {
      // The .zip destination is chosen BEFORE any rendering so the whole
      // output lands in one user-approved archive.
      const dialog = await window.stash.dialogs.saveFile({
        defaultName: `${opened.name.replace(/\.pdf$/i, '')}-images.zip`,
        filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
        title: 'Save exported images archive as…'
      })
      if (dialog.cancelled || !dialog.path) return

      const doc = docRef.current
      const total = opened.pageCount
      const effectiveFormat = format
      const effectiveQuality = clampQuality(quality)
      const effectiveScale = parseScale(scale)
      shouldCancelRef.current = false

      opDir = await window.stash.temp.createOperation('pdf-images')
      const writtenPaths: string[] = []
      const mime = effectiveFormat === 'jpeg' ? 'image/jpeg' : 'image/png'

      for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
        if (shouldCancelRef.current) break
        setProgress({ current: pageNumber, total })

        const page = await doc.getPage(pageNumber)
        const viewport = page.getViewport({ scale: effectiveScale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const context = canvas.getContext('2d')
        if (!context) throw normalizeError(new Error('Canvas 2D context unavailable.'))
        await page.render({ canvas, canvasContext: context, viewport }).promise

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error('Canvas encoding failed.'))),
            mime,
            effectiveFormat === 'jpeg' ? effectiveQuality / 100 : undefined
          )
        })
        canvas.width = 0
        canvas.height = 0

        const bytes = await blob.arrayBuffer()
        const fileName = paddedPageName(pageNumber, effectiveFormat)
        const targetPath = `${opDir}/${fileName}`
        await window.stash.fs.writeFileBytes(targetPath, bytes)
        writtenPaths.push(targetPath)
      }

      if (shouldCancelRef.current) {
        setCancelledNotice(true)
        setProgress(null)
        return
      }

      const zip = await window.stash.archives.createZip({
        paths: writtenPaths,
        targetZip: dialog.path
      })
      setResult({ target: dialog.path, pages: zip.fileCount })
      toastSuccess(
        `Exported ${zip.fileCount} page${zip.fileCount === 1 ? '' : 's'}`,
        `${fileNameOf(dialog.path)} · ${formatBytes(zip.bytesWritten)}`
      )
      recordHistoryQuietly({
        toolId: 'pdf-to-images',
        operation: 'pdf-to-images',
        inputs: [opened.name],
        outputs: [fileNameOf(dialog.path)],
        status: 'success'
      })
    } catch (err) {
      const normalized = mapPdfJsError(err, opened?.name ?? 'document')
      setError(normalized)
      toastError(normalized)
      recordHistoryQuietly({
        toolId: 'pdf-to-images',
        operation: 'pdf-to-images',
        inputs: opened ? [opened.name] : [],
        outputs: [],
        status: 'failure',
        message: normalized.userMessage
      })
    } finally {
      if (opDir) {
        try {
          await window.stash.temp.cleanup(opDir)
        } catch {
          // Temp cleanup is best-effort; never mask the primary outcome.
        }
      }
      setProgress(null)
      setRendering(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!opened && (
        <DropZone
          accept={['.pdf']}
          label="Drop a PDF here"
          hint="One document at a time · click to browse · up to 64 MB"
          dialogTitle="Choose a PDF to export as images"
          onFiles={(paths) => void loadFile(paths)}
        />
      )}

      {opened && (
        <Panel className="p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeading>Document</SectionHeading>
            <div className="flex items-center gap-2">
              <span className="tnum text-[11px] text-faint">
                {opened.pageCount} page{opened.pageCount === 1 ? '' : 's'} ·{' '}
                {formatBytes(opened.sizeBytes)}
              </span>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={`Close ${opened.name}`}
                title="Close document"
                onClick={closePdf}
              >
                <X size={13} />
              </IconButton>
            </div>
          </div>
          <p className="mt-1 truncate font-mono text-[12px] text-dim" title={opened.path}>
            {opened.name}
          </p>
        </Panel>
      )}

      {opened && (
        <Panel className="p-3.5">
          <SectionHeading>Image options</SectionHeading>
          <div className="mt-2 flex flex-col gap-2">
            <FieldRow label="Format" htmlFor="pti-format">
              <Select
                id="pti-format"
                className="w-full"
                value={format}
                onChange={(e) => setFormat(parseExportFormat(e.target.value))}
              >
                <option value="png">PNG — lossless</option>
                <option value="jpeg">JPEG — smaller files</option>
              </Select>
            </FieldRow>
            {format === 'jpeg' && (
              <FieldRow label="Quality" htmlFor="pti-quality">
                <input
                  id="pti-quality"
                  type="range"
                  min={QUALITY_MIN}
                  max={QUALITY_MAX}
                  value={quality}
                  onChange={(e) => setQuality(clampQuality(Number(e.target.value)))}
                  className="h-8.5 w-full accent-accent"
                  aria-valuetext={`${quality} percent`}
                />
                <span className="tnum w-10 shrink-0 text-right text-[12px] text-dim">
                  {quality}%
                </span>
              </FieldRow>
            )}
            <FieldRow label="Scale" htmlFor="pti-scale">
              <Select
                id="pti-scale"
                className="w-full"
                value={scale}
                onChange={(e) => setScale(parseScale(e.target.value))}
              >
                {SCALE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}× page size
                  </option>
                ))}
              </Select>
            </FieldRow>
          </div>
          <p className="mt-2 border-t border-line pt-2.5 text-[11.5px] leading-relaxed text-faint">
            Every page is rendered locally and packed into a single ZIP archive — you'll pick the
            .zip destination when you press Export.
          </p>
        </Panel>
      )}

      {opened && (
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            loading={rendering}
            disabled={loading}
            onClick={() => void exportAll()}
          >
            <FileImage size={13} /> Export all pages…
          </Button>
          {rendering && (
            <IconButton
              variant="surface"
              size="sm"
              aria-label="Cancel export"
              title="Cancel"
              onClick={() => {
                shouldCancelRef.current = true
              }}
            >
              <X size={13} />
            </IconButton>
          )}
        </div>
      )}

      {rendering && progress && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1.5">
          <ProgressBar
            ratio={progress.total > 0 ? (progress.current - 1) / progress.total : null}
            label="Rendering pages"
          />
          <p className="tnum text-[11.5px] text-faint">
            Rendering page {progress.current} of {progress.total}…
          </p>
        </div>
      )}

      {loading && (
        <p role="status" className="flex items-center gap-2 text-[12px] text-faint">
          <Spinner label="Parsing PDF document" /> Parsing document…
        </p>
      )}

      {cancelledNotice && (
        <Panel className="border-line px-3 py-2.5">
          <p className="text-[12.5px] leading-snug text-dim">Export cancelled — nothing saved.</p>
        </Panel>
      )}

      {error && <ErrorNote error={error} />}

      {result && (
        <SuccessNote
          message={`Packed ${result.pages} page${result.pages === 1 ? '' : 's'} into ${fileNameOf(result.target)}`}
        />
      )}

      {!opened && !loading && !error && (
        <EmptyState
          icon="image"
          title="Nothing selected yet."
          hint="Drop or browse for a .pdf above — each page becomes a numbered image at your chosen format and scale, delivered as one tidy ZIP."
        />
      )}
    </div>
  )
}
