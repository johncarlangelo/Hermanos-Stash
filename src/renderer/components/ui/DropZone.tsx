import { useCallback, useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import type { FileFilter } from '../../../shared/ipc'
import { normalizeError } from '../../../shared/errors'

export interface DropZoneProps {
  /** Accepted extensions, e.g. ['.pdf', '.png']. Empty means any file. */
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
  const inputRef = useRef<HTMLInputElement>(null)
  const depthCounter = useRef(0)

  const filterValid = useCallback(
    (files: ArrayLike<File>): string[] => {
      const paths: string[] = []
      for (const file of Array.from(files)) {
        // Electron ≥32 removed File.path; resolve via the preload bridge.
        const filePath = window.stash.files.getPathForFile(file)
        if (!filePath) continue
        if (accept.length > 0 && !accept.includes(extensionOf(filePath))) continue
        paths.push(filePath)
      }
      return paths
    },
    [accept]
  )

  const handleDrop = (e: React.DragEvent) => {
    if (disabled) return
    e.preventDefault()
    depthCounter.current = 0
    setDrag({ active: false, valid: true })
    const paths = filterValid(e.dataTransfer.files)
    if (paths.length === 0 || (!multiple && paths.length !== 1)) {
      const expected = accept.length ? ` ${accept.join(', ')}` : ''
      setError(
        paths.length === 0
          ? `That file type isn't supported here.${expected ? ` Expected:${expected}` : ''}`
          : 'This tool accepts one file at a time.'
      )
      return
    }
    setError(null)
    onFiles(multiple ? paths : paths.slice(0, 1))
  }

  const handleBrowse = async () => {
    if (disabled) return
    try {
      const filters: FileFilter[] =
        accept.length > 0 ? [{ name: 'Supported files', extensions: accept.map(stripDot) }] : []
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

  const multipleAccepted = accept.length === 0

  const borderTone = !drag.active
    ? 'border-line hover:border-line-strong'
    : drag.valid
      ? 'border-accent/80 bg-accent-soft/40'
      : // Extension validity can't be verified mid-drag when a filter is set,
        // so show a neutral "armed" state instead of implying acceptance or rejection.
        'border-line-strong bg-raised'

  return (
    <div className={className}>
      <div
        role="button"
        data-dropzone
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
          depthCounter.current += 1
          setDrag({
            active: true,
            valid: e.dataTransfer.types.includes('Files') && multipleAccepted
          })
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          depthCounter.current -= 1
          if (depthCounter.current <= 0) setDrag({ active: false, valid: true })
        }}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-6 transition-all duration-150 ease-out ${
          disabled ? 'cursor-not-allowed opacity-45' : ''
        } ${borderTone}`}
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

function extensionOf(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot).toLowerCase()
}

function stripDot(ext: string): string {
  return ext.replace(/^\./, '')
}
