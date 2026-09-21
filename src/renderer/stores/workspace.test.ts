import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useWorkspace,
  WORKSPACE_WIDTH_KEY,
  SIDEBAR_ACCORDION_KEY,
  DEFAULT_SIDEBAR_ACCORDION
} from './workspace'

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

  it('toggles split mode and sets default secondary tool', () => {
    useWorkspace.setState({ splitMode: false, secondaryToolId: null })
    useWorkspace.getState().toggleSplitMode('json-formatter')
    expect(useWorkspace.getState().splitMode).toBe(true)
    expect(useWorkspace.getState().secondaryToolId).toBe('json-formatter')

    useWorkspace.getState().toggleSplitMode()
    expect(useWorkspace.getState().splitMode).toBe(false)
  })

  it('sets secondary tool id directly', () => {
    useWorkspace.getState().setSecondaryToolId('regex-tester')
    expect(useWorkspace.getState().secondaryToolId).toBe('regex-tester')
  })

  it('clamps split ratio between 0.25 and 0.75', async () => {
    prefsSet.mockResolvedValue(undefined)
    await useWorkspace.getState().setSplitRatio(0.1)
    expect(useWorkspace.getState().splitRatio).toBe(0.25)

    await useWorkspace.getState().setSplitRatio(0.9)
    expect(useWorkspace.getState().splitRatio).toBe(0.75)

    await useWorkspace.getState().setSplitRatio(0.6)
    expect(useWorkspace.getState().splitRatio).toBe(0.6)
  })

  it('swaps panes correctly', () => {
    useWorkspace.setState({ secondaryToolId: 'hash-generator' })
    const oldSecondary = useWorkspace.getState().swapPanes('base64-text')
    expect(oldSecondary).toBe('hash-generator')
    expect(useWorkspace.getState().secondaryToolId).toBe('base64-text')
  })

  it('sets active pane', () => {
    useWorkspace.getState().setActivePane('secondary')
    expect(useWorkspace.getState().activePane).toBe('secondary')
    useWorkspace.getState().setActivePane('primary')
    expect(useWorkspace.getState().activePane).toBe('primary')
  })

  it('loads saved sidebar accordion sections from prefs', async () => {
    prefsGet.mockResolvedValue(['favorites'])
    await useWorkspace.getState().load()
    expect(useWorkspace.getState().sidebarAccordionSections).toEqual(['favorites'])
  })

  it('defaults sidebar accordion sections if prefs is empty', async () => {
    prefsGet.mockResolvedValue(undefined)
    await useWorkspace.getState().load()
    expect(useWorkspace.getState().sidebarAccordionSections).toEqual(DEFAULT_SIDEBAR_ACCORDION)
  })

  it('updates and persists sidebar accordion collapsed state', async () => {
    prefsSet.mockResolvedValue(undefined)
    await useWorkspace.getState().setSidebarAccordionSections(['favorites', 'recent'])
    expect(useWorkspace.getState().sidebarAccordionSections).toEqual(['favorites', 'recent'])
    expect(prefsSet).toHaveBeenCalledWith(SIDEBAR_ACCORDION_KEY, ['favorites', 'recent'])
  })
})
