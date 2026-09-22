import { useCallback, useEffect } from 'react'
import {
  BarChart3,
  ChevronRight,
  Columns2,
  FolderArchive,
  House,
  Layers,
  PanelLeft
} from 'lucide-react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { Sidebar } from '../features/shell/Sidebar'
import { StatusBar } from '../features/shell/StatusBar'
import { Wordmark } from '../components/Wordmark'
import { CommandPalette } from '../features/shell/CommandPalette'
import { HomeView } from '../features/shell/HomeView'
import { ToolPage } from '../features/shell/ToolPage'
import { DualToolWorkspace } from '../features/shell/DualToolWorkspace'
import { SettingsView } from '../features/shell/SettingsView'
import { HistoryView } from '../features/shell/HistoryView'
import { QueueView } from '../features/shell/QueueView'
import { UsageDashboard } from '../features/shell/UsageDashboard'
import { GalleryView } from '../features/gallery/GalleryView'
import { DropRouter } from '../features/shell/DropRouter'
import { QuickSwitch } from '../features/shell/QuickSwitch'
import { ChatbotWidget } from '../features/chatbot/ChatbotWidget'
import { Toaster } from '../components/ui/Toaster'
import { RootErrorBoundary } from '../components/RootErrorBoundary'
import { getIcon } from '../components/icons'
import { toolRegistry } from '../../shared/tool-registry/registry'
import { useLibrary } from '../stores/library'
import { useNav } from '../stores/nav'
import { useWorkspace } from '../stores/workspace'

function Breadcrumb() {
  const view = useNav((s) => s.view)
  const goHome = useNav((s) => s.goHome)

  const segments: Array<{ label: string; onClick?: () => void; icon?: React.ReactNode }> = [
    {
      label: 'Workspace',
      icon: <House size={12} />,
      onClick: view.type === 'home' ? undefined : goHome
    }
  ]

  if (view.type === 'category') {
    segments.push({ label: 'Category' })
  } else if (view.type === 'tool') {
    const tool = toolRegistry.get(view.toolId)
    if (tool) {
      const Icon = getIcon(tool.icon)
      segments.push({ label: tool.name, icon: <Icon size={12} /> })
    }
  } else if (view.type === 'history') {
    segments.push({ label: 'History' })
  } else if (view.type === 'settings') {
    segments.push({ label: 'Settings' })
  } else if (view.type === 'queue') {
    segments.push({ label: 'Queue', icon: <Layers size={12} /> })
  } else if (view.type === 'insights') {
    segments.push({ label: 'Insights', icon: <BarChart3 size={12} /> })
  } else if (view.type === 'gallery') {
    segments.push({ label: 'Asset Stash', icon: <FolderArchive size={12} /> })
  }

  const sidebarCollapsed = useWorkspace((s) => s.sidebarCollapsed)
  const toggleSidebar = useWorkspace((s) => s.toggleSidebar)

  return (
    <div className="flex min-w-0 items-center gap-1">
      {sidebarCollapsed && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="mr-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-line bg-surface/70 text-dim transition-colors hover:border-accent hover:text-ink shrink-0"
          title="Expand sidebar (Ctrl+B)"
          aria-label="Expand sidebar"
        >
          <PanelLeft size={13} />
        </button>
      )}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1">
        {segments.map((segment, index) => (
          <span key={segment.label} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight size={11} className="shrink-0 text-faint" aria-hidden />}
            {segment.onClick ? (
              <button
                type="button"
                onClick={segment.onClick}
                className="flex cursor-pointer items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[11.5px] text-dim transition-colors duration-150 hover:bg-surface hover:text-ink"
              >
                {segment.icon}
                {segment.label}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-1.5 text-[11.5px] text-faint">
                {segment.icon}
                <span className="truncate">{segment.label}</span>
              </span>
            )}
          </span>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  const view = useNav((s) => s.view)
  const splitMode = useWorkspace((s) => s.splitMode)
  const loadLibrary = useLibrary((s) => s.load)
  const loadWorkspace = useWorkspace((s) => s.load)

  useEffect(() => {
    void loadLibrary()
    void loadWorkspace()
  }, [loadLibrary, loadWorkspace])

  const handleToggleSplit = useCallback(() => {
    const nav = useNav.getState()
    if (nav.view.type === 'tool') {
      useWorkspace.getState().toggleSplitMode()
    } else {
      const { recents } = useLibrary.getState()
      const primary = recents[0]?.toolId ?? 'json-format'
      useWorkspace.getState().setSplitMode(true)
      nav.openTool(primary)
    }
  }, [])

  // Global shortcuts: Esc returns Home; Ctrl/Cmd+1..5 open favorites; Ctrl/Cmd+\ toggles split screen.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      if (typing) return

      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault()
        handleToggleSplit()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        useWorkspace.getState().toggleSidebar()
        return
      }

      if ((e.ctrlKey || e.metaKey) && /^[1-5]$/.test(e.key)) {
        const { favorites, loaded } = useLibrary.getState()
        if (!loaded) return
        const toolId = favorites[Number(e.key) - 1]
        if (toolId) {
          e.preventDefault()
          useNav.getState().openTool(toolId)
        }
        return
      }

      if (e.key === 'Escape') {
        const { paletteOpen } = useNav.getState()
        if (paletteOpen) return // palette handles its own dismissal
        const current = useNav.getState().view
        if (current.type !== 'home') {
          e.preventDefault()
          useNav.getState().goHome()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleToggleSplit])

  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={300}>
      {/* Giant HERMANOS — fixed to the window, behind every view, never scrolls. */}
      <Wordmark />
      <RootErrorBoundary>
        <div className="flex h-full w-full overflow-hidden">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Draggable titlebar row. Sizing follows the native Windows
            controls overlay via env(titlebar-area-*) so it adapts when zoom
            resizes the overlay; fallbacks match the 110% default. */}
            <header
              className="app-drag flex shrink-0 items-center justify-between border-b border-line bg-shell"
              style={{
                height: 'env(titlebar-area-height, 44px)',
                paddingRight: 'calc(100% - env(titlebar-area-width, calc(100% - 154px)))',
                paddingLeft: 'env(titlebar-area-x, 16px)'
              }}
            >
              <div className="app-no-drag min-w-0">
                <Breadcrumb />
              </div>
              <div className="app-no-drag flex items-center pr-2">
                <button
                  type="button"
                  onClick={handleToggleSplit}
                  aria-label={splitMode ? 'Close split screen' : 'Split screen workspace'}
                  title={
                    splitMode
                      ? 'Close split screen (Ctrl+\\)'
                      : 'Open split screen dual tool (Ctrl+\\)'
                  }
                  className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-all ${
                    splitMode
                      ? 'border-accent/60 bg-accent-soft text-accent shadow-[0_0_12px_-3px_var(--color-accent-glow)]'
                      : 'border-line bg-surface/60 text-dim hover:border-line-strong hover:bg-surface hover:text-ink'
                  }`}
                >
                  <Columns2 size={12} />
                  <span>{splitMode ? 'Split Active' : 'Split View'}</span>
                </button>
              </div>
            </header>
            <div
              key={view.type === 'tool' && splitMode ? 'split-tool-mode' : JSON.stringify(view)}
              className={`view-enter relative min-w-0 flex-1 ${
                (view.type === 'tool' && splitMode) || view.type === 'queue'
                  ? 'overflow-hidden h-full flex flex-col'
                  : 'overflow-y-auto'
              }`}
              data-view={view.type}
            >
              {view.type === 'home' && <HomeView />}
              {view.type === 'category' && <HomeView />}
              {view.type === 'tool' &&
                (splitMode ? (
                  <DualToolWorkspace primaryToolId={view.toolId} />
                ) : (
                  <ToolPage toolId={view.toolId} />
                ))}
              {view.type === 'history' && (
                <HistoryView key={view.toolId ?? 'all'} seedToolId={view.toolId} />
              )}
              {view.type === 'settings' && <SettingsView />}
              {view.type === 'queue' && <QueueView />}
              {view.type === 'insights' && <UsageDashboard />}
              {view.type === 'gallery' && <GalleryView initialFilter={view.filterType} />}
            </div>
          </main>
          <CommandPalette />
          <DropRouter />
          <QuickSwitch />
          <ChatbotWidget />
          <Toaster />
        </div>
        <StatusBar />
      </RootErrorBoundary>
    </TooltipPrimitive.Provider>
  )
}
