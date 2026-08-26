import { useEffect, useMemo, useState } from 'react'
import { Command, useCommandState } from 'cmdk'
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
 * Command palette on cmdk (Milestones 7–8).
 *
 * Registry fuzzy search ranks; cmdk owns focus/arrows/Esc. Two panes:
 * the tool list (left) and a preview card (right) driven by
 * `useCommandState` — the single source of truth for which row is
 * highlighted, so keyboard, hover and initial state all agree.
 */
export function CommandPalette() {
  const open = useNav((s) => s.paletteOpen)
  const setOpen = useNav((s) => s.setPaletteOpen)
  const openTool = useNav((s) => s.openTool)
  const openToolInBackground = useNav((s) => s.openToolInBackground)

  const favorites = useLibrary((s) => s.favorites)
  const recents = useLibrary((s) => s.recents)
  const [query, setQuery] = useState('')

  // Controlled input state keyed on `open`: reset when closed, seed when a
  // tag chip or shortcut opened the palette with a query.
  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const seed = useNav.getState().paletteSeedQuery
    if (seed) {
      setQuery(seed)
      useNav.setState({ paletteSeedQuery: null })
    }
  }, [open])

  const results: ToolSearchMatch[] = useMemo(
    () => (query.trim() ? toolRegistry.search(query).slice(0, 9) : []),
    [query]
  )
  const allTools = useMemo(() => toolRegistry.all(), [])
  const favoriteTools = useMemo(
    () => allTools.filter((t) => favorites.includes(t.id)),
    [allTools, favorites]
  )

  if (!open) return null

  const choose = (tool: ToolDefinition) => {
    setOpen(false)
    openTool(tool.id)
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Search tools"
      overlayClassName="anim-fade-in fixed inset-0 z-40 bg-base/75"
      contentClassName="anim-modal-in fixed top-[12vh] left-1/2 z-41 w-[min(820px,calc(100vw-2rem))] -translate-x-1/2"
      shouldFilter={false}
      loop
      className="overflow-hidden rounded-md border border-line-strong bg-overlay shadow-2xl shadow-black/40"
    >
      <div className="relative flex items-center border-b border-line">
        <Command.Input
          value={query}
          onValueChange={setQuery}
          autoFocus
          placeholder="Type a tool name, tag, or category…"
          className="h-12 w-full bg-transparent pl-11 pr-4 text-[14px] text-ink placeholder:text-faint focus:outline-none"
        />
        <Search size={15} aria-hidden className="pointer-events-none absolute left-4 text-faint" />
      </div>

      {/* Two-pane layout: list + preview card (Milestone 8) */}
      <div className="flex">
        <Command.List className="max-h-[52vh] w-[360px] shrink-0 overflow-y-auto border-r border-line">
          <Command.Empty className="px-4 py-5 text-center">
            <p className="text-[12.5px] text-dim">No tool matches “{query.trim()}” yet.</p>
            <p className="mt-1 text-[11.5px] text-faint">
              Try a tag like “pdf”, “json”, or “image”.
            </p>
          </Command.Empty>

          {/* Ranked search results replace the catalog while a query is active. */}
          {query.trim() && (
            <Command.Group
              heading="Results"
              className="[&>[cmdk-group-heading]]:px-4 [&>[cmdk-group-heading]]:py-2 [&>[cmdk-group-heading]]:text-[10.5px] [&>[cmdk-group-heading]]:tracking-wide [&>[cmdk-group-heading]]:text-faint [&>[cmdk-group-heading]]:uppercase"
            >
              {results.map((match) => (
                <PaletteRow
                  key={match.tool.id}
                  tool={match.tool}
                  itemValue={`${match.tool.id}::result`}
                  onChoose={choose}
                  isFavorite={favorites.includes(match.tool.id)}
                />
              ))}
            </Command.Group>
          )}

          {!query.trim() && favoriteTools.length > 0 && (
            <Command.Group
              heading="Favorites"
              className="[&>[cmdk-group-heading]]:px-4 [&>[cmdk-group-heading]]:py-2 [&>[cmdk-group-heading]]:text-[10.5px] [&>[cmdk-group-heading]]:tracking-wide [&>[cmdk-group-heading]]:text-faint [&>[cmdk-group-heading]]:uppercase"
            >
              {favoriteTools.map((tool) => (
                <PaletteRow
                  key={`fav-${tool.id}`}
                  tool={tool}
                  itemValue={`${tool.id}::favorite`}
                  onChoose={choose}
                  isFavorite
                />
              ))}
            </Command.Group>
          )}

          {!query.trim() && (
            <Command.Group
              heading="All tools"
              className="[&>[cmdk-group-heading]]:px-4 [&>[cmdk-group-heading]]:py-2 [&>[cmdk-group-heading]]:text-[10.5px] [&>[cmdk-group-heading]]:tracking-wide [&>[cmdk-group-heading]]:text-faint [&>[cmdk-group-heading]]:uppercase"
            >
              {allTools.map((tool) => (
                <PaletteRow
                  key={tool.id}
                  tool={tool}
                  itemValue={`${tool.id}::all`}
                  onChoose={choose}
                  isFavorite={favorites.includes(tool.id)}
                />
              ))}
            </Command.Group>
          )}
        </Command.List>

        {/* Preview pane — mirrors the highlighted row via cmdk state */}
        <PreviewPane recents={recents} onOpenInBackground={openToolInBackground} />
      </div>

      <div className="border-t border-line px-4 py-2 text-center text-[10.5px] text-faint">
        ↑↓ navigate · Enter open · Ctrl+Enter background · Esc close
      </div>
    </Command.Dialog>
  )
}

function PaletteRow({
  tool,
  itemValue,
  onChoose,
  isFavorite
}: {
  tool: ToolDefinition
  itemValue: string
  onChoose: (t: ToolDefinition) => void
  isFavorite: boolean
}) {
  const Icon = getIcon(tool.icon)
  return (
    <Command.Item
      value={itemValue}
      onSelect={() => onChoose(tool)}
      className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-150 ease-out select-none data-[selected=true]:bg-surface data-[selected=true]:shadow-[inset_2px_0_0_var(--color-accent)]"
    >
      <Icon size={16} strokeWidth={1.75} className="shrink-0 text-dim" aria-hidden />
      {/* Two stacked lines: name (with star) over description. The wider
          list pane keeps names readable; tags/capabilities live in the
          preview pane instead of squeezing this column. */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-ink">{tool.name}</span>
          {isFavorite && (
            <Star size={11} className="shrink-0 text-accent" fill="currentColor" aria-hidden />
          )}
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-snug text-faint">
          {tool.description}
        </span>
      </span>
    </Command.Item>
  )
}

/**
 * Preview pane + background-open hotkey. Lives INSIDE the Command tree so
 * `useCommandState` can read the live highlighted value — one source of
 * truth for keyboard, pointer and initial state. Item values are
 * "<toolId>::<group>", so strip the suffix to resolve the tool.
 */
function PreviewPane({
  recents,
  onOpenInBackground
}: {
  recents: Array<{ toolId: string; lastUsedMs: number }>
  onOpenInBackground: (toolId: string) => void
}) {
  const selectedValue = useCommandState((state) => state.value)
  const allTools = useMemo(() => toolRegistry.all(), [])
  const toolId = selectedValue?.split('::')[0] ?? ''
  const tool = allTools.find((t) => t.id === toolId) ?? null

  // Ctrl+Enter opens the highlighted tool without leaving the current view.
  useEffect(() => {
    if (!tool) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        onOpenInBackground(tool.id)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [tool, onOpenInBackground])

  return (
    <>
      {tool ? <PreviewContent tool={tool} recents={recents} /> : <PreviewPlaceholder />}
      {/* Invisible but focusable mirror of the highlighted row so Ctrl+Enter
          works while cmdk's hidden input holds focus inside the dialog. */}
      {tool && <span className="sr-only" aria-hidden>{`Background open ready: ${tool.name}`}</span>}
    </>
  )
}

function PreviewPlaceholder() {
  return (
    <div className="glass hidden w-[280px] shrink-0 flex-col items-center justify-center gap-2 p-4 text-center md:flex">
      <Search size={18} className="text-faint/60" aria-hidden />
      <p className="max-w-[180px] text-[11.5px] leading-relaxed text-faint">
        Highlight a tool to preview it here.
      </p>
    </div>
  )
}

function PreviewContent({
  tool,
  recents
}: {
  tool: ToolDefinition
  recents: Array<{ toolId: string; lastUsedMs: number }>
}) {
  const Icon = getIcon(tool.icon)
  const categoryLabel = getCategory(tool.category)?.label ?? tool.category
  const usedLabel = formatLastUsed(recents, tool.id)
  const caps = tool.capabilities
  const capLines = [
    caps.acceptsFiles ? 'accepts files' : null,
    caps.acceptsMultipleFiles || caps.supportsBatch ? 'batch' : null,
    caps.acceptsText ? 'text in/out' : null,
    caps.producesFiles ? 'produces files' : null,
    caps.producesText ? 'produces text' : null,
    caps.supportsProgress ? 'progress' : null,
    caps.supportsCancellation ? 'cancellable' : null
  ].filter(Boolean) as string[]

  return (
    /* flex-1: the pane owns ALL remaining width right of the list — no
       dead gutter. min-w-0 keeps long names/tags wrapping instead of
       overflowing. */
    <div className="glass hidden min-w-0 flex-1 flex-col gap-3 p-4 md:flex" aria-live="polite">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-accent/30 bg-raised/80">
          <Icon size={18} strokeWidth={1.6} className="text-accent" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-ink">{tool.name}</p>
          <p className="font-mono text-[9.5px] tracking-wide text-faint uppercase">
            {categoryLabel}
          </p>
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-dim">{tool.description}</p>

      {capLines.length > 0 && (
        <>
          <PreviewSectionLabel>Capabilities</PreviewSectionLabel>
          <ul className="-mt-2 flex flex-wrap gap-1.5">
            {capLines.map((cap) => (
              <li
                key={cap}
                className="rounded-xs border border-line px-1.5 py-0.5 font-mono text-[9px] tracking-wide text-faint uppercase"
              >
                {cap}
              </li>
            ))}
          </ul>
        </>
      )}

      {tool.tags.length > 0 && (
        <>
          <PreviewSectionLabel>Tags</PreviewSectionLabel>
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {tool.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        </>
      )}

      <PreviewSectionLabel>Actions</PreviewSectionLabel>
      <div className="-mt-2 flex flex-col gap-1">
        <PreviewActionRow label="Open tool" hint="Enter" accent />
        <PreviewActionRow
          label={`Open in background${usedLabel ? ` · used ${usedLabel}` : ''}`}
          hint="Ctrl+Enter"
        />
      </div>
    </div>
  )
}

function PreviewSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.1em] text-faint uppercase select-none">
      {children}
    </p>
  )
}

/** Static action hint row — mirrors what the keyboard already does. */
function PreviewActionRow({
  label,
  hint,
  accent = false
}: {
  label: string
  hint: string
  accent?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-sm border border-line bg-base/40 px-2 py-1.5">
      <span className={`truncate text-[12px] ${accent ? 'text-accent' : 'text-dim'}`}>{label}</span>
      <kbd className="tnum shrink-0 rounded-xs border border-line bg-surface px-1 font-mono text-[9.5px] text-faint">
        {hint}
      </kbd>
    </div>
  )
}

function formatLastUsed(
  recents: Array<{ toolId: string; lastUsedMs: number }>,
  id: string
): string | null {
  const entry = recents.find((r) => r.toolId === id)
  if (!entry) return null
  const mins = Math.round((Date.now() - entry.lastUsedMs) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
