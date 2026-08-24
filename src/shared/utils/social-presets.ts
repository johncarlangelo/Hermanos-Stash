/**
 * Canonical social media image sizes shared by the Social Preset Resizer's
 * renderer UI and main-process validation. Single source of truth: adding a
 * preset here makes it selectable everywhere at once.
 */

export interface SocialPreset {
  id: string
  label: string
  w: number
  h: number
}

export const PRESET_LIST: readonly SocialPreset[] = [
  { id: 'og-image', label: 'OG Image', w: 1200, h: 630 },
  { id: 'x-card', label: 'X Card', w: 1200, h: 675 },
  { id: 'instagram-square', label: 'Instagram Square', w: 1080, h: 1080 },
  { id: 'instagram-portrait', label: 'Instagram Portrait', w: 1080, h: 1350 },
  { id: 'instagram-story', label: 'Instagram Story', w: 1080, h: 1920 },
  { id: 'youtube-thumb', label: 'YouTube Thumbnail', w: 1280, h: 720 },
  { id: 'linkedin', label: 'LinkedIn', w: 1200, h: 627 },
  { id: 'facebook-link', label: 'Facebook Link', w: 1200, h: 630 }
]

/** Presets pre-checked in the UI — the common web-sharing trio. */
export const DEFAULT_SELECTED_PRESETS: readonly string[] = [
  'og-image',
  'x-card',
  'instagram-square'
]

export function isSocialPresetId(value: unknown): value is string {
  return typeof value === 'string' && PRESET_LIST.some((preset) => preset.id === value)
}

export function socialPresetById(id: string): SocialPreset | undefined {
  return PRESET_LIST.find((preset) => preset.id === id)
}
