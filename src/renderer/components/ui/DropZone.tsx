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
  onFiles?: (paths: string[]) => void
  onRawFiles?: (files: File[]) => void
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
  onRawFiles,
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

    const validRawFiles = rawFiles.filter((f) => isFileAccepted(f, f.name, accept))
    if (validRawFiles.length === 0) {
      const expected = accept.length ? ` ${accept.map(normalizeExtension).join(', ')}` : ''
      setError(`That file type isn't supported here.${expected ? ` Expected:${expected}` : ''}`)
      return
    }

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
    if (onRawFiles) {
      onRawFiles(multiple ? validRawFiles : validRawFiles.slice(0, 1))
    }
    if (onFiles) {
      onFiles(multiple ? paths : paths.slice(0, 1))
    }
    if (typeof window !== 'undefined' && window.stash?.assets?.addBatch && paths.length > 0) {
      window.stash.assets.addBatch(paths).catch(() => {})
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    const rawFiles = Array.from(e.target.files)
    const validRawFiles = rawFiles.filter((f) => isFileAccepted(f, f.name, accept))
    const paths = filterValid(rawFiles)
    setError(null)
    setAccepted(true)
    setTimeout(() => setAccepted(false), 550)
    if (onRawFiles) {
      onRawFiles(multiple ? validRawFiles : validRawFiles.slice(0, 1))
    }
    if (onFiles) {
      onFiles(multiple ? paths : paths.slice(0, 1))
    }
    if (typeof window !== 'undefined' && window.stash?.assets?.addBatch && paths.length > 0) {
      window.stash.assets.addBatch(paths).catch(() => {})
    }
    e.target.value = ''
  }

  const handleBrowse = async () => {
    if (disabled) return
    try {
      if (typeof window !== 'undefined' && window.stash?.dialogs?.openFile) {
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
          if (onFiles) onFiles(result.paths)
          if (window.stash?.assets?.addBatch) {
            window.stash.assets.addBatch(result.paths).catch(() => {})
          }
        }
      } else {
        inputRef.current?.click()
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
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
      />
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
          if (disabled) return
          e.preventDefault()
          e.stopPropagation()
          depthCounter.current -= 1
          if (depthCounter.current <= 0) {
            depthCounter.current = 0
            setDrag({ active: false, valid: true })
          }
        }}
        onDrop={handleDrop}
        className={`flex w-full h-full min-h-[160px] flex-1 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed px-6 py-10 transition-all duration-150 ease-out ${
          disabled ? 'cursor-not-allowed opacity-45' : ''
        } ${accepted ? 'accept-pulse' : ''} ${borderTone}`}
      >
        <UploadCloud
          size={28}
          strokeWidth={1.6}
          className={`transition-colors duration-150 ${
            drag.active && drag.valid ? 'text-accent' : 'text-faint'
          }`}
          aria-hidden
        />
        <span
          className={`text-[13.5px] font-medium transition-colors duration-150 ${
            drag.active && drag.valid ? 'text-accent' : 'text-ink'
          }`}
        >
          {drag.active ? 'Release to add' : label}
        </span>
        {hint && !drag.active && <span className="text-[12px] text-dim">{hint}</span>}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[12px] leading-snug text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
