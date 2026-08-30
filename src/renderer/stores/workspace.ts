import { create } from 'zustand'

export type WorkspaceWidth = 'wide' | 'standard'

export const WORKSPACE_WIDTH_KEY = 'ui.workspaceWidth'

interface WorkspaceState {
  width: WorkspaceWidth
  loaded: boolean
  load: () => Promise<void>
  setWidth: (width: WorkspaceWidth) => Promise<void>
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  width: 'wide',
  loaded: false,

  load: async () => {
    try {
      const saved = await window.stash.prefs.get<string>(WORKSPACE_WIDTH_KEY)
      if (saved === 'wide' || saved === 'standard') {
        set({ width: saved, loaded: true })
      } else {
        set({ width: 'wide', loaded: true })
      }
    } catch {
      set({ width: 'wide', loaded: true })
    }
  },

  setWidth: async (width: WorkspaceWidth) => {
    set({ width })
    try {
      await window.stash.prefs.set(WORKSPACE_WIDTH_KEY, width)
    } catch {
      // Non-fatal
    }
  }
}))
