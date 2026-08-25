import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the typed bridge before importing the store.
const prefsGet = vi.fn()
const prefsSet = vi.fn()

vi.stubGlobal('window', {
  stash: { prefs: { get: prefsGet, set: prefsSet } }
})

import { usePins } from './pins'

describe('pins store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usePins.setState({ pins: [], loaded: false })
    prefsGet.mockResolvedValue([])
    prefsSet.mockResolvedValue(undefined)
  })

  it('loads pins from prefs', async () => {
    prefsGet.mockResolvedValue(['pdf-merge', 'json-format'])
    await usePins.getState().load()
    expect(usePins.getState().pins).toEqual(['pdf-merge', 'json-format'])
    expect(usePins.getState().loaded).toBe(true)
  })

  it('filters non-string entries on load', async () => {
    prefsGet.mockResolvedValue(['ok', 42, null])
    await usePins.getState().load()
    expect(usePins.getState().pins).toEqual(['ok'])
  })

  it('toggles a pin on', async () => {
    await usePins.getState().togglePin('zip-extract')
    expect(usePins.getState().pins).toEqual(['zip-extract'])
    expect(prefsSet).toHaveBeenCalledWith('pinnedTools', ['zip-extract'])
  })

  it('toggles a pin off', async () => {
    usePins.setState({ pins: ['a', 'b'] })
    await usePins.getState().togglePin('a')
    expect(usePins.getState().pins).toEqual(['b'])
  })

  it('enforces the pin cap', async () => {
    usePins.setState({ pins: ['1', '2', '3', '4', '5', '6'] })
    await usePins.getState().togglePin('7')
    expect(usePins.getState().pins).toHaveLength(6)
    expect(usePins.getState().pins).not.toContain('7')
  })

  it('moves a pin up and down', async () => {
    usePins.setState({ pins: ['a', 'b', 'c'] })
    await usePins.getState().movePin('b', -1)
    expect(usePins.getState().pins).toEqual(['b', 'a', 'c'])
    await usePins.getState().movePin('b', 1)
    expect(usePins.getState().pins).toEqual(['a', 'b', 'c'])
  })

  it('ignores out-of-range moves', async () => {
    usePins.setState({ pins: ['a', 'b'] })
    await usePins.getState().movePin('a', -1)
    expect(usePins.getState().pins).toEqual(['a', 'b'])
    await usePins.getState().movePin('b', 1)
    expect(usePins.getState().pins).toEqual(['a', 'b'])
  })

  it('keeps optimistic state when prefs write fails', async () => {
    prefsSet.mockRejectedValue(new Error('disk full'))
    usePins.setState({ pins: [] })
    await usePins.getState().togglePin('x')
    expect(usePins.getState().pins).toEqual(['x']) // stands despite failure
  })
})
