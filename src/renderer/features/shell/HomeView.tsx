import { Star } from 'lucide-react'
import { getCategory } from '../../../shared/constants/categories'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { CategoryId, ToolDefinition } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'
import { EmptyState, SectionHeading } from '../../components/ui/Feedback'
import { useLibrary } from '../../stores/library'
import { useNav } from '../../stores/nav'

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const openTool = useNav((s) => s.openTool)
  const Icon = getIcon(tool.icon)
  return (
    <button
      type="button"
      onClick={() => openTool(tool.id)}
      className="group flex cursor-pointer items-start gap-3 rounded-md border border-line bg-surface px-3.5 py-3 text-left transition-all duration-150 ease-out hover:-translate-y-px hover:border-line-strong hover:bg-raised"
    >
      <Icon
        size={17}
        strokeWidth={1.6}
        className="mt-0.5 shrink-0 text-faint transition-colors duration-150 group-hover:text-accent"
        aria-hidden
      />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-ink">{tool.name}</span>
        <span className="mt-0.5 block truncate text-[11.5px] leading-snug text-dim">
          {tool.description}
        </span>
      </span>
    </button>
  )
}

export function HomeView() {
  const view = useNav((s) => s.view)
  const goHome = useNav((s) => s.goHome)
  const favorites = useLibrary((s) => s.favorites)
  const recents = useLibrary((s) => s.recents)

  const activeCategory: CategoryId | null =
    view.type === 'category' ? (view.category as CategoryId) : null

  const categoryMeta = activeCategory ? getCategory(activeCategory) : undefined
  const tools = activeCategory ? toolRegistry.byCategory(activeCategory) : []
  const allTools = toolRegistry.all()

  const favoriteTools = favorites
    .map((id) => toolRegistry.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
  const recentTools = recents
    .map((r) => toolRegistry.get(r.toolId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-8">
      {/* Header */}
      <div className="mb-7">
        {activeCategory ? (
          <>
            <button
              type="button"
              onClick={goHome}
              className="mb-1 cursor-pointer text-[11.5px] text-faint transition-colors duration-150 hover:text-dim"
            >
              All categories
            </button>
            <h1 className="text-[19px] font-semibold tracking-tight text-ink">
              {categoryMeta?.label}
            </h1>
            <p className="mt-0.5 text-[12.5px] text-dim">{categoryMeta?.description}</p>
          </>
        ) : (
          <>
            <h1 className="text-[19px] font-semibold tracking-tight text-ink">Workspace</h1>
            <p className="mt-0.5 max-w-md text-[12.5px] leading-relaxed text-dim">
              Pick a tool below, or press{' '}
              <kbd className="rounded-xs border border-line bg-surface px-1 font-mono text-[10.5px] text-dim">
                Ctrl K
              </kbd>{' '}
              to search everything.
            </p>
          </>
        )}
      </div>

      {/* Category-filtered list */}
      {activeCategory && (
        <section aria-label={`Tools in ${categoryMeta?.label}`}>
          {tools.length === 0 ? (
            <EmptyState
              icon={categoryMeta?.icon}
              title={`Nothing in ${categoryMeta?.label} yet.`}
              hint="This area fills up as new tools land. Check another category or search the full catalog."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Full home */}
      {!activeCategory && (
        <div className="space-y-8">
          {favoriteTools.length > 0 && (
            <section aria-label="Favorite tools">
              <SectionHeading>Favorites</SectionHeading>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {favoriteTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          )}

          {recentTools.length > 0 && (
            <section aria-label="Recently used tools">
              <SectionHeading>Recent</SectionHeading>
              <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                {recentTools.map((tool) => (
                  <RecentLink key={tool.id} tool={tool} />
                ))}
              </ul>
            </section>
          )}

          <section aria-label="All tools by category">
            <SectionHeading>Browse</SectionHeading>
            {allTools.length === 0 ? (
              <EmptyState
                icon="folder"
                title="No tools are registered yet."
                hint="The tool catalog is empty in this build. Tools appear here automatically once registered."
              />
            ) : (
              <div className="mt-2.5 space-y-5">
                {toolRegistry
                  .categoriesWithCounts()
                  .filter((c) => c.count > 0)
                  .map((category) => {
                    const Icon = getIcon(category.icon)
                    return (
                      <CategoryGroup
                        key={category.id}
                        id={category.id}
                        label={category.label}
                        icon={<Icon size={14} />}
                      />
                    )
                  })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function RecentLink({ tool }: { tool: ToolDefinition }) {
  const openTool = useNav((s) => s.openTool)
  const Icon = getIcon(tool.icon)
  return (
    <li>
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
}

export function CategoryGroup({
  id,
  label,
  icon,
  limit = 4
}: {
  id: CategoryId
  label: string
  icon?: React.ReactNode
  limit?: number
}) {
  const openCategory = useNav((s) => s.openCategory)
  const toggleFavorite = useLibrary((s) => s.toggleFavorite)
  const favorites = useLibrary((s) => s.favorites)
  const tools = toolRegistry.byCategory(id)

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-[12.5px] font-medium text-dim [&_svg]:text-faint">
          {icon}
          {label}
        </h3>
        <button
          type="button"
          onClick={() => openCategory(id)}
          className="cursor-pointer text-[11.5px] text-faint transition-colors duration-150 hover:text-dim"
        >
          View all ({tools.length})
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tools.slice(0, limit).map((tool) => (
          <ToolRow key={tool.id} tool={tool}>
            <StarButton
              active={favorites.includes(tool.id)}
              onClick={() => void toggleFavorite(tool.id)}
              name={tool.name}
            />
          </ToolRow>
        ))}
      </div>
    </div>
  )
}

function ToolRow({ tool, children }: { tool: ToolDefinition; children?: React.ReactNode }) {
  const openTool = useNav((s) => s.openTool)
  const Icon = getIcon(tool.icon)
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => openTool(tool.id)}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-md border border-line bg-surface px-3 py-2 text-left transition-colors duration-150 ease-out hover:border-line-strong hover:bg-raised"
      >
        <Icon size={15} strokeWidth={1.6} className="shrink-0 text-faint" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{tool.name}</span>
      </button>
      {children && (
        <div className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 group-hover:block">
          {children}
        </div>
      )}
    </div>
  )
}

function StarButton({
  active,
  onClick,
  name
}: {
  active: boolean
  onClick: () => void
  name: string
}) {
  return (
    <button
      type="button"
      aria-label={active ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`cursor-pointer rounded-sm p-1 transition-colors duration-150 ${
        active ? 'text-accent' : 'bg-surface text-faint hover:text-ink'
      }`}
    >
      <Star size={13} fill={active ? 'currentColor' : 'none'} />
    </button>
  )
}
