import { create } from 'zustand'

/**
 * Favorites and recents are persisted in SQLite via the main process; this
 * store mirrors that state in the renderer with optimistic updates.
 */

interface LibraryState {
  favorites: string[]
  recents: Array<{ toolId: string; lastUsedMs: number }>
  loaded: boolean
  load: () => Promise<void>
  toggleFavorite: (toolId: string) => Promise<void>
  recordRecent: (toolId: string) => Promise<void>
}

export const useLibrary = create<LibraryState>((set, get) => ({
  favorites: [],
  recents: [],
  loaded: false,

  load: async () => {
    try {
      const [favorites, recents] = await Promise.all([
        window.stash.favorites.list(),
        window.stash.recents.list(8)
      ])
      set({
        favorites,
        recents: recents.map((r) => ({ toolId: r.toolId, lastUsedMs: r.lastUsedMs })),
        loaded: true
      })
    } catch {
      // The app remains usable without persistence (e.g. first-run failure).
      set({ loaded: true })
    }
  },

  toggleFavorite: async (toolId) => {
    const prev = get().favorites
    const optimistic = prev.includes(toolId)
      ? prev.filter((id) => id !== toolId)
      : [...prev, toolId]
    set({ favorites: optimistic })
    try {
      const confirmed = await window.stash.favorites.toggle(toolId)
      // Reconcile in case of drift between optimistic state and the store.
      if (confirmed === prev.includes(toolId)) {
        set({
          favorites: confirmed
            ? [...new Set([...get().favorites, toolId])]
            : get().favorites.filter((id) => id !== toolId)
        })
      }
    } catch {
      set({ favorites: prev })
    }
  },

  recordRecent: async (toolId) => {
    set((state) => ({
      recents: [
        { toolId, lastUsedMs: Date.now() },
        ...state.recents.filter((r) => r.toolId !== toolId)
      ].slice(0, 8)
    }))
    try {
      await window.stash.recents.add(toolId)
    } catch {
      // Non-fatal.
    }
  }
}))
