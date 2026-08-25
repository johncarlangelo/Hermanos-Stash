import { useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
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
 * Command palette on cmdk (Milestone 7).
 *
 * The registry's fuzzy search decides ranking: the typed query drives
 * `toolRegistry.search()` and its top matches are the only rendered items
 * (`shouldFilter={false}` — cmdk provides focus capture, arrows, Enter, Esc;
 * we own the list). With an empty query the palette shows favorites first,
 * then every tool.
 */
export function CommandPalette() {
  const open = useNav((s) => s.paletteOpen)
  const setOpen = useNav((s) => s.setPaletteOpen)
  const openTool = useNav((s) => s.openTool)

  const favorites = useLibrary((s) => s.favorites)
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
      contentClassName="fixed top-[14vh] left-1/2 z-41 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2"
      shouldFilter={false}
      loop
      className="overflow-hidden rounded-lg border border-line-strong bg-overlay shadow-2xl shadow-black/40"
    >
      <div className="relative flex items-center border-b border-line">
        <Command.Input
          value={query}
          onValueChange={setQuery}
          autoFocus
          placeholder="Type a tool name, tag, or category…"
          className="h-12 w-full bg-transparent pl-11 pr-4 text-[14px] text-ink placeholder:text-faint focus:outline-none"
        />
        <Search
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-4 text-faint"
        />
      </div>

      <Command.List className="max-h-[52vh] overflow-y-auto">
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

      <div className="border-t border-line px-4 py-2 text-[10.5px] text-faint">
        ↑↓ navigate · Enter open · Esc close
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
  const categoryLabel = getCategory(tool.category)?.label ?? tool.category
  return (
    <Command.Item
      value={itemValue}
      onSelect={() => onChoose(tool)}
      className="group flex cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 ease-out select-none data-[selected=true]:bg-surface data-[selected=true]:shadow-[inset_2px_0_0_var(--color-accent)]"
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
      {/* Tag chips reveal on hover OR keyboard selection (not hover-only). */}
      <span className="hidden shrink-0 items-center gap-1 group-data-[selected=true]:flex group-hover:flex">
        {tool.tags.slice(0, 2).map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}
      </span>
      {isFavorite && (
        <Star size={12} className="shrink-0 text-accent" fill="currentColor" aria-hidden />
      )}
    </Command.Item>
  )
}
