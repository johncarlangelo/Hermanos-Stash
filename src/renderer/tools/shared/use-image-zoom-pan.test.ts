import { describe, expect, it } from 'vitest'
import {
  calculateAnchoredPan,
  clampZoom,
  stepZoomLevel
} from './use-image-zoom-pan'

describe('Image Zoom & Pan Lens Math', () => {
  describe('clampZoom', () => {
    it('restricts zoom factor within min and max boundaries', () => {
      expect(clampZoom(0.5, 1.0, 5.0)).toBe(1.0)
      expect(clampZoom(2.5, 1.0, 5.0)).toBe(2.5)
      expect(clampZoom(6.0, 1.0, 5.0)).toBe(5.0)
    })

    it('handles NaN and non-finite inputs gracefully', () => {
      expect(clampZoom(NaN, 1.0, 5.0)).toBe(1.0)
      expect(clampZoom(Infinity, 1.0, 5.0)).toBe(1.0)
    })
  })

  describe('stepZoomLevel', () => {
    it('steps up cleanly by factor without overshooting max', () => {
      expect(stepZoomLevel(1.0, 'in', 1.0, 5.0, 1.5)).toBe(1.5)
      expect(stepZoomLevel(4.0, 'in', 1.0, 5.0, 1.5)).toBe(5.0)
    })

    it('steps down cleanly by factor without undershooting min', () => {
      expect(stepZoomLevel(2.0, 'out', 1.0, 5.0, 2.0)).toBe(1.0)
      expect(stepZoomLevel(1.2, 'out', 1.0, 5.0, 1.5)).toBe(1.0)
    })
  })

  describe('calculateAnchoredPan', () => {
    it('keeps cursor-focused content point stationary across scale changes', () => {
      // Viewport center at (0, 0), cursor at (100, 50)
      // Initial state: zoom 1.0, pan (0, 0)
      const cursor = { x: 100, y: 50 }
      const initialPan = { x: 0, y: 0 }

      // Zoom from 1.0x to 2.0x
      const panAt2x = calculateAnchoredPan(cursor, initialPan, 1.0, 2.0)
      // When scaled by 2, cursor distance from center doubles (100 -> 200, 50 -> 100).
      // Pan must shift by -100, -50 to keep cursor at original screen coordinates (100, 50).
      expect(panAt2x).toEqual({ x: -100, y: -50 })

      // Zoom back from 2.0x to 1.0x at the same cursor point
      const panBackAt1x = calculateAnchoredPan(cursor, panAt2x, 2.0, 1.0)
      expect(panBackAt1x).toEqual({ x: 0, y: 0 })
    })

    it('handles centered cursor zooming without offset drift', () => {
      const cursorAtCenter = { x: 0, y: 0 }
      const initialPan = { x: 0, y: 0 }
      const nextPan = calculateAnchoredPan(cursorAtCenter, initialPan, 1.0, 3.0)
      expect(nextPan).toEqual({ x: 0, y: 0 })
    })

    it('preserves existing pan offsets when zooming at center', () => {
      const cursorAtCenter = { x: 0, y: 0 }
      const existingPan = { x: 40, y: -20 }
      const nextPan = calculateAnchoredPan(cursorAtCenter, existingPan, 1.0, 2.0)
      // Existing pan scales with the zoom ratio (2.0 / 1.0 = 2.0)
      expect(nextPan).toEqual({ x: 80, y: -40 })
    })

    it('correctly handles negative cursor coordinates (top-left quadrant)', () => {
      const cursor = { x: -120, y: -80 }
      const initialPan = { x: 0, y: 0 }
      const panAt3x = calculateAnchoredPan(cursor, initialPan, 1.0, 3.0)
      // scaleRatio = 3, cursor - (cursor - 0)*3 = -120 - (-360) = 240
      expect(panAt3x).toEqual({ x: 240, y: 160 })
    })

    it('returns zero pan for non-positive zoom factors', () => {
      expect(calculateAnchoredPan({ x: 10, y: 10 }, { x: 5, y: 5 }, 0, 2.0)).toEqual({ x: 0, y: 0 })
      expect(calculateAnchoredPan({ x: 10, y: 10 }, { x: 5, y: 5 }, 1.0, -1.0)).toEqual({ x: 0, y: 0 })
    })
  })
})
