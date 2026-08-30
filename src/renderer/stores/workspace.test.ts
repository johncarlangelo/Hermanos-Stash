import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspace, WORKSPACE_WIDTH_KEY } from './workspace'

const prefsGet = vi.fn()
const prefsSet = vi.fn()

vi.stubGlobal('window', {
  stash: { prefs: { get: prefsGet, set: prefsSet } }
})

describe('useWorkspace Store', () => {
  beforeEach(() => {
    prefsGet.mockReset()
    prefsSet.mockReset()
  })

  it('loads saved width from prefs', async () => {
    prefsGet.mockResolvedValue('standard')
    await useWorkspace.getState().load()
    expect(useWorkspace.getState().width).toBe('standard')
  })

  it('defaults to wide if prefs is empty', async () => {
    prefsGet.mockResolvedValue(undefined)
    await useWorkspace.getState().load()
    expect(useWorkspace.getState().width).toBe('wide')
  })

  it('updates and persists width change', async () => {
    prefsSet.mockResolvedValue(undefined)
    await useWorkspace.getState().setWidth('standard')
    expect(useWorkspace.getState().width).toBe('standard')
    expect(prefsSet).toHaveBeenCalledWith(WORKSPACE_WIDTH_KEY, 'standard')
  })
})
