import { useCallback, useEffect, useState } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorNote, Panel, SectionHeading, Spinner } from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, stashError, type StashError } from '../../../shared/errors'
import { formatBytes, guessMimeType } from '../../../shared/utils/files'
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  stepZoom,
  ZOOM_MAX_PERCENT,
  ZOOM_MIN_PERCENT,
  type ZoomMode
} from './logic'

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
  const [zoom, setZoom] = useState<ZoomMode>('fit')

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
    setZoom('fit')
  }, [])

  const loadFile = useCallback(async (paths: string[]): Promise<void> => {
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
      setZoom('fit')
      recordHistory(name, 'success')
    } catch (err) {
      const normalized = normalizeError(err)
      setError(normalized)
      recordHistory(name, 'failure', normalized.userMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const zoomPercent = zoom === 'fit' ? null : zoom

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
                {zoomPercent === null ? 'Fit' : `${zoomPercent}%`}
              </span>
              <IconButton
                variant="surface"
                size="sm"
                aria-label="Zoom out"
                title="Zoom out"
                disabled={zoomPercent !== null && zoomPercent <= ZOOM_MIN_PERCENT}
                onClick={() => setZoom(stepZoom(zoom, -1))}
              >
                <ZoomOut size={13} />
              </IconButton>
              <IconButton
                variant="surface"
                size="sm"
                aria-label="Zoom in"
                title="Zoom in"
                disabled={zoomPercent !== null && zoomPercent >= ZOOM_MAX_PERCENT}
                onClick={() => setZoom(stepZoom(zoom, 1))}
              >
                <ZoomIn size={13} />
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
                aria-label={`Close ${image.name}`}
                title="Close image"
                onClick={closeImage}
              >
                <X size={13} />
              </IconButton>
            </div>
          </div>

          <div className="flex min-h-40 items-center justify-center overflow-auto rounded-md border border-line bg-base p-3">
            <img
              key={image.objectUrl}
              src={image.objectUrl}
              alt={image.name}
              onLoad={(e) =>
                setDimensions({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight
                })
              }
              className={
                zoom === 'fit'
                  ? 'max-h-[60vh] max-w-full object-contain'
                  : 'h-auto w-auto origin-top-left'
              }
              style={
                zoom !== 'fit' && dimensions
                  ? {
                      width: `${Math.round((dimensions.width * zoom) / 100)}px`,
                      height: 'auto'
                    }
                  : undefined
              }
            />
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
