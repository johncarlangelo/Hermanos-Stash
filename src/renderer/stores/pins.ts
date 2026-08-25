import { create } from 'zustand'

/**
 * Pinned tools (Milestone 8): an ordered dock persisted in prefs
 * (`pinnedTools`), independent of favorites. Pins are the user's daily
 * drivers — they render above Favorites in the sidebar.
 */

const PIN_KEY = 'pinnedTools'
export const PIN_LIMIT = 6

interface PinState {
  pins: string[]
  loaded: boolean
  load: () => Promise<void>
  togglePin: (toolId: string) => Promise<void>
  movePin: (toolId: string, direction: -1 | 1) => Promise<void>
}

async function readPins(): Promise<string[]> {
  try {
    const value = await window.stash.prefs.get<string[]>(PIN_KEY)
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

async function writePins(pins: string[]): Promise<void> {
  try {
    await window.stash.prefs.set(PIN_KEY, pins)
  } catch {
    // Non-fatal; optimistic state stands.
  }
}

export const usePins = create<PinState>((set, get) => ({
  pins: [],
  loaded: false,

  load: async () => {
    const pins = await readPins()
    set({ pins: pins.slice(0, PIN_LIMIT), loaded: true })
  },

  togglePin: async (toolId) => {
    const prev = get().pins
    let next: string[]
    if (prev.includes(toolId)) {
      next = prev.filter((id) => id !== toolId)
    } else {
      if (prev.length >= PIN_LIMIT) return // silently ignore at cap
      next = [...prev, toolId]
    }
    set({ pins: next })
    await writePins(next)
  },

  movePin: async (toolId, direction) => {
    const prev = get().pins
    const i = prev.indexOf(toolId)
    const j = i + direction
    if (i === -1 || j < 0 || j >= prev.length) return
    const next = [...prev]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    set({ pins: next })
    await writePins(next)
  }
}))
