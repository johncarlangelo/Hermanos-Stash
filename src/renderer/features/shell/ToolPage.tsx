import { Component, Suspense, useEffect, useMemo } from 'react'
import { ArrowLeft, Star } from 'lucide-react'
import { getCategory } from '../../../shared/constants/categories'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { getIcon } from '../../components/icons'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { TagChip } from '../../components/ui/Inputs'
import { Button } from '../../components/ui/Button'
import { useLibrary } from '../../stores/library'
import { useNav } from '../../stores/nav'

/**
 * Tool component map. Each tool contributes a lazily-loaded view; the shell
 * never imports tool implementations directly (ARCHITECTURE.md).
 */
import { TOOL_COMPONENTS } from '../../tools'

function Fallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner label="Loading tool" />
    </div>
  )
}

export function ToolPage({ toolId }: { toolId: string }) {
  const goHome = useNav((s) => s.goHome)
  const openHistory = useNav((s) => s.openHistory)
  const setPaletteOpen = useNav((s) => s.setPaletteOpen)
  const toggleFavorite = useLibrary((s) => s.toggleFavorite)
  const favorites = useLibrary((s) => s.favorites)
  const recordRecent = useLibrary((s) => s.recordRecent)

  const tool = useMemo(() => toolRegistry.get(toolId), [toolId])

  useEffect(() => {
    if (tool) void recordRecent(tool.id)
  }, [tool, recordRecent])

  if (!tool) {
    return (
      <div className="mx-auto max-w-xl px-8 py-12">
        <EmptyState
          icon="alert"
          title={`“${toolId}” isn't a registered tool.`}
          hint="It may have been renamed or removed. Head back to the workspace to browse what's available."
          action={
            <Button variant="secondary" size="sm" onClick={goHome}>
              Back to workspace
            </Button>
          }
        />
      </div>
    )
  }

  const Icon = getIcon(tool.icon)
  const category = getCategory(tool.category)
  const isFavorite = favorites.includes(tool.id)

  let Body: React.ComponentType | null = null
  const entry = TOOL_COMPONENTS[tool.id]
  if (entry) {
    Body = entry as React.ComponentType
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-8">
      {/* Header */}
      <header className="mb-6">
        <button
          type="button"
          onClick={goHome}
          className="mb-2 flex cursor-pointer items-center gap-1 text-[11.5px] text-faint transition-colors duration-150 hover:text-dim"
        >
          <ArrowLeft size={12} />
          Workspace
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-[19px] font-semibold tracking-tight text-ink">
              <Icon size={19} strokeWidth={1.6} className="shrink-0 text-accent" aria-hidden />
              <span className="truncate">{tool.name}</span>
            </h1>
            <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-dim">
              {tool.description}
              {category && <span className="text-faint"> · {category.label}</span>}
            </p>
            {tool.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tool.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setPaletteOpen(true, tag)}
                    aria-label={`Search tools tagged ${tag}`}
                    title={`Search tools tagged "${tag}"`}
                    className="cursor-pointer"
                  >
                    <TagChip tag={tag} />
                  </button>
                ))}
              </div>
            )}
            {tool.capabilities.acceptsFiles && (
              <button
                type="button"
                onClick={() => openHistory(tool.id)}
                className="mt-2 cursor-pointer text-[11.5px] text-faint underline underline-offset-2 transition-colors duration-150 hover:text-dim"
              >
                History for this tool
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label={
              isFavorite ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`
            }
            aria-pressed={isFavorite}
            onClick={() => void toggleFavorite(tool.id)}
            className={`shrink-0 cursor-pointer rounded-md border p-2 transition-colors duration-150 ease-out ${
              isFavorite
                ? 'border-accent/50 bg-accent-soft text-accent hover:bg-accent-soft/70'
                : 'border-line bg-surface text-faint hover:border-line-strong hover:text-ink'
            }`}
          >
            <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </header>

      {/* Tool body */}
      {Body ? (
        <ToolErrorBoundary>
          <Suspense fallback={<Fallback />}>
            <Body />
          </Suspense>
        </ToolErrorBoundary>
      ) : (
        <EmptyState
          icon="clock"
          title="This tool is registered but its interface hasn't shipped yet."
          hint="The catalog entry exists so search and categories stay accurate while implementation lands."
        />
      )}
    </div>
  )
}

class ToolErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <EmptyState
          icon="alert"
          title="This tool hit an unexpected error."
          hint="Try reopening it from the workspace. If it keeps failing, the issue is worth reporting."
        />
      )
    }
    return this.props.children
  }
}
