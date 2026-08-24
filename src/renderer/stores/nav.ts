import { create } from 'zustand'
import type { CategoryId } from '../../shared/types/tool'

export type View =
  | { type: 'home' }
  | { type: 'category'; category: CategoryId }
  | { type: 'tool'; toolId: string }
  | { type: 'history' }
  | { type: 'settings' }

interface NavState {
  view: View
  paletteOpen: boolean
  /** Query to seed the command palette with on next open (consumed once). */
  paletteSeedQuery: string | null
  goHome: () => void
  openCategory: (category: CategoryId) => void
  openTool: (toolId: string) => void
  openHistory: () => void
  openSettings: () => void
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
  openHistory: () => set({ view: { type: 'history' }, paletteOpen: false }),
  openSettings: () => set({ view: { type: 'settings' }, paletteOpen: false }),
  setPaletteOpen: (paletteOpen, seedQuery) =>
    set((state) => ({
      paletteOpen,
      paletteSeedQuery: paletteOpen ? (seedQuery ?? null) : null,
      view: state.view
    }))
}))
