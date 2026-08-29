import { useCallback, useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import type { FileFilter } from '../../../shared/ipc'
import { normalizeError } from '../../../shared/errors'

export interface DropZoneProps {
  /** Accepted extensions, e.g. ['.pdf', '.png'] or ['zip']. Empty means any file. */
  accept?: string[]
  multiple?: boolean
  disabled?: boolean
  label?: string
  hint?: string
  dialogTitle?: string
  onFiles: (paths: string[]) => void
  className?: string
}

interface DragState {
  active: boolean
  valid: boolean
}

/**
 * Normalizes an extension to lowercase with leading dot, e.g. 'ZIP' -> '.zip'.
 */
export function normalizeExtension(ext: string): string {
  const clean = ext.trim().toLowerCase()
  return clean.startsWith('.') ? clean : `.${clean}`
}

/**
 * Extracts the file extension (with leading dot, lowercase) from a path or file name.
 */
export function getFileExtension(pathOrName: string): string {
  const base = pathOrName.split(/[\\/]/).pop() ?? pathOrName
  const dot = base.lastIndexOf('.')
  if (dot < 0) return ''
  return base.slice(dot).toLowerCase().trim()
}

/**
 * Resolves a dropped File object to an absolute filesystem path or filename.
 */
export function resolveDroppedPath(file: File): string {
  try {
    if (typeof window !== 'undefined' && window.stash?.files?.getPathForFile) {
      const bridgePath = window.stash.files.getPathForFile(file)
      if (typeof bridgePath === 'string' && bridgePath.trim().length > 0) {
        return bridgePath.trim()
      }
    }
  } catch {
    // webUtils may throw on synthetic file objects in non-Electron test environments
  }

  const directPath = (file as unknown as { path?: string }).path
  if (typeof directPath === 'string' && directPath.trim().length > 0) {
    return directPath.trim()
  }

  return file.name || ''
}

/**
 * Checks whether a given file matches the accepted extensions.
 */
export function isFileAccepted(file: File, resolvedPath: string, accept: string[]): boolean {
  if (!accept || accept.length === 0) return true
  const normalizedAccept = accept.map(normalizeExtension)

  const pathExt = getFileExtension(resolvedPath)
  if (pathExt && normalizedAccept.includes(pathExt)) return true

  const nameExt = getFileExtension(file.name)
  if (nameExt && normalizedAccept.includes(nameExt)) return true

  return false
}

/**
 * Compact contextual drop surface (DESIGN.md → Drag/drop).
 * States: idle / drag-over(valid) / drag-over(invalid) — communicated through
 * border and text changes plus a subtle scale, not decoration.
 */
export function DropZone({
  accept = [],
  multiple = false,
  disabled = false,
  label = 'Drop files here',
  hint,
  dialogTitle,
  onFiles,
  className = ''
}: DropZoneProps) {
  const [drag, setDrag] = useState<DragState>({ active: false, valid: true })
  const [error, setError] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const depthCounter = useRef(0)

  const filterValid = useCallback(
    (files: ArrayLike<File>): string[] => {
      const paths: string[] = []
      for (const file of Array.from(files)) {
        const resolvedPath = resolveDroppedPath(file)
        if (!resolvedPath) continue
        if (!isFileAccepted(file, resolvedPath, accept)) continue
        paths.push(resolvedPath)
      }
      return paths
    },
    [accept]
  )

  const handleDrop = (e: React.DragEvent) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    depthCounter.current = 0
    setDrag({ active: false, valid: true })

    const rawFiles = e.dataTransfer.files?.length
      ? Array.from(e.dataTransfer.files)
      : Array.from(e.dataTransfer.items || [])
          .map((item) => item.getAsFile())
          .filter((f): f is File => f !== null)

    if (rawFiles.length === 0) return

    const paths = filterValid(rawFiles)
    if (paths.length === 0 || (!multiple && paths.length !== 1)) {
      const expected = accept.length ? ` ${accept.map(normalizeExtension).join(', ')}` : ''
      setError(
        paths.length === 0
          ? `That file type isn't supported here.${expected ? ` Expected:${expected}` : ''}`
          : 'This tool accepts one file at a time.'
      )
      return
    }
    setError(null)
    setAccepted(true)
    setTimeout(() => setAccepted(false), 550)
    onFiles(multiple ? paths : paths.slice(0, 1))
  }

  const handleBrowse = async () => {
    if (disabled) return
    try {
      const filters: FileFilter[] =
        accept.length > 0
          ? [
              {
                name: 'Supported files',
                extensions: accept.map((e) => normalizeExtension(e).replace(/^\./, ''))
              }
            ]
          : []
      const result = await window.stash.dialogs.openFile({
        title: dialogTitle,
        filters,
        multiSelections: multiple
      })
      if (!result.cancelled && result.paths.length > 0) {
        setError(null)
        onFiles(result.paths)
      }
    } catch (err) {
      setError(normalizeError(err).userMessage)
    }
  }

  const borderTone = !drag.active
    ? 'border-line hover:border-line-strong'
    : drag.valid
      ? 'border-accent/80 bg-accent-soft/40'
      : 'border-line-strong bg-raised'

  return (
    <div className={`relative flex flex-col ${className}`} data-dropzone>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={`${label}. Click to browse.`}
        onClick={handleBrowse}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            void handleBrowse()
          }
        }}
        onDragEnter={(e) => {
          if (disabled) return
          e.preventDefault()
          e.stopPropagation()
          depthCounter.current += 1
          setDrag({
            active: true,
            valid: e.dataTransfer.types.includes('Files')
          })
        }}
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          e.stopPropagation()
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          depthCounter.current -= 1
          if (depthCounter.current <= 0) setDrag({ active: false, valid: true })
        }}
        onDrop={handleDrop}
        className={`flex w-full h-full flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-6 transition-all duration-150 ease-out ${
          disabled ? 'cursor-not-allowed opacity-45' : ''
        } ${accepted ? 'accept-pulse' : ''} ${borderTone}`}
      >
        <UploadCloud
          size={18}
          strokeWidth={1.5}
          className={`transition-colors duration-150 ${
            drag.active && drag.valid ? 'text-accent' : 'text-faint'
          }`}
          aria-hidden
        />
        <span
          className={`text-[12.5px] transition-colors duration-150 ${
            drag.active && drag.valid ? 'text-accent' : 'text-dim'
          }`}
        >
          {drag.active ? 'Release to add' : label}
        </span>
        {hint && !drag.active && <span className="text-[11px] text-faint">{hint}</span>}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[12px] leading-snug text-danger">
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        multiple={multiple}
      />
    </div>
  )
}
