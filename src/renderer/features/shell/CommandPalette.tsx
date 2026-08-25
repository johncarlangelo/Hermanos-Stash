import { useEffect } from 'react'
import { Command } from 'cmdk'
import { Search, Star } from 'lucide-react'
import { getCategory } from '../../../shared/constants/categories'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'
import { TagChip } from '../../components/ui/Inputs'
import { useLibrary } from '../../stores/library'
import { useNav } from '../../stores/nav'

/**
 * Command palette on cmdk (Milestone 7).
 *
 * The registry's fuzzy search still decides ranking (same scoring as the
 * home screen and tag seeding); cmdk provides the standard palette shell —
 * focus capture, arrow/enter handling, Esc, and typeahead for free.
 */
export function CommandPalette() {
  const open = useNav((s) => s.paletteOpen)
  const setOpen = useNav((s) => s.setPaletteOpen)
  const openTool = useNav((s) => s.openTool)

  const favorites = useLibrary((s) => s.favorites)

  // Consume a seeded query (e.g. clicking a tag chip on a tool page).
  useEffect(() => {
    if (!open) return
    const seed = useNav.getState().paletteSeedQuery
    if (seed) {
      useNav.setState({ paletteSeedQuery: null })
      // cmdk owns its input state; seeding happens via defaultValue below.
    }
  }, [open])

  if (!open) return null

  const choose = (tool: ToolDefinition) => {
    setOpen(false)
    openTool(tool.id)
  }

  const seed = useNav.getState().paletteSeedQuery
  const allTools = toolRegistry.all()
  const favoriteTools = allTools.filter((t) => favorites.includes(t.id))

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Search tools"
      className="fixed inset-0 z-40 flex items-start justify-center bg-base/75 pt-[14vh]"
      shouldFilter={false}
      loop
    >
      {/* Backdrop click-to-close: cmdk renders the overlay as our root. */}
      <div
        className="anim-fade-in absolute inset-0"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <Command.Input
        autoFocus
        defaultValue={seed ?? undefined}
        placeholder="Type a tool name, tag, or category…"
        className="relative h-12 w-full border-b border-line bg-transparent pl-11 pr-4 text-[14px] text-ink placeholder:text-faint focus:outline-none"
      />
      <Search
        size={15}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint"
      />

      <Command.List className="max-h-[52vh] overflow-y-auto">
        <Command.Empty className="px-4 py-5 text-center">
          <p className="text-[12.5px] text-dim">No tool matches that yet.</p>
          <p className="mt-1 text-[11.5px] text-faint">
            Try a tag like “pdf”, “json”, or “image”.
          </p>
        </Command.Empty>

        {favoriteTools.length > 0 && (
          <Command.Group heading="Favorites" className="[&>[cmdk-group-heading]]:px-4 [&>[cmdk-group-heading]]:py-2 [&>[cmdk-group-heading]]:text-[10.5px] [&>[cmdk-group-heading]]:tracking-wide [&>[cmdk-group-heading]]:text-faint [&>[cmdk-group-heading]]:uppercase">
            {favoriteTools.map((tool) => (
              <PaletteRow key={`fav-${tool.id}`} tool={tool} onChoose={choose} isFavorite />
            ))}
          </Command.Group>
        )}

        <Command.Group heading="All tools" className="[&>[cmdk-group-heading]]:px-4 [&>[cmdk-group-heading]]:py-2 [&>[cmdk-group-heading]]:text-[10.5px] [&>[cmdk-group-heading]]:tracking-wide [&>[cmdk-group-heading]]:text-faint [&>[cmdk-group-heading]]:uppercase">
          {allTools.map((tool) => (
            <PaletteRow key={tool.id} tool={tool} onChoose={choose} isFavorite={favorites.includes(tool.id)} />
          ))}
        </Command.Group>
      </Command.List>

      <div className="border-t border-line px-4 py-2 text-[10.5px] text-faint">
        ↑↓ navigate · Enter open · Esc close
      </div>
    </Command.Dialog>
  )
}

function PaletteRow({
  tool,
  onChoose,
  isFavorite
}: {
  tool: ToolDefinition
  onChoose: (t: ToolDefinition) => void
  isFavorite: boolean
}) {
  const Icon = getIcon(tool.icon)
  const categoryLabel = getCategory(tool.category)?.label ?? tool.category
  return (
    <Command.Item
      value={`${tool.name} ${tool.tags.join(' ')} ${categoryLabel} ${tool.description}`}
      onSelect={() => onChoose(tool)}
      className="group flex cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 data-[selected=true]:bg-surface"
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
        <Star size={12} className="shrink-0 text-accent" fill="currentColor" aria-hidden />
      )}
    </Command.Item>
  )
}
