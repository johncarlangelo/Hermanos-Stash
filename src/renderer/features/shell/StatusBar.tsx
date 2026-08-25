import { useEffect, useState } from 'react'
import { CircleCheck, Loader2 } from 'lucide-react'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { useLibrary } from '../../stores/library'
import { useNav } from '../../stores/nav'

/**
 * ui-overhaul status bar — the dense mono strip that anchors the window.
 * Mirrors Hermes: tiny mono text, live dot, contextual info on the right.
 * Read-only; never interactive (it's a status surface, not a toolbar).
 */
export function StatusBar() {
  const view = useNav((s) => s.view)
  const favorites = useLibrary((s) => s.favorites)
  const recents = useLibrary((s) => s.recents)
  const [clock, setClock] = useState('')

  // Minute-ticking clock — quiet "the app is alive" signal, Hermes-style.
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    tick()
    const id = setInterval(tick, 15_000)
    return () => clearInterval(id)
  }, [])

  const context = (() => {
    switch (view.type) {
      case 'tool': {
        const tool = toolRegistry.get(view.toolId)
        return tool ? `${tool.name} · ${tool.category}` : view.toolId
      }
      case 'category':
        return `category · ${view.category}`
      case 'history':
        return view.toolId ? `history · ${view.toolId}` : 'history'
      case 'settings':
        return 'settings'
      default:
        return 'workspace'
    }
  })()

  return (
    <footer
      className="flex h-6 shrink-0 items-center gap-3 border-t border-line bg-shell px-3 font-mono text-[10px] tracking-wide text-faint select-none"
      aria-hidden
    >
      <span className="flex items-center gap-1.5">
        <CircleCheck size={9} className="text-ok/70" />
        <span className="tnum">{toolRegistry.count()} tools</span>
      </span>
      <span className="text-line-strong">│</span>
      <span className="tnum">{favorites.length} fav</span>
      <span className="text-line-strong">│</span>
      <span className="tnum">{recents.length} recent</span>
      <span className="ml-auto flex items-center gap-1.5">
        <span className="tnum">{context}</span>
        <span className="text-line-strong">│</span>
        <Loader2 size={9} className="animate-spin text-faint/60" />
        <span className="tnum">{clock}</span>
      </span>
    </footer>
  )
}
