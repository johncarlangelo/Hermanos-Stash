import { create } from 'zustand'

export type WorkspaceWidth = 'wide' | 'standard'

export const WORKSPACE_WIDTH_KEY = 'ui.workspaceWidth'
export const SPLIT_RATIO_KEY = 'ui.splitRatio'

export interface WorkspaceState {
  width: WorkspaceWidth
  loaded: boolean
  splitMode: boolean
  secondaryToolId: string | null
  splitRatio: number
  activePane: 'primary' | 'secondary'
  load: () => Promise<void>
  setWidth: (width: WorkspaceWidth) => Promise<void>
  setSplitMode: (enabled: boolean, secondaryToolId?: string) => void
  toggleSplitMode: (defaultSecondaryId?: string) => void
  setSecondaryToolId: (toolId: string) => void
  setSplitRatio: (ratio: number) => Promise<void>
  setActivePane: (pane: 'primary' | 'secondary') => void
  swapPanes: (currentPrimaryToolId: string) => string | null
}

export const DEFAULT_SECONDARY_TOOL = 'text-diff'

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  width: 'wide',
  loaded: false,
  splitMode: false,
  secondaryToolId: null,
  splitRatio: 0.5,
  activePane: 'primary',

  load: async () => {
    try {
      const savedWidth = await window.stash.prefs.get<string>(WORKSPACE_WIDTH_KEY)
      const savedRatio = await window.stash.prefs.get<number>(SPLIT_RATIO_KEY)
      set({
        width: savedWidth === 'wide' || savedWidth === 'standard' ? savedWidth : 'wide',
        splitRatio:
          typeof savedRatio === 'number' && !isNaN(savedRatio)
            ? Math.min(0.75, Math.max(0.25, savedRatio))
            : 0.5,
        loaded: true
      })
    } catch {
      set({ width: 'wide', splitRatio: 0.5, loaded: true })
    }
  },

  setWidth: async (width: WorkspaceWidth) => {
    set({ width })
    try {
      await window.stash.prefs.set(WORKSPACE_WIDTH_KEY, width)
    } catch {
      // Non-fatal
    }
  },

  setSplitMode: (enabled: boolean, secondaryToolId?: string) => {
    set((state) => {
      const targetSecondary = secondaryToolId ?? state.secondaryToolId ?? DEFAULT_SECONDARY_TOOL
      return {
        splitMode: enabled,
        secondaryToolId: targetSecondary,
        activePane: 'primary'
      }
    })
  },

  toggleSplitMode: (defaultSecondaryId?: string) => {
    set((state) => {
      const willEnable = !state.splitMode
      const targetSecondary = state.secondaryToolId ?? defaultSecondaryId ?? DEFAULT_SECONDARY_TOOL
      return {
        splitMode: willEnable,
        secondaryToolId: targetSecondary,
        activePane: 'primary'
      }
    })
  },

  setSecondaryToolId: (toolId: string) => {
    set({ secondaryToolId: toolId })
  },

  setSplitRatio: async (ratio: number) => {
    const clamped = Math.min(0.75, Math.max(0.25, ratio))
    set({ splitRatio: clamped })
    try {
      await window.stash.prefs.set(SPLIT_RATIO_KEY, clamped)
    } catch {
      // Non-fatal
    }
  },

  setActivePane: (pane: 'primary' | 'secondary') => {
    set({ activePane: pane })
  },

  swapPanes: (currentPrimaryToolId: string) => {
    const state = get()
    const prevSecondary = state.secondaryToolId
    if (!prevSecondary) return null

    set({
      secondaryToolId: currentPrimaryToolId
    })
    return prevSecondary
  }
}))
