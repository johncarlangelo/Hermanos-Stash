import { useEffect, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { toolsForExtension, extensionOfPath } from '../../../shared/utils/routing'
import { getCategory } from '../../../shared/constants/categories'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'
import { useNav } from '../../stores/nav'
import { toastError } from '../../stores/toasts'

/**
 * Window-level drop routing: dropping a file on the app background (outside
 * any tool's own drop zone) suggests registered tools that handle it.
 *
 * The suggestion list is a Radix Dialog now (Milestone 7): focus capture,
 * Esc handling and aria wiring come from the primitive instead of
 * hand-rolled listeners.
 */
export function DropRouter() {
  const [dragging, setDragging] = useState(false)
  const [matches, setMatches] = useState<ToolDefinition[] | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const depth = useRef(0)
  const openTool = useNav((s) => s.openTool)

  useEffect(() => {
    const isOverOwnDropZone = (target: EventTarget | null): boolean =>
      target instanceof Element && target.closest('[data-dropzone]') !== null

    const hasFiles = (e: DragEvent): boolean =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files')

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e) || isOverOwnDropZone(e.target)) return
      e.preventDefault()
      depth.current += 1
      setDragging(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      // Must keep preventing default so the window accepts the drop.
      if (!isOverOwnDropZone(e.target)) e.preventDefault()
    }
    const onDragLeave = () => {
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (isOverOwnDropZone(e.target)) {
        depth.current = 0
        setDragging(false)
        return
      }
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)

      const file = e.dataTransfer?.files[0]
      if (!file) return
      const filePath = window.stash.files.getPathForFile(file)
      if (!filePath) {
        toastError('That file could not be resolved to a local path.')
        return
      }
      const ext = extensionOfPath(filePath)
      const ids = toolsForExtension(ext)
      if (ids.length === 0) {
        toastError(`No tool here handles .${ext || 'this file type'} files yet.`)
        return
      }
      setActiveIndex(0)
      setMatches(ids.map((id) => toolRegistry.get(id)!).filter(Boolean))
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  const choose = (tool: ToolDefinition) => {
    setMatches(null)
    openTool(tool.id)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!matches) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && matches[activeIndex]) {
      e.preventDefault()
      choose(matches[activeIndex])
    }
  }

  return (
    <>
      {dragging && (
        <div
          aria-hidden
          className="anim-fade-in pointer-events-none fixed inset-2 z-30 rounded-lg border-2 border-accent/60 bg-accent-soft/20"
        >
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/50 bg-overlay px-4 py-1.5 text-[12.5px] text-accent shadow-lg">
            Drop to find matching tools
          </span>
        </div>
      )}

      <DialogPrimitive.Root
        open={matches !== null}
        onOpenChange={(o: boolean) => !o && setMatches(null)}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="anim-fade-in fixed inset-0 z-[38] bg-base/75" />
          <DialogPrimitive.Content
            aria-label="Open dropped file with"
            onKeyDown={onKeyDown}
            className="anim-modal-in fixed top-1/2 left-1/2 z-[39] w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border border-line-strong bg-overlay shadow-2xl shadow-black/40 focus:outline-none"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <DialogPrimitive.Title className="text-[13px] font-medium text-ink">
                Open with…
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="Close"
                className="cursor-pointer rounded-sm p-1 text-faint transition-colors duration-150 hover:bg-surface hover:text-ink"
              >
                ✕
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description className="sr-only">
              Choose a tool to open the dropped file with.
            </DialogPrimitive.Description>
            <ul role="listbox" aria-label="Matching tools">
              {matches?.map((tool, index) => {
                const Icon = getIcon(tool.icon)
                return (
                  <li key={tool.id} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      onClick={() => choose(tool)}
                      onMouseEnter={() => setActiveIndex(index)}
                      data-active={index === activeIndex}
                      className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                        index === activeIndex ? 'bg-surface' : ''
                      }`}
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.75}
                        className="shrink-0 text-dim"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                        {tool.name}
                      </span>
                      <span className="shrink-0 text-[10.5px] tracking-wide text-faint uppercase">
                        {getCategory(tool.category)?.label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="border-t border-line px-4 py-2 text-[10.5px] text-faint">
              ↑↓ navigate · Enter open · Esc close
            </p>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
