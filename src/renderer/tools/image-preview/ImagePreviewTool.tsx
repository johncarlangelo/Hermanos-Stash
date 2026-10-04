import { useCallback, useEffect, useRef, useState } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorNote, Panel, SectionHeading, Spinner } from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, stashError, type StashError } from '../../../shared/errors'
import { formatBytes, guessMimeType } from '../../../shared/utils/files'
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ZOOM_MAX_PERCENT,
  ZOOM_MIN_PERCENT
} from './logic'
import { useImageZoomPan } from '../shared/use-image-zoom-pan'

interface LoadedImage {
  path: string
  name: string
  objectUrl: string
  sizeBytes: number
  mimeType: string
}

export default function ImagePreviewTool() {
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StashError | null>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  const imgRef = useRef<HTMLImageElement>(null)

  const {
    isZoomed,
    zoomPercent,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom: setLensZoom,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    transformStyle,
    cursorClass
  } = useImageZoomPan({
    minZoom: 0.1,
    maxZoom: 8.0,
    initialZoom: 1.0,
    stepFactor: 1.25
  })

  // Object URLs must be released whenever they are replaced or on unmount;
  // keying the effect on the URL guarantees exactly-once revocation.
  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.objectUrl)
    }
  }, [image])

  const closeImage = useCallback(() => {
    setImage(null)
    setError(null)
    setDimensions(null)
    resetZoom()
  }, [resetZoom])

  const handleShowActualSize = useCallback(() => {
    if (!dimensions || !imgRef.current) {
      setLensZoom(1.0)
      return
    }
    const clientWidth = imgRef.current.clientWidth
    if (clientWidth > 0) {
      const actualScale = dimensions.width / clientWidth
      setLensZoom(Number(actualScale.toFixed(2)))
    } else {
      setLensZoom(1.0)
    }
  }, [dimensions, setLensZoom])

  const loadFile = useCallback(
    async (paths: string[]): Promise<void> => {
      const path = paths[0]
      if (!path) return
      const name = fileNameOf(path)
      setLoading(true)
      setError(null)
      try {
        const mimeType = guessMimeType(name)
        if (
          !mimeType ||
          !(ACCEPTED_IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(name))
        ) {
          throw stashError('UNSUPPORTED', `"${name}" isn't a supported image format.`, {
            technicalMessage: `mime=${String(mimeType)}`
          })
        }
        const { bytes, truncated, sizeBytes } = await window.stash.fs.readFileBytes({ path })
        if (truncated) {
          throw stashError('FS_READ', `"${name}" is too large to preview in full.`)
        }
        // <img> rendering keeps SVGs inert — scripts inside them never execute.
        setImage({
          path,
          name,
          objectUrl: URL.createObjectURL(new Blob([bytes], { type: mimeType })),
          sizeBytes,
          mimeType
        })
        setDimensions(null)
        resetZoom()
        recordHistory(name, 'success')
      } catch (err) {
        const normalized = normalizeError(err)
        setError(normalized)
        recordHistory(name, 'failure', normalized.userMessage)
      } finally {
        setLoading(false)
      }
    },
    [resetZoom]
  )

  return (
    <div className="flex flex-col gap-4">
      {!image && (
        <DropZone
          accept={[...ACCEPTED_IMAGE_EXTENSIONS]}
          label="Drop an image here"
          hint="PNG · JPG · GIF · WebP · BMP · SVG · AVIF — one file at a time"
          dialogTitle="Choose an image to preview"
          onFiles={loadFile}
        />
      )}

      {image && (
        <Panel className="p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <SectionHeading>Preview</SectionHeading>
            <div className="flex items-center gap-1.5">
              <span aria-live="polite" className="tnum mr-1 text-[11px] text-faint">
                {!isZoomed ? 'Fit' : `${zoomPercent}%`}
              </span>
              <IconButton
                variant="surface"
                size="sm"
                aria-label="Zoom out"
                title="Zoom out"
                disabled={zoomPercent <= ZOOM_MIN_PERCENT}
                onClick={() => zoomOut()}
              >
                <ZoomOut size={13} />
              </IconButton>
              <IconButton
                variant="surface"
                size="sm"
                aria-label="Zoom in"
                title="Zoom in"
                disabled={zoomPercent >= ZOOM_MAX_PERCENT}
                onClick={() => zoomIn()}
              >
                <ZoomIn size={13} />
              </IconButton>
              <Button
                size="sm"
                variant={!isZoomed ? 'primary' : 'secondary'}
                aria-pressed={!isZoomed}
                title="Fit image inside preview window"
                onClick={resetZoom}
              >
                Fit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                title="Show at actual pixel size (1:1)"
                onClick={handleShowActualSize}
              >
                100%
              </Button>
              <IconButton
                variant="surface"
                size="sm"
                aria-label={`Close ${image.name}`}
                title="Close image"
                onClick={closeImage}
              >
                <X size={13} />
              </IconButton>
            </div>
          </div>

          <div
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            className={`flex min-h-40 max-h-[65vh] items-center justify-center overflow-hidden rounded-md border border-line bg-base p-3 select-none ${cursorClass}`}
          >
            <div style={transformStyle} className="flex items-center justify-center">
              <img
                ref={imgRef}
                key={image.objectUrl}
                src={image.objectUrl}
                alt={image.name}
                draggable={false}
                onLoad={(e) =>
                  setDimensions({
                    width: e.currentTarget.naturalWidth,
                    height: e.currentTarget.naturalHeight
                  })
                }
                className="max-h-[60vh] max-w-full object-contain pointer-events-none select-none"
              />
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 border-t border-line pt-3">
            <MetadataRow
              label="Name"
              value={
                <span className="truncate" title={image.name}>
                  {image.name}
                </span>
              }
            />
            <MetadataRow
              label="Dimensions"
              value={
                dimensions ? (
                  <span className="tnum">
                    {dimensions.width} × {dimensions.height} px
                  </span>
                ) : (
                  <span className="text-faint">—</span>
                )
              }
            />
            <MetadataRow
              label="Size"
              value={<span className="tnum">{formatBytes(image.sizeBytes)}</span>}
            />
            <MetadataRow label="Type" value={image.mimeType} />
          </dl>

          <div className="mt-3 border-t border-line pt-3">
            <DropZone
              accept={[...ACCEPTED_IMAGE_EXTENSIONS]}
              label="Replace with another image"
              dialogTitle="Choose an image to preview"
              onFiles={(paths) => {
                closeImage()
                void loadFile(paths)
              }}
            />
          </div>
        </Panel>
      )}

      {loading && (
        <p role="status" className="flex items-center gap-2 text-[12px] text-faint">
          <Spinner label="Reading image file" /> Reading file…
        </p>
      )}

      {!loading && error && <ErrorNote error={error} />}

      {!image && !loading && !error && (
        <EmptyState
          icon="image"
          title="Nothing open yet."
          hint="Drop or browse for an image above to inspect its dimensions and preview it at any zoom level. Files are read locally only — nothing leaves this machine."
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

function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}

/**
 * History is best-effort (TOOL_SPEC.md): failures never break the tool flow.
 */
function recordHistory(filename: string, status: 'success' | 'failure', message?: string): void {
  try {
    void window.stash.history.record({
      toolId: 'image-preview',
      operation: 'preview',
      inputs: [filename],
      outputs: [],
      status,
      ...(message ? { message } : {})
    })
  } catch {
    // Ignore — activity history must not surface errors into the tool UI.
  }
}
