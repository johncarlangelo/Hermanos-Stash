import { create } from 'zustand'

export type WorkspaceWidth = 'wide' | 'standard'

export const WORKSPACE_WIDTH_KEY = 'ui.workspaceWidth'
export const SPLIT_RATIO_KEY = 'ui.splitRatio'
export const SIDEBAR_ACCORDION_KEY = 'ui.sidebarAccordion'

export const DEFAULT_SIDEBAR_ACCORDION: string[] = ['favorites', 'categories']

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
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  sidebarAccordionSections: string[]
  setSidebarAccordionSections: (sections: string[]) => Promise<void>
}

export const DEFAULT_SECONDARY_TOOL = 'text-diff'

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  width: 'wide',
  loaded: false,
  splitMode: false,
  secondaryToolId: null,
  splitRatio: 0.5,
  activePane: 'primary',
  sidebarCollapsed: false,
  sidebarAccordionSections: DEFAULT_SIDEBAR_ACCORDION,
  setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  load: async () => {
    try {
      const savedWidth = await window.stash.prefs.get<string>(WORKSPACE_WIDTH_KEY)
      const savedRatio = await window.stash.prefs.get<number>(SPLIT_RATIO_KEY)
      const savedAccordion = await window.stash.prefs.get<string[]>(SIDEBAR_ACCORDION_KEY)
      set({
        width: savedWidth === 'wide' || savedWidth === 'standard' ? savedWidth : 'wide',
        splitRatio:
          typeof savedRatio === 'number' && !isNaN(savedRatio)
            ? Math.min(0.75, Math.max(0.25, savedRatio))
            : 0.5,
        sidebarAccordionSections: Array.isArray(savedAccordion)
          ? savedAccordion
          : DEFAULT_SIDEBAR_ACCORDION,
        loaded: true
      })
    } catch {
      set({
        width: 'wide',
        splitRatio: 0.5,
        sidebarAccordionSections: DEFAULT_SIDEBAR_ACCORDION,
        loaded: true
      })
    }
  },

  setSidebarAccordionSections: async (sections: string[]) => {
    set({ sidebarAccordionSections: sections })
    try {
      await window.stash.prefs.set(SIDEBAR_ACCORDION_KEY, sections)
    } catch {
      // Non-fatal
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
