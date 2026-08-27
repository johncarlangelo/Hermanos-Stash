import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the typed bridge before importing the store.
const prefsGet = vi.fn()
const prefsSet = vi.fn()

vi.stubGlobal('window', {
  stash: { prefs: { get: prefsGet, set: prefsSet } }
})

import { useQueueStore } from './queue'

describe('useQueueStore', () => {
  beforeEach(() => {
    prefsGet.mockReset()
    prefsSet.mockReset()
    useQueueStore.setState({ presets: [], lastUsedId: null })
  })

  it('initializes from prefs', async () => {
    const savedPresets = [{ id: 'q1', name: 'Test', steps: [], createdAt: 1, updatedAt: 1 }]
    prefsGet.mockResolvedValueOnce(savedPresets).mockResolvedValueOnce('q1')

    await useQueueStore.getState().initialize()

    expect(useQueueStore.getState().presets).toEqual(savedPresets)
    expect(useQueueStore.getState().lastUsedId).toBe('q1')
  })

  it('saves a new preset', async () => {
    prefsSet.mockResolvedValue(undefined)
    prefsGet.mockResolvedValue([])

    const preset = await useQueueStore.getState().savePreset({
      name: 'New Queue',
      steps: [{ toolId: 'tool1', params: {} }]
    })

    expect(preset.id).toBeDefined()
    expect(preset.name).toBe('New Queue')
    expect(preset.steps).toHaveLength(1)
    expect(preset.createdAt).toBe(preset.updatedAt)
    expect(useQueueStore.getState().presets).toHaveLength(1)
    expect(prefsSet).toHaveBeenCalled()
  })

  it('updates an existing preset', async () => {
    const existing = {
      id: 'q1',
      name: 'Old Name',
      steps: [],
      createdAt: 1,
      updatedAt: 1
    }
    useQueueStore.setState({ presets: [existing] })
    prefsSet.mockResolvedValue(undefined)

    const updated = await useQueueStore.getState().savePreset({
      id: 'q1',
      name: 'New Name',
      steps: [{ toolId: 'tool2', params: {} }]
    })

    expect(updated.name).toBe('New Name')
    expect(updated.updatedAt).toBeGreaterThan(existing.createdAt)
    expect(updated.createdAt).toBe(existing.createdAt)
    expect(useQueueStore.getState().presets[0].name).toBe('New Name')
  })

  it('deletes a preset', async () => {
    useQueueStore.setState({
      presets: [{ id: 'q1', name: 'A', steps: [], createdAt: 1, updatedAt: 1 }],
      lastUsedId: 'q1'
    })
    prefsSet.mockResolvedValue(undefined)

    await useQueueStore.getState().deletePreset('q1')

    expect(useQueueStore.getState().presets).toHaveLength(0)
    expect(useQueueStore.getState().lastUsedId).toBeNull()
  })

  it('does not crash if deleting non-existent preset', async () => {
    useQueueStore.setState({
      presets: [{ id: 'q1', name: 'A', steps: [], createdAt: 1, updatedAt: 1 }]
    })
    prefsSet.mockResolvedValue(undefined)

    await useQueueStore.getState().deletePreset('q999')

    expect(useQueueStore.getState().presets).toHaveLength(1)
  })

  it('sets last used', async () => {
    prefsSet.mockResolvedValue(undefined)

    await useQueueStore.getState().setLastUsed('q1')

    expect(useQueueStore.getState().lastUsedId).toBe('q1')
    expect(prefsSet).toHaveBeenCalledWith('queue.lastUsed', 'q1')
  })

  it('clears last used', async () => {
    useQueueStore.setState({ lastUsedId: 'q1' })
    prefsSet.mockResolvedValue(undefined)

    await useQueueStore.getState().setLastUsed(null)

    expect(useQueueStore.getState().lastUsedId).toBeNull()
  })

  it('reorders presets', async () => {
    const p1 = { id: 'q1', name: 'A', steps: [], createdAt: 1, updatedAt: 1 }
    const p2 = { id: 'q2', name: 'B', steps: [], createdAt: 2, updatedAt: 2 }
    useQueueStore.setState({ presets: [p1, p2] })
    prefsSet.mockResolvedValue(undefined)

    await useQueueStore.getState().reorderPresets([p2, p1])

    expect(useQueueStore.getState().presets.map((p) => p.id)).toEqual(['q2', 'q1'])
  })
})
