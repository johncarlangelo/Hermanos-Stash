import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Star } from 'lucide-react'
import { getCategory } from '../../../shared/constants/categories'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { ToolSearchMatch } from '../../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'
import { TagChip } from '../../components/ui/Inputs'
import { useLibrary } from '../../stores/library'
import { useNav } from '../../stores/nav'

/**
 * Command-palette style global search (DESIGN.md → Search).
 * Fuzzy matching over name, tags, category and description; full keyboard nav.
 */
export function CommandPalette() {
  const open = useNav((s) => s.paletteOpen)
  const setOpen = useNav((s) => s.setPaletteOpen)
  const openTool = useNav((s) => s.openTool)

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)

  const favorites = useLibrary((s) => s.favorites)

  const results: ToolSearchMatch[] = useMemo(() => {
    if (!query.trim()) return []
    return toolRegistry.search(query).slice(0, 9)
  }, [query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, setOpen])

  if (!open) return null

  const choose = (tool: ToolDefinition) => {
    setOpen(false)
    openTool(tool.id)
  }

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (results.length === 0 ? 0 : Math.min(i + 1, results.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      choose(results[activeIndex].tool)
    }
  }

  // Keep keyboard focus inside the modal while it is open.
  const trapFocus = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const focusables = e.currentTarget.querySelectorAll<HTMLElement>('input, button')
    if (focusables.length === 0) return
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-base/75 pt-[14vh]"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tools"
        onKeyDown={trapFocus}
        className="anim-pop w-[560px] overflow-hidden rounded-lg border border-line-strong bg-overlay shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          {/* autoFocus is intentional: the palette is a modal command surface. */}
          <Search size={15} className="shrink-0 text-faint" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Type a tool name, tag, or category…"
            aria-label="Search query"
            className="h-12 w-full bg-transparent text-[14px] text-ink placeholder:text-faint focus:outline-none"
          />
        </div>

        <ul ref={listRef} role="listbox" aria-label="Search results">
          {!query.trim() && (
            <li className="px-4 py-5 text-center">
              <p className="text-[12.5px] text-dim">Start typing to search the tool catalog.</p>
              <p className="mt-1 text-[11.5px] text-faint">
                ↑↓ to navigate · Enter to open · Esc to close
              </p>
            </li>
          )}
          {query.trim() && results.length === 0 && (
            <li className="px-4 py-5 text-center">
              <p className="text-[12.5px] text-dim">No tool matches “{query.trim()}” yet.</p>
              <p className="mt-1 text-[11.5px] text-faint">
                Try a tag like “pdf”, “json”, or “image”.
              </p>
            </li>
          )}
          {results.map((match, index) => {
            const { tool } = match
            const Icon = getIcon(tool.icon)
            const categoryLabel = getCategory(tool.category)?.label ?? tool.category
            const isFavorite = favorites.includes(tool.id)
            return (
              <li key={tool.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onClick={() => choose(tool)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`group flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                    index === activeIndex ? 'bg-surface' : ''
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} className="shrink-0 text-dim" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[13px] font-medium text-ink">{tool.name}</span>
                      <span className="shrink-0 text-[10.5px] tracking-wide text-faint uppercase">
                        {categoryLabel}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] leading-snug text-dim">
                      {tool.description}
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1 group-hover:flex">
                    {tool.tags.slice(0, 2).map((tag) => (
                      <TagChip key={tag} tag={tag} />
                    ))}
                  </span>
                  {isFavorite && (
                    <Star
                      size={12}
                      className="shrink-0 text-accent"
                      fill="currentColor"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
