import { useCallback, useEffect, useState } from 'react'
import { Copy, X } from 'lucide-react'
import exifr from 'exifr'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorNote, Panel, SectionHeading, Spinner } from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { DropZone } from '../../components/ui/DropZone'
import { normalizeError, stashError, type StashError } from '../../../shared/errors'
import { guessMimeType } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  buildExifSections,
  hasUsableExif,
  isSupportedExifExtension,
  type ExifSection,
  type ExifTagBag
} from './logic'

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.tiff', '.tif', '.png']

interface LoadedPhoto {
  path: string
  name: string
  objectUrl: string
}

export default function ImageExifTool() {
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null)
  const [sections, setSections] = useState<ExifSection[]>([])
  const [rawTags, setRawTags] = useState<ExifTagBag | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StashError | null>(null)

  // Object URLs must be released whenever replaced or on unmount.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.objectUrl)
    }
  }, [photo])

  const closePhoto = useCallback((): void => {
    setPhoto(null)
    setSections([])
    setRawTags(null)
    setError(null)
  }, [])

  const loadFile = useCallback(async (paths: string[]): Promise<void> => {
    const path = paths[0]
    if (!path) return
    const name = fileNameOf(path)
    setLoading(true)
    setError(null)
    try {
      if (!isSupportedExifExtension(extensionOf(name))) {
        throw stashError(
          'UNSUPPORTED',
          `"${name}" isn't a supported format. EXIF lives in JPG and TIFF files — PNG almost never carries it.`
        )
      }
      const mimeType = guessMimeType(name) ?? 'application/octet-stream'
      const { bytes, truncated } = await window.stash.fs.readFileBytes({ path })
      if (truncated) {
        throw stashError('FS_READ', `"${name}" is too large to inspect (limit is 64 MB).`)
      }
      // exifr may hold onto the buffer; give it a private copy like pdf.js.
      let tags: ExifTagBag | undefined
      try {
        tags = await exifr.parse(new Uint8Array(bytes.slice(0)), {
          tiff: true,
          exif: true,
          gps: true,
          translateValues: true,
          reviveValues: true
        })
      } catch {
        // Unparsable metadata is not a failure of the tool — treat as no EXIF.
        tags = undefined
      }
      const parsed = tags ?? {}
      setSections(buildExifSections(parsed))
      setRawTags(hasUsableExif(parsed) ? parsed : null)
      setPhoto({
        path,
        name,
        objectUrl: URL.createObjectURL(new Blob([bytes], { type: mimeType }))
      })
      recordHistoryQuietly({
        toolId: 'image-exif',
        operation: 'inspect-exif',
        inputs: [name],
        outputs: [],
        status: 'success'
      })
    } catch (err) {
      const normalized = normalizeError(err)
      setError(normalized)
      recordHistoryQuietly({
        toolId: 'image-exif',
        operation: 'inspect-exif',
        inputs: [name],
        outputs: [],
        status: 'failure',
        message: normalized.userMessage
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const copyAllAsJson = async (): Promise<void> => {
    if (!photo || !rawTags) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(rawTags, jsonSafe, 2))
      toastSuccess('Copied EXIF as JSON', `${Object.keys(rawTags).length} tags`)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!photo && (
        <DropZone
          accept={[...ACCEPTED_EXTENSIONS]}
          label="Drop an image here"
          hint="JPG · JPEG · TIFF · TIF · PNG — one file at a time · up to 64 MB"
          dialogTitle="Choose an image to inspect"
          onFiles={(paths) => void loadFile(paths)}
        />
      )}

      {loading && (
        <p role="status" className="flex items-center gap-2 text-[12px] text-faint">
          <Spinner label="Reading image" /> Reading image…
        </p>
      )}

      {error && !loading && (
        <>
          <ErrorNote error={error} />
          <EmptyState
            icon="image"
            title="That file couldn't be inspected."
            hint={error.userMessage}
          />
        </>
      )}

      {!loading && !error && !photo && (
        <EmptyState
          icon="image"
          title="Nothing inspected yet."
          hint="Drop or browse for a photo above to see what it quietly records about itself — camera, lens, exposure settings, capture time and GPS position, all read locally."
        />
      )}

      {photo && (
        <>
          <Panel className="p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeading>Image</SectionHeading>
              <div className="flex items-center gap-1.5">
                {rawTags && (
                  <Button size="sm" variant="secondary" onClick={() => void copyAllAsJson()}>
                    <Copy size={12} /> Copy all as JSON
                  </Button>
                )}
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={`Close ${photo.name}`}
                  title="Close image"
                  onClick={closePhoto}
                >
                  <X size={13} />
                </IconButton>
              </div>
            </div>
            <p className="mt-1 truncate font-mono text-[12px] text-dim" title={photo.path}>
              {photo.name}
            </p>
            <img
              src={photo.objectUrl}
              alt={`Preview of ${photo.name}`}
              className="mt-3 max-h-48 w-auto max-w-full self-start rounded-md border border-line bg-base object-contain p-2"
            />
          </Panel>

          {sections.length === 0 ? (
            <EmptyState
              icon="image"
              title="This image has no EXIF data."
              hint="Screenshots and processed exports usually strip metadata entirely; photos taken by cameras and phones normally carry it."
            />
          ) : (
            sections.map((section) => (
              <Panel key={section.title} className="p-3.5">
                <SectionHeading>{section.title}</SectionHeading>
                <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5">
                  {section.rows.map((row) => (
                    <ExifRowLine key={row.label} row={row} />
                  ))}
                </dl>
              </Panel>
            ))
          )}
        </>
      )}
    </div>
  )
}

function ExifRowLine({ row }: { row: { label: string; value: string } }) {
  return (
    <>
      <dt className="w-32 shrink-0 text-right text-[12px] text-faint">{row.label}</dt>
      <dd className="min-w-0 break-words text-[12px] leading-snug text-ink">{row.value}</dd>
    </>
  )
}

function extensionOf(filename: string): string {
  const base = fileNameOf(filename)
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? '' : base.slice(dot).toLowerCase()
}

/** Convert Dates/Buffers so JSON.stringify never chokes on exotic tag values. */
function jsonSafe(_key: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return `<${value.byteLength} bytes>`
  return value
}
