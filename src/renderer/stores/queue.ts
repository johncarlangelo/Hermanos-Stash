import { create } from 'zustand'

export interface QueueStep {
  toolId: string
  params: Record<string, unknown>
}

export interface QueuePreset {
  id: string
  name: string
  steps: QueueStep[]
  createdAt: number
  updatedAt: number
}

const QUEUE_PRESETS_KEY = 'queue.presets'
const QUEUE_LAST_USED_KEY = 'queue.lastUsed'

/**
 * Queue store (Milestone 9): persisted queue presets in prefs.
 * Independent of tools; references toolIds + param overrides.
 */
export interface QueueState {
  presets: QueuePreset[]
  lastUsedId: string | null

  // Actions
  listPresets: () => QueuePreset[]
  getPreset: (id: string) => QueuePreset | undefined
  savePreset: (
    preset: Omit<QueuePreset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => Promise<QueuePreset>
  deletePreset: (id: string) => Promise<void>
  setLastUsed: (id: string | null) => Promise<void>
  reorderPresets: (presets: QueuePreset[]) => Promise<void>
  initialize: () => Promise<void>
}

function generateId(): string {
  return `queue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export const useQueueStore = create<QueueState>((set, get) => ({
  presets: [],
  lastUsedId: null,

  listPresets: () => get().presets,

  getPreset: (id) => get().presets.find((p) => p.id === id),

  savePreset: async (preset) => {
    const now = Date.now()
    const isNew = !preset.id
    const newPreset: QueuePreset = {
      id: preset.id ?? generateId(),
      name: preset.name,
      steps: preset.steps,
      createdAt: isNew ? now : (get().presets.find((p) => p.id === preset.id)?.createdAt ?? now),
      updatedAt: now
    }

    if (isNew) {
      set((state) => ({ presets: [...state.presets, newPreset] }))
    } else {
      set((state) => ({
        presets: state.presets.map((p) => (p.id === newPreset.id ? newPreset : p))
      }))
    }

    // Persist
    try {
      await window.stash.prefs.set(QUEUE_PRESETS_KEY, get().presets)
    } catch (err) {
      console.warn('[QueueStore] Failed to persist presets:', err)
    }

    return newPreset
  },

  deletePreset: async (id) => {
    set((state) => ({
      presets: state.presets.filter((p) => p.id !== id),
      lastUsedId: state.lastUsedId === id ? null : state.lastUsedId
    }))
    try {
      await window.stash.prefs.set(QUEUE_PRESETS_KEY, get().presets)
    } catch (err) {
      console.warn('[QueueStore] Failed to persist presets:', err)
    }
  },

  setLastUsed: async (id) => {
    set({ lastUsedId: id })
    try {
      await window.stash.prefs.set(QUEUE_LAST_USED_KEY, id)
    } catch (err) {
      console.warn('[QueueStore] Failed to persist lastUsed:', err)
    }
  },

  reorderPresets: async (presets) => {
    set({ presets })
    try {
      await window.stash.prefs.set(QUEUE_PRESETS_KEY, presets)
    } catch (err) {
      console.warn('[QueueStore] Failed to persist reorder:', err)
    }
  },

  initialize: async () => {
    try {
      const [presets, lastUsed] = await Promise.all([
        window.stash.prefs.get<QueuePreset[]>(QUEUE_PRESETS_KEY),
        window.stash.prefs.get<string | null>(QUEUE_LAST_USED_KEY)
      ])
      if (Array.isArray(presets)) set({ presets })
      if (lastUsed) set({ lastUsedId: lastUsed })
    } catch (err) {
      console.warn('[QueueStore] Initialize failed:', err)
    }
  }
}))
