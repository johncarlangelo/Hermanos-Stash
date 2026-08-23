import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorNote, Panel, SectionHeading, Spinner } from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, stashError, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import { recordHistoryQuietly } from '../shared/use-progress-event'

// The worker ships as its own module; Vite resolves the URL at build time.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

type ZoomMode = 'fit' | 100

interface OpenedPdf {
  path: string
  name: string
  sizeBytes: number
  pageCount: number
  doc: PDFDocumentProxy
}

/**
 * Renderer-only PDF rendering via pdf.js. Bytes cross the bridge once;
 * everything after that stays off the main process (ARCHITECTURE.md →
 * Performance).
 */
export default function PdfPreviewTool() {
  const [opened, setOpened] = useState<OpenedPdf | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StashError | null>(null)
  const [pageNum, setPageNum] = useState(1)
  const [zoom, setZoom] = useState<ZoomMode>('fit')
  const [rendering, setRendering] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null)
  const renderTaskRef = useRef<{ cancel(): void; promise: Promise<unknown> } | null>(null)

  /** Tear down the current document's parser task exactly once per change. */
  const releaseDocument = useCallback((): void => {
    renderTaskRef.current?.cancel()
    renderTaskRef.current = null
    void loadingTaskRef.current?.destroy()
    loadingTaskRef.current = null
  }, [])

  // Destroy any still-open document when the tool unmounts.
  useEffect(() => releaseDocument, [releaseDocument])

  const openFile = useCallback(
    async (paths: string[]): Promise<void> => {
      const path = paths[0]
      if (!path) return
      const name = path.split(/[\\/]/).pop() ?? path
      setLoading(true)
      setError(null)
      setOpened(null)
      releaseDocument()
      try {
        const { bytes, truncated, sizeBytes } = await window.stash.fs.readFileBytes({ path })
        if (truncated) {
          throw stashError('FS_READ', `"${name}" is too large to preview (limit is 64 MB).`)
        }
        // pdf.js may transfer and detach the buffer it receives, so hand it
        // a private copy and keep the original intact.
        const data = new Uint8Array(bytes.slice(0))
        const loadingTask = pdfjsLib.getDocument({ data })
        loadingTaskRef.current = loadingTask
        const doc = await loadingTask.promise
        setOpened({ path, name, sizeBytes, pageCount: doc.numPages, doc })
        setPageNum(1)
        setZoom('fit')
        recordHistoryQuietly({
          toolId: 'pdf-preview',
          operation: 'preview',
          inputs: [name],
          outputs: [],
          status: 'success'
        })
      } catch (err) {
        loadingTaskRef.current = null
        const raw = err as Error
        const isPassword =
          raw?.name === 'PasswordException' || /password/i.test(String(raw?.message ?? ''))
        const normalized = isPassword
          ? stashError(
              'UNSUPPORTED',
              `"${name}" is password-protected. Enter the password in its owning app to unlock it first.`,
              { technicalMessage: String(raw?.message ?? err) }
            )
          : normalizeError(err)
        setError(normalized)
        recordHistoryQuietly({
          toolId: 'pdf-preview',
          operation: 'preview',
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

  // Render the active page onto the canvas. Cancelled whenever the page,
  // zoom, or document changes so stale paints can't win the race.
  useEffect(() => {
    if (!opened) return
    let cancelled = false
    const render = async (): Promise<void> => {
      try {
        const page = await opened.doc.getPage(pageNum)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const panelWidth = panelRef.current?.clientWidth ?? 640
        const scale = zoom === 'fit' ? (panelWidth - 24) / base.width : 1
        const viewport = page.getViewport({ scale: Math.min(Math.max(scale, 0.05), 4) })
        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d')
        if (!context) return
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        const task = page.render({ canvas, canvasContext: context, viewport })
        renderTaskRef.current = task
        await task.promise
      } catch (err) {
        // Cancellation throws intentionally; anything else is real damage.
        if ((err as Error)?.name !== 'RenderingCancelledException' && !cancelled) {
          setError(
            stashError('UNKNOWN', 'This page could not be rendered.', {
              technicalMessage: String((err as Error)?.message ?? err)
            })
          )
        }
      } finally {
        if (!cancelled) renderTaskRef.current = null
      }
    }
    setRendering(true)
    void render().finally(() => {
      if (!cancelled) setRendering(false)
    })
    return () => {
      cancelled = true
      renderTaskRef.current?.cancel()
      renderTaskRef.current = null
    }
  }, [opened, pageNum, zoom])

  const closeDocument = useCallback((): void => {
    releaseDocument()
    setOpened(null)
    setError(null)
  }, [releaseDocument])

  const stepPage = useCallback(
    (delta: -1 | 1): void => {
      setPageNum((current) => Math.min(Math.max(current + delta, 1), opened?.pageCount ?? 1))
    },
    [opened?.pageCount]
  )

  return (
    <div
      tabIndex={0}
      aria-label="PDF preview"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          stepPage(-1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          stepPage(1)
        }
      }}
      className="flex flex-col gap-4 outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
    >
      {!opened && (
        <DropZone
          accept={['.pdf']}
          label="Drop a PDF here"
          hint="One document at a time · click to browse · up to 64 MB"
          dialogTitle="Choose a PDF to preview"
          onFiles={(paths) => void openFile(paths)}
        />
      )}

      {opened && (
        <Panel className="p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SectionHeading>Preview</SectionHeading>
            <div className="flex items-center gap-1.5">
              <span aria-live="polite" className="tnum mr-1 text-[11px] text-faint">
                {pageNum} / {opened.pageCount}
              </span>
              <IconButton
                variant="surface"
                size="sm"
                aria-label="Previous page"
                title="Previous page"
                disabled={pageNum <= 1}
                onClick={() => stepPage(-1)}
              >
                <ChevronLeft size={13} />
              </IconButton>
              <IconButton
                variant="surface"
                size="sm"
                aria-label="Next page"
                title="Next page"
                disabled={pageNum >= opened.pageCount}
                onClick={() => stepPage(1)}
              >
                <ChevronRight size={13} />
              </IconButton>
              <Button
                size="sm"
                variant={zoom === 'fit' ? 'primary' : 'secondary'}
                aria-pressed={zoom === 'fit'}
                onClick={() => setZoom('fit')}
              >
                Fit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                title="Show at actual size"
                onClick={() => setZoom(100)}
              >
                100%
              </Button>
              <IconButton
                variant="surface"
                size="sm"
                aria-label={`Close ${opened.name}`}
                title="Close document"
                onClick={closeDocument}
              >
                <X size={13} />
              </IconButton>
            </div>
          </div>

          <div
            ref={panelRef}
            className="flex min-h-40 items-center justify-center overflow-auto rounded-md border border-line bg-base p-3"
          >
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Page ${pageNum} of ${opened.name}`}
              className={
                rendering
                  ? 'opacity-60 transition-opacity duration-150'
                  : 'transition-opacity duration-150'
              }
            />
          </div>

          <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 border-t border-line pt-3">
            <MetadataRow
              label="Name"
              value={
                <span className="truncate" title={opened.path}>
                  {opened.name}
                </span>
              }
            />
            <MetadataRow label="Pages" value={<span className="tnum">{opened.pageCount}</span>} />
            <MetadataRow
              label="Size"
              value={<span className="tnum">{formatBytes(opened.sizeBytes)}</span>}
            />
            <MetadataRow label="Type" value="application/pdf" />
          </dl>
        </Panel>
      )}

      {loading && (
        <p role="status" className="flex items-center gap-2 text-[12px] text-faint">
          <Spinner label="Parsing PDF document" /> Parsing document…
        </p>
      )}

      {!loading && error && <ErrorNote error={error} />}

      {!opened && !loading && !error && (
        <EmptyState
          icon="file-text"
          title="Nothing open yet."
          hint="Drop or browse for a .pdf above to read it right here — pages are rendered locally with pdf.js, and nothing leaves this machine."
        />
      )}
    </div>
  )
}

function MetadataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="w-20 shrink-0 text-right text-[12px] text-faint">{label}</dt>
      <dd className="min-w-0 text-[12.5px] leading-snug text-ink">{value}</dd>
    </>
  )
}
