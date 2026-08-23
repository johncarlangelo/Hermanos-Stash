import { useEffect } from 'react'
import { Sidebar } from '../features/shell/Sidebar'
import { CommandPalette } from '../features/shell/CommandPalette'
import { HomeView } from '../features/shell/HomeView'
import { ToolPage } from '../features/shell/ToolPage'
import { SettingsView } from '../features/shell/SettingsView'
import { ToastViewport } from '../components/ToastViewport'
import { useLibrary } from '../stores/library'
import { useNav } from '../stores/nav'

export default function App() {
  const view = useNav((s) => s.view)
  const loadLibrary = useLibrary((s) => s.load)

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto" data-view={view.type}>
        {view.type === 'home' && <HomeView />}
        {view.type === 'category' && <HomeView />}
        {view.type === 'tool' && <ToolPage toolId={view.toolId} />}
        {view.type === 'settings' && <SettingsView />}
      </main>
      <CommandPalette />
      <ToastViewport />
    </div>
  )
}
