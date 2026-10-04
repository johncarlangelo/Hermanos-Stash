/**
 * Hermanos Stash — Image Zoom & Pan Lens
 *
 * Provides cursor-anchored mouse-wheel zooming (1x to 5x), click-and-drag panning,
 * pointer capture, double-click toggle, and keyboard shortcuts for image tools.
 */

import { useCallback, useRef, useState, type CSSProperties } from 'react'

export interface UseImageZoomPanOptions {
  minZoom?: number
  maxZoom?: number
  initialZoom?: number
  stepFactor?: number
  onZoomChange?: (zoom: number) => void
}

export interface UseImageZoomPanReturn {
  zoom: number
  pan: { x: number; y: number }
  isPanning: boolean
  isZoomed: boolean
  zoomPercent: number
  zoomIn: (factor?: number) => void
  zoomOut: (factor?: number) => void
  resetZoom: () => void
  setZoom: (zoom: number) => void
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>
  handleWheel: (e: React.WheelEvent<HTMLElement>) => void
  handlePointerDown: (e: React.PointerEvent<HTMLElement>) => void
  handlePointerMove: (e: React.PointerEvent<HTMLElement>) => void
  handlePointerUp: (e: React.PointerEvent<HTMLElement>) => void
  handleDoubleClick: (e?: React.MouseEvent<HTMLElement>) => void
  transformStyle: CSSProperties
  cursorClass: string
}

/**
 * Pure math: Calculates the new pan offset such that the content point
 * directly beneath the mouse cursor remains stationary across a zoom change.
 */
export function calculateAnchoredPan(
  cursor: { x: number; y: number },
  pan: { x: number; y: number },
  oldZoom: number,
  newZoom: number
): { x: number; y: number } {
  if (oldZoom <= 0 || newZoom <= 0) return { x: 0, y: 0 }
  const scaleRatio = newZoom / oldZoom
  return {
    x: Math.round(cursor.x - (cursor.x - pan.x) * scaleRatio),
    y: Math.round(cursor.y - (cursor.y - pan.y) * scaleRatio)
  }
}

/**
 * Pure math: Clamps zoom factor within specified min and max bounds.
 */
export function clampZoom(zoom: number, min = 1.0, max = 5.0): number {
  if (Number.isNaN(zoom) || !Number.isFinite(zoom)) return min
  return Math.min(max, Math.max(min, zoom))
}

/**
 * Pure math: Step zoom factor up or down.
 */
export function stepZoomLevel(
  current: number,
  direction: 'in' | 'out',
  min = 1.0,
  max = 5.0,
  factor = 1.25
): number {
  const next = direction === 'in' ? current * factor : current / factor
  return Number(clampZoom(next, min, max).toFixed(2))
}

export function useImageZoomPan({
  minZoom = 1.0,
  maxZoom = 5.0,
  initialZoom = 1.0,
  stepFactor = 1.25,
  onZoomChange
}: UseImageZoomPanOptions = {}): UseImageZoomPanReturn {
  const [zoom, setZoomState] = useState<number>(clampZoom(initialZoom, minZoom, maxZoom))
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState<boolean>(false)

  const isPanningRef = useRef<boolean>(false)
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  const setZoom = useCallback(
    (newZoom: number) => {
      const clamped = clampZoom(newZoom, minZoom, maxZoom)
      setZoomState(clamped)
      if (clamped <= minZoom) {
        setPan({ x: 0, y: 0 })
      }
      onZoomChange?.(clamped)
    },
    [minZoom, maxZoom, onZoomChange]
  )

  const resetZoom = useCallback(() => {
    setZoomState(initialZoom)
    setPan({ x: 0, y: 0 })
    onZoomChange?.(initialZoom)
  }, [initialZoom, onZoomChange])

  const zoomIn = useCallback(
    (factor = stepFactor) => {
      setZoomState((curr) => {
        const next = stepZoomLevel(curr, 'in', minZoom, maxZoom, factor)
        onZoomChange?.(next)
        return next
      })
    },
    [minZoom, maxZoom, stepFactor, onZoomChange]
  )

  const zoomOut = useCallback(
    (factor = stepFactor) => {
      setZoomState((curr) => {
        const next = stepZoomLevel(curr, 'out', minZoom, maxZoom, factor)
        if (Math.abs(next - initialZoom) < 0.01) {
          setPan({ x: 0, y: 0 })
        }
        onZoomChange?.(next)
        return next
      })
    },
    [minZoom, maxZoom, initialZoom, stepFactor, onZoomChange]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLElement>) => {
      e.stopPropagation()

      // Trackpad pinch-to-zoom (ctrlKey) vs standard mouse wheel
      const factor = e.ctrlKey
        ? Math.exp(-e.deltaY * 0.01)
        : e.deltaY < 0
          ? 1.15
          : 0.87

      const currentZoom = zoom
      const nextZoom = clampZoom(Number((currentZoom * factor).toFixed(3)), minZoom, maxZoom)
      if (nextZoom === currentZoom) return

      const rect = e.currentTarget.getBoundingClientRect()
      const cursorX = e.clientX - rect.left - rect.width / 2
      const cursorY = e.clientY - rect.top - rect.height / 2

      if (nextZoom <= minZoom) {
        setZoomState(minZoom)
        setPan({ x: 0, y: 0 })
        onZoomChange?.(minZoom)
      } else {
        const nextPan = calculateAnchoredPan(
          { x: cursorX, y: cursorY },
          pan,
          currentZoom,
          nextZoom
        )
        setZoomState(nextZoom)
        setPan(nextPan)
        onZoomChange?.(nextZoom)
      }
    },
    [zoom, pan, minZoom, maxZoom, onZoomChange]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Left-click (0) or Middle-click (1)
      if (e.button !== 0 && e.button !== 1) return

      // Drag to pan when zoomed in or middle-clicked
      if (zoom > minZoom || e.button === 1) {
        isPanningRef.current = true
        setIsPanning(true)
        panStartRef.current = {
          x: e.clientX - pan.x,
          y: e.clientY - pan.y
        }
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // Non-fatal if element cannot capture pointer
        }
      }
    },
    [zoom, minZoom, pan]
  )

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!isPanningRef.current) return
    const nextX = Math.round(e.clientX - panStartRef.current.x)
    const nextY = Math.round(e.clientY - panStartRef.current.y)
    setPan({ x: nextX, y: nextY })
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false
      setIsPanning(false)
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      } catch {
        // Non-fatal
      }
    }
  }, [])

  const isZoomed =
    Math.abs(zoom - initialZoom) > 0.001 || pan.x !== 0 || pan.y !== 0

  const handleDoubleClick = useCallback(
    (e?: React.MouseEvent<HTMLElement>) => {
      if (isZoomed) {
        // Reset to default fitted view
        resetZoom()
      } else {
        // Quick zoom in to 2.5x (or maxZoom) at cursor
        const targetZoom = Math.min(maxZoom, Math.max(initialZoom * 2, 2.5))
        if (e) {
          const rect = e.currentTarget.getBoundingClientRect()
          const cursorX = e.clientX - rect.left - rect.width / 2
          const cursorY = e.clientY - rect.top - rect.height / 2
          const nextPan = calculateAnchoredPan({ x: cursorX, y: cursorY }, pan, zoom, targetZoom)
          setZoomState(targetZoom)
          setPan(nextPan)
          onZoomChange?.(targetZoom)
        } else {
          setZoomState(targetZoom)
          setPan({ x: 0, y: 0 })
          onZoomChange?.(targetZoom)
        }
      }
    },
    [isZoomed, zoom, initialZoom, maxZoom, pan, resetZoom, onZoomChange]
  )

  const zoomPercent = Math.round(zoom * 100)

  const transformStyle: CSSProperties = {
    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
    transformOrigin: 'center center',
    transition: isPanning ? 'none' : 'transform 75ms ease-out'
  }

  const cursorClass = isPanning
    ? 'cursor-grabbing'
    : isZoomed
      ? 'cursor-grab'
      : 'cursor-default'

  return {
    zoom,
    pan,
    isPanning,
    isZoomed,
    zoomPercent,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
    setPan,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    transformStyle,
    cursorClass
  }
}
