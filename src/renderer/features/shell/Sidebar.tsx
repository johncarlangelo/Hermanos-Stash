import { useEffect } from 'react'
import { ChevronRight, Clock, House, Search, Settings, Star } from 'lucide-react'
import { CATEGORIES } from '../../../shared/constants/categories'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { CategoryId } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'
import { useLibrary } from '../../stores/library'
import { useNav } from '../../stores/nav'

/**
 * ui-overhaul sidebar — Hermes-grade density:
 * caps section headers with tiny muted glyphs, active item as a raised card
 * with an accent left edge, compact rows, mono tabular counts.
 */

function SectionLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold tracking-[0.1em] text-faint uppercase select-none">
      {icon && (
        <span className="text-faint/80" aria-hidden>
          {icon}
        </span>
      )}
      {children}
    </p>
  )
}

function SidebarRow({
  active,
  icon,
  label,
  count,
  onClick
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-[5px] pr-2 pl-2.5 text-left text-[12.5px] transition-all duration-150 ease-out ${
        active
          ? 'bg-raised/90 text-ink shadow-[inset_2px_0_0_var(--color-accent),0_0_20px_-8px_var(--color-accent-glow)]'
          : 'text-dim hover:bg-surface/60 hover:text-ink'
      }`}
    >
      <span
        className={`shrink-0 transition-colors duration-150 ${
          active ? 'text-accent' : 'text-faint group-hover:text-dim'
        }`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="tnum shrink-0 font-mono text-[10px] text-faint">{count}</span>
      )}
      {active && <ChevronRight size={11} className="shrink-0 text-faint" aria-hidden />}
    </button>
  )
}

export function Sidebar() {
  const view = useNav((s) => s.view)
  const goHome = useNav((s) => s.goHome)
  const openCategory = useNav((s) => s.openCategory)
  const openTool = useNav((s) => s.openTool)
  const openHistory = useNav((s) => s.openHistory)
  const openSettings = useNav((s) => s.openSettings)
  const setPaletteOpen = useNav((s) => s.setPaletteOpen)

  const favorites = useLibrary((s) => s.favorites)
  const recents = useLibrary((s) => s.recents)
  const toggleFavorite = useLibrary((s) => s.toggleFavorite)

  // Global shortcut: Ctrl/Cmd+K opens the command palette.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setPaletteOpen])

  const favoriteTools = favorites
    .map((id) => toolRegistry.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
  const recentTools = recents
    .map((r) => toolRegistry.get(r.toolId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  const toolCount = toolRegistry.count()

  return (
    <aside className="glass flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-line/60 px-2 pb-2">
      {/* Draggable spacer above the brand (frameless window title area). */}
      <div className="app-drag h-5 shrink-1" aria-hidden />

      {/* Brand — clicking it navigates home. */}
      <button
        type="button"
        onClick={goHome}
        aria-label="Go to workspace home"
        className="mb-3 flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1 text-left transition-colors duration-150 hover:bg-surface/60"
      >
        <div className="brand-glow flex h-6 w-6 items-center justify-center rounded-sm border border-accent/40 bg-raised">
          <span className="font-mono text-[12px] font-semibold text-accent">S</span>
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] leading-tight font-semibold tracking-[0.08em] text-ink">
            STASH
          </p>
          <p className="font-mono text-[9.5px] leading-tight tracking-wide text-faint">
            {toolCount} tools · local
          </p>
        </div>
      </button>

      {/* Search trigger */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="mb-3 flex cursor-pointer items-center gap-2 rounded-sm border border-line bg-base/60 px-2 py-1.5 text-left transition-all duration-150 ease-out hover:border-accent/40 hover:bg-surface/70 hover:shadow-[0_0_16px_-6px_var(--color-accent-glow)]"
      >
        <Search size={12} className="text-faint" aria-hidden />
        <span className="flex-1 text-[12px] text-faint">Search…</span>
        <kbd className="tnum rounded-xs border border-line bg-surface px-1 font-mono text-[9.5px] text-faint">
          Ctrl K
        </kbd>
      </button>

      <nav aria-label="Navigation" className="mb-3">
        <SectionLabel>Workspace</SectionLabel>
        <SidebarRow
          active={view.type === 'home' || view.type === 'category'}
          icon={<House size={13} />}
          label="Home"
          onClick={goHome}
        />
        <SidebarRow
          active={view.type === 'history'}
          icon={<Clock size={13} />}
          label="History"
          onClick={openHistory}
        />
      </nav>

      {/* Favorites */}
      {favoriteTools.length > 0 && (
        <nav aria-label="Favorites" className="mb-3">
          <SectionLabel icon={<Star size={9} />}>Favorites</SectionLabel>
          <ul className="space-y-px">
            {favoriteTools.map((tool) => (
              <li key={tool.id} className="group relative">
                <SidebarRow
                  active={view.type === 'tool' && view.toolId === tool.id}
                  icon={<Star size={13} />}
                  label={tool.name}
                  onClick={() => openTool(tool.id)}
                />
                <button
                  type="button"
                  aria-label={`Unfavorite ${tool.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    void toggleFavorite(tool.id)
                  }}
                  className="absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer rounded-xs p-1 text-faint opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-dim"
                >
                  <Star size={11} fill="currentColor" />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Recent */}
      {recentTools.length > 0 && (
        <nav aria-label="Recent tools" className="mb-3">
          <SectionLabel>Recent</SectionLabel>
          <ul className="space-y-px">
            {recentTools.map((tool) => (
              <li key={tool.id}>
                <SidebarRow
                  active={view.type === 'tool' && view.toolId === tool.id}
                  icon={(() => {
                    const Icon = getIcon(tool.icon)
                    return <Icon size={13} />
                  })()}
                  label={tool.name}
                  onClick={() => openTool(tool.id)}
                />
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Categories */}
      <nav aria-label="Categories" className="flex-1">
        <SectionLabel>Categories</SectionLabel>
        <ul className="space-y-px">
          {CATEGORIES.map((category) => {
            const Icon = getIcon(category.icon)
            const count = toolRegistry.byCategory(category.id).length
            return (
              <li key={category.id}>
                <SidebarRow
                  active={view.type === 'category' && view.category === category.id}
                  icon={<Icon size={13} />}
                  label={category.label}
                  count={count > 0 ? count : undefined}
                  onClick={() => openCategory(category.id as CategoryId)}
                />
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <nav aria-label="Application" className="mt-3 border-t border-line pt-2">
        <SidebarRow
          active={view.type === 'settings'}
          icon={<Settings size={13} />}
          label="Settings"
          onClick={openSettings}
        />
      </nav>
    </aside>
  )
}
