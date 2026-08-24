import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Save, X } from 'lucide-react'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorNote, Panel, SectionHeading, Spinner } from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { FieldRow, Input, Toggle } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { stashError, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { mapPdfJsError, pdfjsLib } from '../shared/pdfjs'
import { assembleText, countWords, joinPages, resolvePages, type PdfTextItemLike } from './logic'

interface OpenedPdf {
  path: string
  name: string
  sizeBytes: number
  pageCount: number
}

interface ExtractProgress {
  current: number
  total: number
}

export default function PdfToTextTool() {
  const [opened, setOpened] = useState<OpenedPdf | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StashError | null>(null)

  const [rangeSpec, setRangeSpec] = useState('all')
  const [preserveBreaks, setPreserveBreaks] = useState(true)

  const [extracting, setExtracting] = useState(false)
  const [progress, setProgress] = useState<ExtractProgress | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [summary, setSummary] = useState<{ pages: number } | null>(null)

  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null)
  const docRef = useRef<PDFDocumentProxy | null>(null)

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
    setText(null)
    setSummary(null)
    setProgress(null)
    setRangeSpec('all')
  }, [releaseDocument])

  const extract = useCallback(
    async (doc: PDFDocumentProxy, pageCount: number): Promise<void> => {
      const selection = resolvePages(rangeSpec, pageCount)
      if ('error' in selection) {
        setError(stashError('VALIDATION', selection.error))
        return
      }
      setExtracting(true)
      setError(null)
      try {
        const pageTexts: string[] = []
        for (const [index, pageNumber] of selection.pages.entries()) {
          setProgress({ current: index + 1, total: selection.pages.length })
          const page = await doc.getPage(pageNumber)
          const content = await page.getTextContent()
          pageTexts.push(
            assembleText(content.items as PdfTextItemLike[], { preserveLineBreaks: preserveBreaks })
          )
        }
        const joined = joinPages(pageTexts, preserveBreaks)
        setText(joined)
        setSummary({ pages: selection.pages.length })
      } catch (err) {
        const normalized = mapPdfJsError(err, opened?.name ?? 'document')
        setError(normalized)
      } finally {
        setProgress(null)
        setExtracting(false)
      }
    },
    [rangeSpec, preserveBreaks, opened?.name]
  )

  const loadFile = useCallback(
    async (paths: string[]): Promise<void> => {
      const path = paths[0]
      if (!path) return
      const name = fileNameOf(path)
      setLoading(true)
      setError(null)
      setOpened(null)
      setText(null)
      setSummary(null)
      releaseDocument()
      try {
        const { bytes, truncated, sizeBytes } = await window.stash.fs.readFileBytes({ path })
        if (truncated) {
          throw stashError('FS_READ', `"${name}" is too large to read (limit is 64 MB).`)
        }
        // pdf.js may transfer and detach the buffer it receives, so hand it
        // a private copy and keep the original intact.
        const data = new Uint8Array(bytes.slice(0))
        const task = pdfjsLib.getDocument({ data })
        loadingTaskRef.current = task
        const doc = await task.promise
        docRef.current = doc
        const pageCount = doc.numPages
        setOpened({ path, name, sizeBytes, pageCount })
        recordHistoryQuietly({
          toolId: 'pdf-to-text',
          operation: 'pdf-to-text',
          inputs: [name],
          outputs: [],
          status: 'success'
        })
        await extract(doc, pageCount)
      } catch (err) {
        loadingTaskRef.current = null
        const normalized = mapPdfJsError(err, name)
        setError(normalized)
        recordHistoryQuietly({
          toolId: 'pdf-to-text',
          operation: 'pdf-to-text',
          inputs: [name],
          outputs: [],
          status: 'failure',
          message: normalized.userMessage
        })
      } finally {
        setLoading(false)
      }
    },
    [releaseDocument, extract]
  )

  const copyText = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toastSuccess('Extracted text copied to clipboard')
    } catch (err) {
      toastError(err)
    }
  }

  const saveAsTxt = async () => {
    if (!text || !opened) return
    try {
      const dialog = await window.stash.dialogs.saveFile({
        defaultName: `${opened.name.replace(/\.pdf$/i, '')}.txt`,
        filters: [{ name: 'Text file', extensions: ['txt'] }],
        title: 'Save extracted text as…'
      })
      if (dialog.cancelled || !dialog.path) return
      await window.stash.fs.writeTextFile({ path: dialog.path, content: text })
      toastSuccess('Text saved', fileNameOf(dialog.path))
      recordHistoryQuietly({
        toolId: 'pdf-to-text',
        operation: 'pdf-to-text',
        inputs: [opened.name],
        outputs: [fileNameOf(dialog.path)],
        status: 'success'
      })
    } catch (err) {
      toastError(err)
    }
  }

  const charCount = text === null ? 0 : text.length

  return (
    <div className="flex flex-col gap-4">
      {!opened && (
        <DropZone
          accept={['.pdf']}
          label="Drop a PDF here"
          hint="One document at a time · click to browse · up to 64 MB"
          dialogTitle="Choose a PDF to extract text from"
          onFiles={(paths) => void loadFile(paths)}
        />
      )}

      {opened && (
        <>
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

          <Panel className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3">
            <FieldRow label="Pages" htmlFor="ptt-range">
              <Input
                id="ptt-range"
                value={rangeSpec}
                onChange={(e) => setRangeSpec(e.target.value)}
                placeholder='all or e.g. "1-3, 7"'
                mono
                className="w-40"
              />
            </FieldRow>
            <FieldRow label="Layout">
              <Toggle
                checked={preserveBreaks}
                onChange={setPreserveBreaks}
                label="Preserve line breaks"
              />
            </FieldRow>
            <Button
              variant="secondary"
              disabled={loading || extracting}
              onClick={() => {
                if (docRef.current) void extract(docRef.current, opened.pageCount)
              }}
              className="ml-auto"
            >
              Re-extract
            </Button>
          </Panel>

          <Panel className="p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <SectionHeading>Extracted text</SectionHeading>
              {summary && text !== null && !extracting && (
                <span role="status" className="font-mono text-[10.5px] text-faint tnum">
                  {summary.pages} page{summary.pages === 1 ? '' : 's'} processed · {charCount} chars
                  · {countWords(text)} words
                </span>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                <IconButton
                  variant="surface"
                  size="sm"
                  aria-label="Copy extracted text"
                  disabled={!text || extracting}
                  onClick={() => void copyText()}
                >
                  <Copy size={13} />
                </IconButton>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!text || extracting}
                  onClick={() => void saveAsTxt()}
                >
                  <Save size={13} /> Save as .txt…
                </Button>
              </div>
            </div>

            {extracting ? (
              <div
                role="status"
                aria-live="polite"
                className="flex h-48 flex-col items-center justify-center gap-2 rounded-md border border-line bg-base"
              >
                <Spinner label="Extracting text" />
                <p className="tnum text-[12px] text-faint">
                  {progress
                    ? `Extracting page ${progress.current}/${progress.total}…`
                    : 'Preparing extraction…'}
                </p>
              </div>
            ) : text === null ? (
              <div className="rounded-md border border-dashed border-line px-4 py-14 text-center">
                <p className="text-[12.5px] text-dim">No text extracted yet.</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
                  Press Re-extract to pull text from the selected pages.
                </p>
              </div>
            ) : text.length === 0 ? (
              <EmptyState
                icon="file-text"
                title="No selectable text found."
                hint="This PDF appears to be scanned images rather than digital text — an OCR tool would be needed for these pages."
              />
            ) : (
              <pre
                aria-label="PDF text content"
                className="h-72 overflow-auto rounded-md border border-line bg-base p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-words text-ink select-text"
              >
                {text}
              </pre>
            )}
          </Panel>
        </>
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
          hint="Drop or browse for a .pdf above — its text layer is read locally with pdf.js and never leaves this machine."
        />
      )}
    </div>
  )
}
