import { useMemo, useState } from 'react'
import { House, Star } from 'lucide-react'
import { CATEGORIES, getCategory } from '../../../shared/constants/categories'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { CategoryId, ToolDefinition } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'
import { EmptyState, SectionHeading } from '../../components/ui/Feedback'
import { useLibrary } from '../../stores/library'
import { useNav } from '../../stores/nav'

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const openTool = useNav((s) => s.openTool)
  const toggleFavorite = useLibrary((s) => s.toggleFavorite)
  const isFavorite = useLibrary((s) => s.favorites.includes(tool.id))
  const Icon = getIcon(tool.icon)
  const categoryLabel = getCategory(tool.category)?.label

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => openTool(tool.id)}
        aria-label={`Open ${tool.name}`}
        className="glow-hover flex h-full w-full cursor-pointer flex-col items-start gap-2.5 rounded-md border border-line bg-surface/70 px-4 py-3.5 text-left backdrop-blur-sm hover:-translate-y-0.5"
      >
        {/* Icon with accent halo */}
        <span className="relative flex h-9 w-9 items-center justify-center rounded-sm border border-line bg-raised/80 transition-colors duration-200 group-hover:border-accent/50">
          <span
            aria-hidden
            className="absolute inset-0 rounded-sm bg-accent/0 transition-colors duration-200 group-hover:bg-accent/10"
          />
          <Icon
            size={17}
            strokeWidth={1.6}
            className="relative text-dim transition-colors duration-200 group-hover:text-accent"
            aria-hidden
          />
        </span>
        <span className="text-[13px] font-medium text-ink">{tool.name}</span>
        <span className="line-clamp-2 min-h-[2.2em] text-[11.5px] leading-relaxed text-dim">
          {tool.description}
        </span>
        <span className="mt-auto flex items-center gap-1 pt-0.5">
          {tool.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-xs border border-line px-1 py-px font-mono text-[9.5px] tracking-wide text-faint uppercase"
            >
              {tag}
            </span>
          ))}
          {categoryLabel && (
            <span className="ml-auto hidden pl-1 text-[10px] text-faint group-hover:inline">
              {categoryLabel}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        aria-label={
          isFavorite ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`
        }
        aria-pressed={isFavorite}
        onClick={(e) => {
          e.stopPropagation()
          void toggleFavorite(tool.id)
        }}
        className={`absolute top-2.5 right-2.5 cursor-pointer rounded-sm p-1 transition-all duration-150 ${
          isFavorite
            ? 'text-accent opacity-100 drop-shadow-[0_0_6px_var(--color-accent-glow)]'
            : 'text-faint opacity-60 group-hover:opacity-100 hover:text-ink focus-visible:opacity-100'
        }`}
      >
        <Star size={13} fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}

function CategoryFilterChips({
  active,
  onSelect
}: {
  active: CategoryId | 'all'
  onSelect: (id: CategoryId | 'all') => void
}) {
  const counts = useMemo(() => {
    const map = new Map<CategoryId, number>()
    for (const category of CATEGORIES) {
      map.set(category.id, toolRegistry.byCategory(category.id).length)
    }
    return map
  }, [])

  return (
    <div role="tablist" aria-label="Filter tools by category" className="flex flex-wrap gap-1.5">
      <button
        role="tab"
        aria-selected={active === 'all'}
        type="button"
        onClick={() => onSelect('all')}
        className={`cursor-pointer rounded-full border px-3 py-1 text-[11.5px] transition-colors duration-150 ease-out ${
          active === 'all'
            ? 'border-accent/60 bg-accent-soft text-accent'
            : 'border-line text-dim hover:border-line-strong hover:text-ink'
        }`}
      >
        All tools
        <span className="tnum ml-1.5 text-faint">{toolRegistry.count()}</span>
      </button>
      {CATEGORIES.filter((c) => (counts.get(c.id) ?? 0) > 0).map((category) => {
        const isActive = active === category.id
        return (
          <button
            key={category.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onSelect(isActive ? 'all' : category.id)}
            className={`cursor-pointer rounded-full border px-3 py-1 text-[11.5px] transition-colors duration-150 ease-out ${
              isActive
                ? 'border-accent/60 bg-accent-soft text-accent'
                : 'border-line text-dim hover:border-line-strong hover:text-ink'
            }`}
          >
            {category.label}
            <span className="tnum ml-1.5 text-faint">{counts.get(category.id)}</span>
          </button>
        )
      })}
    </div>
  )
}

function RecentStrip({ tools }: { tools: ToolDefinition[] }) {
  const openTool = useNav((s) => s.openTool)
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {tools.map((tool) => {
        const Icon = getIcon(tool.icon)
        return (
          <li key={tool.id}>
            <button
              type="button"
              onClick={() => openTool(tool.id)}
              className="group flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-[12.5px] text-dim transition-colors duration-150 ease-out hover:text-ink"
            >
              <Icon size={13} strokeWidth={1.75} className="shrink-0" aria-hidden />
              <span className="underline-offset-2 group-hover:underline">{tool.name}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function HomeView() {
  const view = useNav((s) => s.view)
  const goHome = useNav((s) => s.goHome)
  const favorites = useLibrary((s) => s.favorites)
  const recents = useLibrary((s) => s.recents)

  // The route can force a category (sidebar); local chip state refines it.
  const [chipFilter, setChipFilter] = useState<CategoryId | 'all'>('all')
  const routeCategory: CategoryId | null =
    view.type === 'category' ? (view.category as CategoryId) : null
  const effectiveFilter: CategoryId | 'all' = routeCategory ?? chipFilter

  const allTools = toolRegistry.all()
  const favoriteTools = favorites
    .map((id) => toolRegistry.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
  const recentTools = recents
    .map((r) => toolRegistry.get(r.toolId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  const visibleTools =
    effectiveFilter === 'all' ? allTools : toolRegistry.byCategory(effectiveFilter)

  const grouped =
    effectiveFilter === 'all'
      ? CATEGORIES.map((c) => ({
          meta: c,
          tools: visibleTools.filter((t) => t.category === c.id)
        })).filter((g) => g.tools.length > 0)
      : []

  return (
    <div className="mx-auto w-full max-w-4xl px-8 py-7">
      {/* Header — compact, Hermes-style with inline kbd affordance */}
      <div className="mb-5 flex items-end justify-between gap-4">
        {routeCategory ? (
          <div className="min-w-0">
            <button
              type="button"
              onClick={goHome}
              className="mb-0.5 flex cursor-pointer items-center gap-1 text-[10.5px] tracking-wide text-faint uppercase transition-colors duration-150 hover:text-dim"
            >
              <House size={10} />
              All categories
            </button>
            <h1 className="text-[17px] font-semibold tracking-tight text-ink">
              {getCategory(routeCategory)?.label}
            </h1>
            <p className="mt-0.5 text-[12px] text-dim">{getCategory(routeCategory)?.description}</p>
          </div>
        ) : (
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-ink via-ink to-accent bg-clip-text text-transparent">
                Workspace
              </span>
            </h1>
            <p className="mt-1 text-[12.5px] text-dim">
              Pick a tool, or{' '}
              <kbd className="tnum rounded-xs border border-line bg-surface px-1 font-mono text-[10px] text-dim">
                Ctrl K
              </kbd>{' '}
              to search everything.
            </p>
          </div>
        )}
        <p className="tnum shrink-0 font-mono text-[10px] tracking-wide text-faint">
          {visibleTools.length} / {toolRegistry.count()} tools
        </p>
      </div>

      {!routeCategory && favoriteTools.length > 0 && (
        <section aria-label="Favorite tools" className="mb-7">
          <SectionHeading>Favorites</SectionHeading>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteTools.slice(0, 6).map((tool) => (
              <ToolCard key={`fav-${tool.id}`} tool={tool} />
            ))}
          </div>
        </section>
      )}

      {!routeCategory && recentTools.length > 0 && (
        <section aria-label="Recently used tools" className="mb-7">
          <SectionHeading>Recent</SectionHeading>
          <div className="mt-2">
            <RecentStrip tools={recentTools} />
          </div>
        </section>
      )}

      {/* Tools as cards */}
      <section aria-label="Tool catalog">
        {!routeCategory && <SectionHeading>Browse</SectionHeading>}
        {!routeCategory && (
          <div className="mt-2.5 mb-4">
            <CategoryFilterChips active={effectiveFilter} onSelect={setChipFilter} />
          </div>
        )}

        {visibleTools.length === 0 ? (
          <EmptyState
            icon={effectiveFilter !== 'all' ? getCategory(effectiveFilter)?.icon : undefined}
            title={
              routeCategory
                ? `Nothing in ${getCategory(routeCategory)?.label} yet.`
                : 'No tools are registered yet.'
            }
            hint={
              routeCategory
                ? 'This area fills up as new tools land. Check another category or search the full catalog.'
                : 'The tool catalog is empty in this build. Tools appear here automatically once registered.'
            }
          />
        ) : grouped.length > 0 ? (
          <div className="space-y-6">
            {grouped.map(({ meta, tools }) => (
              <div key={meta.id}>
                <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">
                  {meta.label}
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </section>

      {/* Route-category escape hatch back to chip browsing */}
      {routeCategory && (
        <p className="mt-8 text-center text-[11.5px] text-faint">
          Looking for something else?{' '}
          <button
            type="button"
            onClick={goHome}
            className="cursor-pointer text-dim underline underline-offset-2 transition-colors duration-150 hover:text-ink"
          >
            Back to all tools
          </button>
        </p>
      )}
    </div>
  )
}
