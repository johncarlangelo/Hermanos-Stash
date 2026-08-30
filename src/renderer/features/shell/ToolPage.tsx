import { Component, Suspense, useEffect, useMemo } from 'react'
import { ArrowLeft, Pin, Star } from 'lucide-react'
import { getCategory } from '../../../shared/constants/categories'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { getIcon } from '../../components/icons'
import { EmptyState, Spinner } from '../../components/ui/Feedback'
import { TagChip } from '../../components/ui/Inputs'
import { Button } from '../../components/ui/Button'
import { useLibrary } from '../../stores/library'
import { usePins } from '../../stores/pins'
import { useNav } from '../../stores/nav'
import { useWorkspace } from '../../stores/workspace'

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
  const pins = usePins((s) => s.pins)
  const togglePin = usePins((s) => s.togglePin)
  const pinsLoaded = usePins((s) => s.loaded)
  const workspaceWidth = useWorkspace((s) => s.width)

  const tool = useMemo(() => toolRegistry.get(toolId), [toolId])

  useEffect(() => {
    if (tool) void recordRecent(tool.id)
  }, [tool, recordRecent])

  if (!tool) {
    return (
      <div className="relative">
        <div className="relative mx-auto w-full max-w-3xl px-8 py-8">
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
    <div className="relative">
      <div
        className={`relative mx-auto w-full px-6 sm:px-8 py-8 transition-all duration-200 ${
          workspaceWidth === 'wide' ? 'max-w-6xl 2xl:max-w-7xl' : 'max-w-3xl'
        }`}
      >
        {/* Header — hero style with glowing icon badge */}
        <header className="mb-7">
          <button
            type="button"
            onClick={goHome}
            className="mb-3 flex cursor-pointer items-center gap-1 text-[10.5px] tracking-wide text-faint uppercase transition-colors duration-150 hover:text-dim"
          >
            <ArrowLeft size={11} />
            Workspace
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-raised shadow-[0_0_20px_-6px_var(--color-accent-glow)]"
                  aria-hidden
                >
                  <Icon size={21} strokeWidth={1.6} className="text-accent" />
                </span>
                <div className="min-w-0">
                  <h1 className="truncate text-[20px] font-semibold tracking-tight text-ink">
                    {tool.name}
                  </h1>
                  <p className="font-mono text-[10.5px] tracking-wide text-faint uppercase">
                    {category?.label ?? tool.category}
                  </p>
                </div>
              </div>
              <p className="mt-2.5 max-w-lg text-[12.5px] leading-relaxed text-dim">
                {tool.description}
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
            <div className="flex shrink-0 items-center gap-1.5">
              {pinsLoaded && (
                <button
                  type="button"
                  aria-label={
                    pins.includes(tool.id) ? `Unpin ${tool.name}` : `Pin ${tool.name} to the dock`
                  }
                  aria-pressed={pins.includes(tool.id)}
                  onClick={() => void togglePin(tool.id)}
                  title={pins.includes(tool.id) ? 'Unpin from dock' : 'Pin to dock'}
                  className={`cursor-pointer rounded-md border p-2 transition-all duration-150 ease-out ${
                    pins.includes(tool.id)
                      ? 'border-accent/50 bg-accent-soft text-accent hover:bg-accent-soft/70'
                      : 'border-line bg-surface/70 text-faint hover:border-line-strong hover:text-ink'
                  }`}
                >
                  <Pin size={15} fill={pins.includes(tool.id) ? 'currentColor' : 'none'} />
                </button>
              )}
              <button
                type="button"
                aria-label={
                  isFavorite
                    ? `Remove ${tool.name} from favorites`
                    : `Add ${tool.name} to favorites`
                }
                aria-pressed={isFavorite}
                onClick={() => void toggleFavorite(tool.id)}
                className={`cursor-pointer rounded-md border p-2 transition-all duration-150 ease-out ${
                  isFavorite
                    ? 'border-accent/50 bg-accent-soft text-accent shadow-[0_0_16px_-4px_var(--color-accent-glow)] hover:bg-accent-soft/70'
                    : 'border-line bg-surface/70 text-faint hover:border-line-strong hover:text-ink'
                }`}
              >
                <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
            </div>
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
