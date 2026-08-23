/**
 * Pure helpers for the Image Preview tool — kept environment-agnostic so they
 * stay unit-testable without Electron or DOM image decoding.
 */

export const ACCEPTED_IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.avif'
] as const

export const ZOOM_MIN_PERCENT = 10
export const ZOOM_MAX_PERCENT = 800
export const ZOOM_STEP_PERCENT = 25

/** 'fit' lets the browser constrain the image; numbers are explicit scales. */
export type ZoomMode = 'fit' | number

/** Apply one zoom-in/out step, starting from 100% when currently fitting. */
export function stepZoom(current: ZoomMode, direction: 1 | -1): number {
  const base = current === 'fit' ? 100 : current
  const next = base + direction * ZOOM_STEP_PERCENT
  return Math.min(ZOOM_MAX_PERCENT, Math.max(ZOOM_MIN_PERCENT, next))
}
