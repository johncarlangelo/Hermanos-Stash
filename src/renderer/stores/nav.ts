import { create } from 'zustand'
import { TOOL_COMPONENTS } from '../tools'
import { useLibrary } from './library'
import type { CategoryId } from '../../shared/types/tool'

export type View =
  | { type: 'home' }
  | { type: 'category'; category: CategoryId }
  | { type: 'tool'; toolId: string }
  | { type: 'history'; toolId?: string }
  | { type: 'settings' }
  | { type: 'queue'; presetId?: string }
  | { type: 'insights' }
  | { type: 'gallery'; filterType?: string }

interface NavState {
  view: View
  paletteOpen: boolean
  /** Query to seed the command palette with on next open (consumed once). */
  paletteSeedQuery: string | null
  goHome: () => void
  openCategory: (category: CategoryId) => void
  openTool: (toolId: string) => void
  /** Open a tool without leaving the current view (pre-warms chunk, records recent). */
  openToolInBackground: (toolId: string) => void
  openHistory: (toolId?: string) => void
  openSettings: () => void
  openQueue: (presetId?: string) => void
  openInsights: () => void
  openGallery: (filterType?: string) => void
  setPaletteOpen: (open: boolean, seedQuery?: string) => void
}

/** Single-window navigation state — tools never spawn new windows. */
export const useNav = create<NavState>((set) => ({
  view: { type: 'home' },
  paletteOpen: false,
  paletteSeedQuery: null,
  goHome: () => set({ view: { type: 'home' } }),
  openCategory: (category) => set({ view: { type: 'category', category }, paletteOpen: false }),
  openTool: (toolId) => set({ view: { type: 'tool', toolId }, paletteOpen: false }),
  openToolInBackground: (toolId) => {
    // Pre-warm the tool's lazy chunk and record the recent without leaving
    // the current view. The palette closes; the workspace stays put.
    const componentEntry = TOOL_COMPONENTS[toolId]
    if (componentEntry) void (componentEntry as { preload?: () => Promise<unknown> }).preload?.()
    useLibrary
      .getState()
      .recordRecent(toolId)
      .catch(() => {})
    set({ paletteOpen: false })
  },
  openHistory: (toolId?: string) =>
    set({
      // Guard: a click handler passed straight through would smuggle in the
      // DOM event as toolId, and a non-serializable view breaks JSON.stringify.
      view: { type: 'history', toolId: typeof toolId === 'string' ? toolId : undefined },
      paletteOpen: false
    }),
  openSettings: () => set({ view: { type: 'settings' }, paletteOpen: false }),
  openQueue: (presetId?: string) => set({ view: { type: 'queue', presetId }, paletteOpen: false }),
  openInsights: () => set({ view: { type: 'insights' }, paletteOpen: false }),
  openGallery: (filterType?: string) =>
    set({
      view: {
        type: 'gallery',
        filterType: typeof filterType === 'string' ? filterType : undefined
      },
      paletteOpen: false
    }),
  setPaletteOpen: (paletteOpen, seedQuery) =>
    set((state) => ({
      paletteOpen,
      paletteSeedQuery: paletteOpen ? (seedQuery ?? null) : null,
      view: state.view
    }))
}))
