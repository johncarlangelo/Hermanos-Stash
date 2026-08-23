import { create } from 'zustand'
import type { CategoryId } from '../../shared/types/tool'

export type View =
  | { type: 'home' }
  | { type: 'category'; category: CategoryId }
  | { type: 'tool'; toolId: string }
  | { type: 'settings' }

interface NavState {
  view: View
  paletteOpen: boolean
  goHome: () => void
  openCategory: (category: CategoryId) => void
  openTool: (toolId: string) => void
  openSettings: () => void
  setPaletteOpen: (open: boolean) => void
}

/** Single-window navigation state — tools never spawn new windows. */
export const useNav = create<NavState>((set) => ({
  view: { type: 'home' },
  paletteOpen: false,
  goHome: () => set({ view: { type: 'home' } }),
  openCategory: (category) => set({ view: { type: 'category', category }, paletteOpen: false }),
  openTool: (toolId) => set({ view: { type: 'tool', toolId }, paletteOpen: false }),
  openSettings: () => set({ view: { type: 'settings' }, paletteOpen: false }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen })
}))
