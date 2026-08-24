import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SELECTED_PRESETS,
  PRESET_LIST,
  isSocialPresetId,
  socialPresetById
} from './social-presets'

describe('PRESET_LIST integrity', () => {
  it('has unique ids with positive integer dimensions', () => {
    const ids = new Set<string>()
    for (const preset of PRESET_LIST) {
      expect(ids.has(preset.id)).toBe(false)
      expect(preset.id.length).toBeGreaterThan(0)
      expect(preset.label.length).toBeGreaterThan(0)
      expect(Number.isInteger(preset.w)).toBe(true)
      expect(Number.isInteger(preset.h)).toBe(true)
      expect(preset.w).toBeGreaterThan(0)
      expect(preset.h).toBeGreaterThan(0)
      ids.add(preset.id)
    }
    expect(PRESET_LIST.length).toBeGreaterThanOrEqual(8)
  })

  it('defaults to a non-empty subset of real presets', () => {
    expect(DEFAULT_SELECTED_PRESETS.length).toBeGreaterThan(0)
    for (const id of DEFAULT_SELECTED_PRESETS) {
      expect(socialPresetById(id)).toBeDefined()
    }
  })

  it('guards lookups against junk input', () => {
    expect(isSocialPresetId('og-image')).toBe(true)
    expect(isSocialPresetId('nope')).toBe(false)
    expect(isSocialPresetId(42)).toBe(false)
    expect(isSocialPresetId(undefined)).toBe(false)
    expect(socialPresetById('youtube-thumb')).toMatchObject({ w: 1280, h: 720 })
    expect(socialPresetById('missing')).toBeUndefined()
  })
})
