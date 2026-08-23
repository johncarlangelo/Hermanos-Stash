import { useEffect } from 'react'
import { House, Search, Settings, Star } from 'lucide-react'
import { CATEGORIES } from '../../../shared/constants/categories'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { CategoryId } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'
import { useLibrary } from '../../stores/library'
import { useNav } from '../../stores/nav'

function SidebarButton({
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
      className={`group flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors duration-150 ease-out ${
        active ? 'bg-surface text-ink' : 'text-dim hover:bg-surface/70 hover:text-ink'
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
      {count !== undefined && <span className="tnum shrink-0 text-[11px] text-faint">{count}</span>}
    </button>
  )
}

export function Sidebar() {
  const view = useNav((s) => s.view)
  const goHome = useNav((s) => s.goHome)
  const openCategory = useNav((s) => s.openCategory)
  const openTool = useNav((s) => s.openTool)
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

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col gap-4 overflow-y-auto bg-shell px-3 pb-4">
      {/* Draggable spacer above the brand (frameless window title area). */}
      <div className="app-drag h-5 shrink-1" aria-hidden />

      {/* Brand — clicking it navigates home. */}
      <button
        type="button"
        onClick={goHome}
        aria-label="Go to workspace home"
        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1 text-left transition-colors duration-150 hover:bg-surface"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-line-strong bg-surface">
          <span className="font-mono text-[13px] font-semibold text-accent">S</span>
        </div>
        <div>
          <p className="text-[13.5px] leading-tight font-semibold tracking-[0.04em] text-ink">
            STASH
          </p>
          <p className="text-[10.5px] leading-tight text-faint">local utility suite</p>
        </div>
      </button>

      {/* Search trigger */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="flex cursor-pointer items-center gap-2 rounded-md border border-line bg-base px-2.5 py-1.5 text-left transition-colors duration-150 ease-out hover:border-line-strong"
      >
        <Search size={13} className="text-faint" aria-hidden />
        <span className="flex-1 text-[12.5px] text-faint">Search tools…</span>
        <kbd className="rounded-xs border border-line bg-surface px-1 font-mono text-[10px] text-faint">
          Ctrl K
        </kbd>
      </button>

      {/* Home */}
      <nav aria-label="Navigation">
        <SidebarButton
          active={view.type === 'home' || view.type === 'category'}
          icon={<House size={14} />}
          label="Home"
          onClick={goHome}
        />
      </nav>

      {/* Favorites */}
      {favoriteTools.length > 0 && (
        <nav aria-label="Favorites">
          <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
            Favorites
          </p>
          <ul className="space-y-0.5">
            {favoriteTools.map((tool) => (
              <li key={tool.id} className="group relative">
                <SidebarButton
                  active={view.type === 'tool' && view.toolId === tool.id}
                  icon={<Star size={14} />}
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
                  className="absolute top-1/2 right-1 hidden -translate-y-1/2 cursor-pointer rounded-sm p-1 text-faint transition-colors duration-150 group-hover:block hover:text-dim"
                >
                  <Star size={12} fill="currentColor" />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Recent */}
      {recentTools.length > 0 && (
        <nav aria-label="Recent tools">
          <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
            Recent
          </p>
          <ul className="space-y-0.5">
            {recentTools.map((tool) => (
              <li key={tool.id}>
                <SidebarButton
                  active={view.type === 'tool' && view.toolId === tool.id}
                  icon={(() => {
                    const Icon = getIcon(tool.icon)
                    return <Icon size={14} />
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
        <p className="mb-1.5 px-2.5 text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
          Categories
        </p>
        <ul className="space-y-0.5">
          {CATEGORIES.map((category) => {
            const Icon = getIcon(category.icon)
            const count = toolRegistry.byCategory(category.id).length
            return (
              <li key={category.id}>
                <SidebarButton
                  active={view.type === 'category' && view.category === category.id}
                  icon={<Icon size={14} />}
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
      <nav aria-label="Application" className="border-t border-line pt-3">
        <SidebarButton
          active={view.type === 'settings'}
          icon={<Settings size={14} />}
          label="Settings"
          onClick={openSettings}
        />
      </nav>
    </aside>
  )
}
