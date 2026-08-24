import { useCallback, useEffect, useState } from 'react'
import jsQR from 'jsqr'
import { Copy } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { EmptyState, ErrorNote, Panel, SectionHeading, Spinner } from '../../components/ui/Feedback'
import { normalizeError, stashError, type StashError } from '../../../shared/errors'
import { formatBytes, guessMimeType } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import {
  ACCEPTED_QR_EXTENSIONS,
  downscaleIfNeeded,
  extractResult,
  pickDecoderCanvas,
  type JsQrResultLike
} from './logic'

/** Longest edge allowed before the image is scaled for decode. */
const MAX_DECODE_DIM = 2000

interface DecodedImage {
  name: string
  objectUrl: string
  sizeBytes: number
  width: number
  height: number
  text: string
  decodeMs: number
  noQrFound: boolean
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas

export default function QrDecoderTool() {
  const [image, setImage] = useState<DecodedImage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StashError | null>(null)

  // Object URLs must be released whenever replaced or on unmount; keying on
  // the URL guarantees exactly-once revocation.
  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.objectUrl)
    }
  }, [image])

  const closeImage = useCallback(() => {
    setImage(null)
    setError(null)
  }, [])

  const loadFile = useCallback(async (paths: string[]): Promise<void> => {
    const path = paths[0]
    if (!path) return
    const name = fileNameOf(path)
    setLoading(true)
    setError(null)
    try {
      const mimeType = guessMimeType(name)
      if (!mimeType || !(ACCEPTED_QR_EXTENSIONS as readonly string[]).includes(extensionOf(name))) {
        throw stashError('UNSUPPORTED', `"${name}" isn't a supported image format.`, {
          technicalMessage: `mime=${String(mimeType)}`
        })
      }
      const { bytes, truncated, sizeBytes } = await window.stash.fs.readFileBytes({ path })
      if (truncated) {
        throw stashError('FS_READ', `"${name}" is too large to read in full.`)
      }
      let bitmap: ImageBitmap
      try {
        bitmap = await createImageBitmap(new Blob([bytes], { type: mimeType }))
      } catch (err) {
        throw stashError('UNSUPPORTED', `"${name}" couldn't be decoded as an image.`, {
          technicalMessage: err instanceof Error ? err.message : String(err)
        })
      }
      try {
        const scale = downscaleIfNeeded(bitmap.width, bitmap.height, MAX_DECODE_DIM)
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        // OffscreenCanvas keeps decoding off the visible DOM; fall back to a
        // document canvas when the runtime doesn't provide it.
        const surface = pickDecoderCanvas<AnyCanvas>(
          { width, height },
          typeof OffscreenCanvas === 'function' ? OffscreenCanvas : null,
          HTMLCanvasElement,
          // The two 2D context flavors are structurally identical for
          // drawImage/getImageData; only DOM-only extras differ.
          (canvas) => canvas.getContext('2d') as CanvasRenderingContext2D | null
        )
        surface.ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height)
        const pixels = surface.ctx.getImageData(0, 0, width, height)
        const startedAt = performance.now()
        const result: JsQrResultLike = jsQR(pixels.data, pixels.width, pixels.height)
        const decodeMs = performance.now() - startedAt
        const outcome = extractResult(result)
        setImage({
          name,
          objectUrl: URL.createObjectURL(new Blob([bytes], { type: mimeType })),
          sizeBytes,
          width,
          height,
          text: outcome.ok ? outcome.text : '',
          decodeMs,
          noQrFound: !outcome.ok
        })
        if (outcome.ok) recordHistory(name, outcome.text.slice(0, 40))
      } finally {
        bitmap.close()
      }
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const isUrl = /^https?:\/\//i.test(image?.text ?? '')

  return (
    <div className="flex flex-col gap-4">
      {!image && (
        <DropZone
          accept={[...ACCEPTED_QR_EXTENSIONS]}
          label="Drop an image with a QR code"
          hint="PNG · JPG · WebP · BMP — one file at a time"
          dialogTitle="Choose an image containing a QR code"
          onFiles={loadFile}
        />
      )}

      {image && (
        <Panel className="p-3.5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionHeading>Decoded</SectionHeading>
            <span aria-live="polite" className="tnum mr-1 text-[11px] text-faint">
              {image.width} × {image.height} px · {formatBytes(image.sizeBytes)} ·{' '}
              {Math.max(1, Math.round(image.decodeMs))} ms
            </span>
          </div>

          <div className="grid grid-cols-[minmax(96px,180px)_minmax(0,1fr)] gap-3">
            <img
              src={image.objectUrl}
              alt={`Thumbnail of ${image.name}`}
              className="max-h-44 w-full self-start rounded-sm border border-line object-contain bg-base p-1"
            />

            <div className="flex min-w-0 flex-col gap-2">
              {image.noQrFound ? (
                <div
                  role="status"
                  className="rounded-md border border-line bg-base px-3 py-4 text-center"
                >
                  <p className="text-[12.5px] leading-snug text-dim">
                    This image doesn't contain a readable QR code.
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
                    Try a sharper photo, more of the code inside the frame, or a larger source image
                    — low contrast and glare are the usual culprits.
                  </p>
                </div>
              ) : (
                <>
                  <label htmlFor="qr-decoded-text" className="sr-only">
                    Decoded QR content
                  </label>
                  <textarea
                    id="qr-decoded-text"
                    readOnly
                    value={image.text}
                    onFocus={(e) => e.target.select()}
                    rows={4}
                    className="w-full resize-none rounded-md border border-line bg-base px-2.5 py-2 font-mono text-[12.5px] leading-relaxed break-all whitespace-pre-wrap text-ink select-text focus:border-accent/70 focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => void copyText(image.text)}>
                      <Copy size={13} /> Copy
                    </Button>
                  </div>
                  {isUrl && (
                    <div className="rounded-md border border-line bg-base px-3 py-2.5">
                      <p className="text-[11px] tracking-wide text-faint uppercase">
                        Looks like a link
                      </p>
                      <code className="mt-1 block font-mono text-[12px] break-all text-dim select-text">
                        {image.text}
                      </code>
                      <p className="mt-1.5 text-[11.5px] leading-snug text-faint">
                        Stash stays local and doesn't open browsers — copy the address above and
                        paste it into your browser yourself.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-3 border-t border-line pt-3">
            <DropZone
              accept={[...ACCEPTED_QR_EXTENSIONS]}
              label="Replace with another image"
              dialogTitle="Choose an image containing a QR code"
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
          <Spinner label="Scanning image for a QR code" /> Scanning for a QR code…
        </p>
      )}

      {!loading && error && <ErrorNote error={error} />}

      {!image && !loading && !error && (
        <EmptyState
          icon="code"
          title="Nothing scanned yet."
          hint="Drop or browse for an image above to extract its QR payload locally. Images never leave this machine."
        />
      )}
    </div>
  )
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toastSuccess('Decoded text copied to clipboard')
  } catch (err) {
    toastError(err)
  }
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
function recordHistory(filename: string, snippet: string): void {
  try {
    void window.stash.history.record({
      toolId: 'qr-decoder',
      operation: 'decode',
      inputs: [filename],
      outputs: [snippet],
      status: 'success'
    })
  } catch {
    // Ignore — activity history must not surface errors into the tool UI.
  }
}
