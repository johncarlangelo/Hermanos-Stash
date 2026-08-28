import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, FileText, Save, ScanText, Sliders, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ErrorNote, Panel, SectionHeading, Spinner } from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { FieldRow, Select, Toggle } from '../../components/ui/Inputs'
import { DropZone } from '../../components/ui/DropZone'
import { stashError, type StashError } from '../../../shared/errors'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import type { OcrPsmMode } from '../../../shared/ipc'
import { cleanOcrText, computeTextStats, formatConfidence, PSM_OPTIONS } from './logic'

interface SelectedImage {
  path: string
  name: string
  sizeBytes: number
  previewUrl: string
}

interface OcrProgress {
  ratio: number | null
  message: string
}

const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif']

export default function ImageOcrTool() {
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StashError | null>(null)

  // Options
  const [psm, setPsm] = useState<OcrPsmMode>('auto')
  const [grayscale, setGrayscale] = useState(true)
  const [contrastEnhance, setContrastEnhance] = useState(true)
  const [threshold, setThreshold] = useState(false)

  // Extraction State
  const [extracting, setExtracting] = useState(false)
  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [extractedText, setExtractedText] = useState<string | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  // Text formatting options
  const [trimLines, setTrimLines] = useState(true)
  const [normalizeSpaces, setNormalizeSpaces] = useState(false)

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (selectedImage?.previewUrl) {
        URL.revokeObjectURL(selectedImage.previewUrl)
      }
    }
  }, [selectedImage])

  const clearSelection = useCallback(() => {
    if (selectedImage?.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl)
    }
    setSelectedImage(null)
    setExtractedText(null)
    setConfidence(null)
    setError(null)
    setProgress(null)
    setCopied(false)
  }, [selectedImage])

  const loadFile = useCallback(async (paths: string[]) => {
    const path = paths[0]
    if (!path) return

    const ext = '.' + (path.split('.').pop()?.toLowerCase() ?? '')
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      setError(
        stashError(
          'VALIDATION',
          `Please select an image file (${SUPPORTED_EXTENSIONS.join(', ')}).`
        )
      )
      return
    }

    setLoading(true)
    setError(null)
    setExtractedText(null)
    setConfidence(null)

    try {
      const [stat, bytesResult] = await Promise.all([
        window.stash.fs.stat(path),
        window.stash.fs.readFileBytes({ path, maxBytes: 32 * 1024 * 1024 })
      ])

      const blob = new Blob([bytesResult.bytes])
      const previewUrl = URL.createObjectURL(blob)

      setSelectedImage({
        path,
        name: fileNameOf(path),
        sizeBytes: stat.sizeBytes,
        previewUrl
      })
    } catch (err) {
      setError(
        stashError(
          'FS_READ',
          `Could not load image: ${err instanceof Error ? err.message : String(err)}`
        )
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const handleExtract = async () => {
    if (!selectedImage) return

    setExtracting(true)
    setError(null)
    setProgress({ ratio: 0.05, message: 'Initializing OCR engine…' })

    const unsubscribe = window.stash.progress.subscribe((event) => {
      if (event.status === 'active') {
        setProgress({
          ratio: event.ratio,
          message: event.message ?? 'Processing image…'
        })
      }
    })

    const start = Date.now()
    try {
      const result = await window.stash.processing.ocrImage({
        path: selectedImage.path,
        language: 'eng',
        psm,
        preprocess: {
          grayscale,
          contrastEnhance,
          threshold
        }
      })

      setExtractedText(result.text)
      setConfidence(result.confidence)

      const durationMs = Date.now() - start
      recordHistoryQuietly({
        toolId: 'image-ocr',
        operation: 'Extract Text',
        inputs: [selectedImage.name],
        outputs: [],
        durationMs,
        status: 'success'
      })

      toastSuccess('Text extracted successfully')
    } catch (err) {
      setError(
        stashError(
          'UNKNOWN',
          `OCR extraction failed: ${err instanceof Error ? err.message : String(err)}`
        )
      )
      recordHistoryQuietly({
        toolId: 'image-ocr',
        operation: 'Extract Text',
        inputs: [selectedImage.name],
        outputs: [],
        durationMs: Date.now() - start,
        status: 'failure'
      })
    } finally {
      unsubscribe()
      setExtracting(false)
      setProgress(null)
    }
  }

  const handleCopy = async () => {
    const textToCopy = cleanOcrText(extractedText ?? '', { trimLines, normalizeSpaces })
    if (!textToCopy) return

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      toastSuccess('Copied text to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toastError('Failed to copy to clipboard')
    }
  }

  const handleSaveText = async () => {
    const textToSave = cleanOcrText(extractedText ?? '', { trimLines, normalizeSpaces })
    if (!textToSave || !selectedImage) return

    try {
      const defaultName = selectedImage.name.replace(/\.[^/.]+$/, '') + '-ocr.txt'
      const dialogRes = await window.stash.dialogs.saveFile({
        title: 'Save Extracted Text',
        defaultName,
        filters: [{ name: 'Text Document', extensions: ['txt'] }]
      })

      if (dialogRes.cancelled || !dialogRes.path) return

      await window.stash.fs.writeTextFile({
        path: dialogRes.path,
        content: textToSave
      })

      toastSuccess(`Saved as ${fileNameOf(dialogRes.path)}`)
    } catch (err) {
      toastError(err)
    }
  }

  const displayedText = cleanOcrText(extractedText ?? '', { trimLines, normalizeSpaces })
  const stats = computeTextStats(displayedText)
  const confidenceRating = confidence !== null ? formatConfidence(confidence) : null

  return (
    <div className="relative mx-auto w-full max-w-5xl space-y-6 px-8 py-8">
      <div>
        <h1 className="text-[19px] font-semibold tracking-tight text-ink flex items-center gap-2">
          <ScanText size={20} className="text-accent" />
          Image OCR Extractor
        </h1>
        <p className="mt-0.5 text-[12.5px] text-dim">
          Extract editable text from images, photos, scans, and screenshots locally using offline
          Tesseract OCR.
        </p>
      </div>

      {error && <ErrorNote error={error} />}

      {!selectedImage ? (
        <DropZone
          onFiles={(paths: string[]) => void loadFile(paths)}
          accept={SUPPORTED_EXTENSIONS}
          hint="PNG, JPG, WebP, BMP, or TIFF image"
          multiple={false}
          className="h-64"
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Image Card & OCR Controls */}
          <div className="space-y-4 lg:col-span-5">
            <Panel className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-surface">
                    <img
                      src={selectedImage.previewUrl}
                      alt="Thumbnail preview"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="truncate text-[13px] font-medium text-ink"
                      title={selectedImage.name}
                    >
                      {selectedImage.name}
                    </p>
                    <p className="text-[11.5px] text-faint">
                      {formatBytes(selectedImage.sizeBytes)}
                    </p>
                  </div>
                </div>
                <IconButton
                  aria-label="Remove image"
                  onClick={clearSelection}
                  disabled={extracting}
                >
                  <X size={14} />
                </IconButton>
              </div>

              <div className="border-t border-line/60 pt-3">
                <SectionHeading>
                  <span className="flex items-center gap-1.5">
                    <Sliders size={13} className="text-accent" />
                    Recognition Options
                  </span>
                </SectionHeading>

                <div className="space-y-3 mt-2.5">
                  <FieldRow label="Layout / Segmentation" htmlFor="ocr-psm">
                    <Select
                      id="ocr-psm"
                      value={psm}
                      onChange={(e) => setPsm(e.target.value as OcrPsmMode)}
                      disabled={extracting}
                    >
                      {PSM_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </FieldRow>
                  <p className="text-[11px] leading-relaxed text-faint">
                    {PSM_OPTIONS.find((o) => o.id === psm)?.description}
                  </p>

                  <div className="space-y-2 border-t border-line/50 pt-2.5">
                    <p className="text-[11.5px] font-medium text-dim">Preprocessing Enhancements</p>
                    <label className="flex items-center justify-between gap-3 text-[12px] text-dim cursor-pointer">
                      <span>Grayscale & Normalize</span>
                      <Toggle
                        label="Grayscale & Normalize"
                        checked={grayscale}
                        onChange={setGrayscale}
                        disabled={extracting}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-[12px] text-dim cursor-pointer">
                      <span>Contrast Enhancement</span>
                      <Toggle
                        label="Contrast Enhancement"
                        checked={contrastEnhance}
                        onChange={setContrastEnhance}
                        disabled={extracting}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-[12px] text-dim cursor-pointer">
                      <span>Binarize / Noise Filter</span>
                      <Toggle
                        label="Binarize Noise Filter (Receipts/Scans)"
                        checked={threshold}
                        onChange={setThreshold}
                        disabled={extracting}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void handleExtract()}
                  disabled={extracting || loading}
                  className="w-full justify-center"
                >
                  {extracting ? (
                    <>
                      <Spinner />
                      <span>{progress?.message ?? 'Extracting…'}</span>
                    </>
                  ) : (
                    <>
                      <ScanText size={15} />
                      <span>{extractedText ? 'Re-extract Text' : 'Extract Text'}</span>
                    </>
                  )}
                </Button>
              </div>
            </Panel>
          </div>

          {/* Right Column: Output & Text Results */}
          <div className="lg:col-span-7">
            {extractedText !== null ? (
              <Panel className="flex flex-col space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div className="flex items-center gap-3">
                    {confidenceRating && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium ${
                          confidenceRating.label === 'High'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : confidenceRating.label === 'Good'
                              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                              : confidenceRating.label === 'Moderate'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        Confidence: {confidenceRating.percentString} ({confidenceRating.label})
                      </span>
                    )}
                    <span className="text-[11.5px] text-faint">
                      {stats.words} words · {stats.characters} chars · {stats.lines} lines
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleCopy()}
                      disabled={!displayedText}
                    >
                      {copied ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleSaveText()}
                      disabled={!displayedText}
                    >
                      <Save size={13} />
                      Save .txt
                    </Button>
                  </div>
                </div>

                {/* Text View Area */}
                <div className="relative min-h-[300px] w-full">
                  <textarea
                    readOnly
                    value={displayedText}
                    placeholder="No text recognized."
                    className="h-[360px] w-full resize-y rounded-md border border-line bg-surface/70 p-3.5 font-mono text-[12.5px] leading-relaxed text-ink outline-none selection:bg-accent/20 focus:border-line-strong"
                  />
                </div>

                {/* Formatting Toggles */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-2 text-[11.5px] text-faint">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-dim">
                      <input
                        type="checkbox"
                        checked={trimLines}
                        onChange={(e) => setTrimLines(e.target.checked)}
                        className="rounded border-line bg-surface"
                      />
                      <span>Trim trailing spaces</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-dim">
                      <input
                        type="checkbox"
                        checked={normalizeSpaces}
                        onChange={(e) => setNormalizeSpaces(e.target.checked)}
                        className="rounded border-line bg-surface"
                      />
                      <span>Normalize extra spaces</span>
                    </label>
                  </div>
                </div>
              </Panel>
            ) : extracting ? (
              <Panel className="flex h-[380px] flex-col items-center justify-center p-8 text-center">
                <Spinner />
                <p className="mt-3 text-[13.5px] font-medium text-ink">
                  {progress?.message ?? 'Recognizing text…'}
                </p>
                {progress?.ratio !== null && progress?.ratio !== undefined && (
                  <div className="mt-3 w-48 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-1.5 bg-accent transition-all duration-200"
                      style={{ width: `${Math.round((progress.ratio ?? 0) * 100)}%` }}
                    />
                  </div>
                )}
                <p className="mt-2 text-[11.5px] text-faint">Running local OCR on this machine.</p>
              </Panel>
            ) : (
              <Panel className="flex h-[380px] flex-col items-center justify-center p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-faint">
                  <FileText size={22} />
                </div>
                <p className="mt-3 text-[13.5px] font-medium text-ink">Ready to Extract</p>
                <p className="mt-1 max-w-sm text-[12px] text-faint">
                  Click the <strong>Extract Text</strong> button on the left to run offline OCR
                  recognition.
                </p>
              </Panel>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
