/**
 * Zoom preference shared by main (window creation + IPC clamp) and the
 * renderer (Settings). The overlay height tracks 40 CSS px per unit factor,
 * matching the renderer titlebar's base height.
 */
export const DEFAULT_ZOOM_FACTOR = 1.1

export const MIN_ZOOM_FACTOR = 0.8
export const MAX_ZOOM_FACTOR = 1.6

export function clampZoomFactor(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_ZOOM_FACTOR
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, value))
}

/** Native Windows overlay height in DIPs for a given renderer zoom factor. */
export function overlayHeightFor(zoomFactor: unknown): number {
  return Math.round(40 * clampZoomFactor(zoomFactor))
}
