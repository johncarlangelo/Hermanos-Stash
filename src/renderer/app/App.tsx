import { useEffect } from 'react'
import { ChevronRight, House } from 'lucide-react'
import { Sidebar } from '../features/shell/Sidebar'
import { CommandPalette } from '../features/shell/CommandPalette'
import { HomeView } from '../features/shell/HomeView'
import { ToolPage } from '../features/shell/ToolPage'
import { SettingsView } from '../features/shell/SettingsView'
import { ToastViewport } from '../components/ToastViewport'
import { getIcon } from '../components/icons'
import { toolRegistry } from '../../shared/tool-registry/registry'
import { useLibrary } from '../stores/library'
import { useNav } from '../stores/nav'

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
  } else if (view.type === 'settings') {
    segments.push({ label: 'Settings' })
  }

  return (
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
  )
}

export default function App() {
  const view = useNav((s) => s.view)
  const loadLibrary = useLibrary((s) => s.load)

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Draggable titlebar row; the right edge stays clear for native controls. */}
        <header className="app-drag flex h-10 shrink-0 items-center border-b border-line bg-shell pr-[140px] pl-4">
          <div className="app-no-drag min-w-0">
            <Breadcrumb />
          </div>
        </header>
        <div className="min-w-0 flex-1 overflow-y-auto" data-view={view.type}>
          {view.type === 'home' && <HomeView />}
          {view.type === 'category' && <HomeView />}
          {view.type === 'tool' && <ToolPage toolId={view.toolId} />}
          {view.type === 'settings' && <SettingsView />}
        </div>
      </main>
      <CommandPalette />
      <ToastViewport />
    </div>
  )
}
