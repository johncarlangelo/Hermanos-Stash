import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeftRight,
  ArrowRight,
  Braces,
  Check,
  Circle,
  Code2,
  Copy,
  Disc,
  Download,
  Grid,
  Heart,
  MessageSquare,
  Minus,
  Move,
  PenTool,
  Plus,
  Redo2,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Square,
  Star,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  CANVAS_PRESETS,
  type CanvasConfig,
  PRESET_ICONS,
  SWATCH_COLORS,
  type Shape,
  type ShapeType,
  createDefaultShape,
  generateReactComponent,
  generateSvgString,
  getDoubleArrowPath,
  getHeartPath,
  getPlusPoints,
  getPolygonPoints,
  getRingPath,
  getShieldPath,
  getSpeechBubblePath,
  getStarPoints,
  rasterizeSvgToBlob,
  roundTo,
  snapCoordinate
} from './logic'

export default function SvgCreatorTool() {
  const [config, setConfig] = useState<CanvasConfig>({
    width: 512,
    height: 512,
    background: 'transparent',
    showGrid: true,
    snapToGrid: true,
    gridSize: 20
  })

  // History stack for Undo / Redo
  const [history, setHistory] = useState<Shape[][]>([
    [
      createDefaultShape(
        'rect',
        {
          width: 512,
          height: 512,
          background: '',
          showGrid: true,
          snapToGrid: false,
          gridSize: 20
        },
        {
          x: 106,
          y: 106,
          width: 300,
          height: 300,
          cornerRadius: 48,
          fill: '#f59e0b',
          stroke: '#ffffff',
          strokeWidth: 0
        }
      ),
      createDefaultShape(
        'preset-icon',
        {
          width: 512,
          height: 512,
          background: '',
          showGrid: true,
          snapToGrid: false,
          gridSize: 20
        },
        {
          x: 181,
          y: 181,
          width: 150,
          height: 150,
          fill: '#ffffff',
          iconPath: PRESET_ICONS[0].path
        }
      )
    ]
  ])
  const [historyIndex, setHistoryIndex] = useState(0)

  const shapes = useMemo(() => history[historyIndex] ?? [], [history, historyIndex])

  const updateShapes = useCallback(
    (newShapes: Shape[], recordHistory = true) => {
      if (recordHistory) {
        setHistory((prev) => {
          const nextHistory = prev.slice(0, historyIndex + 1)
          return [...nextHistory, newShapes]
        })
        setHistoryIndex((prev) => prev + 1)
      } else {
        setHistory((prev) => {
          const next = [...prev]
          next[historyIndex] = newShapes
          return next
        })
      }
    },
    [historyIndex]
  )

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'style' | 'export'>('style')
  const [zoom, setZoom] = useState(1)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedComponent, setCopiedComponent] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportScale, setExportScale] = useState<number>(2)
  const [exportFormat, setExportFormat] = useState<'svg' | 'png' | 'webp' | 'jpeg'>('svg')

  // Tool Modes & Modals
  const [toolMode, setToolMode] = useState<'select' | 'pencil'>('select')
  const [pencilPoints, setPencilPoints] = useState<{ x: number; y: number }[]>([])
  const [showCustomPathModal, setShowCustomPathModal] = useState(false)
  const [customPathInput, setCustomPathInput] = useState('')
  const [customPathName, setCustomPathName] = useState('Custom Vector')
  const [showIconLibraryModal, setShowIconLibraryModal] = useState(false)
  const [iconCategoryFilter, setIconCategoryFilter] = useState<string>('all')
  const [iconSearchQuery, setIconSearchQuery] = useState('')

  const selectedShapes = useMemo(
    () => shapes.filter((s) => selectedIds.includes(s.id)),
    [shapes, selectedIds]
  )
  const primarySelected = selectedShapes[0] ?? null

  // Canvas interaction state
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragHandle, setDragHandle] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<{
    mouseX: number
    mouseY: number
    primaryX: number
    primaryY: number
    primaryW: number
    primaryH: number
    rotation: number
    shapePositions: Array<{ id: string; x: number; y: number; w: number; h: number }>
  } | null>(null)

  // Drag selection (Marquee) state
  const [isMarquee, setIsMarquee] = useState(false)
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null)
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null)

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1)
    }
  }, [historyIndex])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1)
    }
  }, [historyIndex, history.length])

  // Add new shape to canvas
  const handleAddShape = useCallback(
    (type: ShapeType, customData?: Partial<Shape>) => {
      const newShape = createDefaultShape(type, config, customData)
      updateShapes([...shapes, newShape])
      setSelectedIds([newShape.id])
    },
    [config, shapes, updateShapes]
  )

  // Insert Custom SVG Path Handler
  const handleInsertCustomPath = () => {
    const raw = customPathInput.trim()
    if (!raw) {
      toastError('Please provide an SVG path or SVG string')
      return
    }

    let pathD = raw
    // Check if user pasted full <svg> or <path> tag
    const match = raw.match(/d=["']([^"']+)["']/i)
    if (match && match[1]) {
      pathD = match[1]
    }

    const newShape = createDefaultShape('preset-icon', config, {
      name: customPathName || 'Custom Vector',
      iconPath: pathD,
      viewBoxSize: 24,
      width: 120,
      height: 120,
      fill: '#f59e0b'
    })

    updateShapes([...shapes, newShape])
    setSelectedIds([newShape.id])
    setShowCustomPathModal(false)
    setCustomPathInput('')
  }

  // Duplicate Selected Shape(s)
  const handleDuplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    const clones: Shape[] = selectedShapes.map((shape) => ({
      ...shape,
      id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: shape.x + 20,
      y: shape.y + 20,
      name: `${shape.name} (Copy)`
    }))
    updateShapes([...shapes, ...clones])
    setSelectedIds(clones.map((c) => c.id))
  }, [selectedIds, selectedShapes, shapes, updateShapes])

  // Delete Selected Shape(s)
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    updateShapes(shapes.filter((s) => !selectedIds.includes(s.id)))
    setSelectedIds([])
  }, [selectedIds, shapes, updateShapes])

  // Update properties of selected shapes
  const handleUpdateSelected = (props: Partial<Shape>, recordHistory = true) => {
    if (selectedIds.length === 0) return
    const next = shapes.map((s) => (selectedIds.includes(s.id) ? { ...s, ...props } : s))
    updateShapes(next, recordHistory)
  }

  // Layer hierarchy controls
  const handleMoveLayer = (direction: 'top' | 'bottom' | 'up' | 'down') => {
    if (!primarySelected || selectedIds.length !== 1) return
    const index = shapes.findIndex((s) => s.id === primarySelected.id)
    if (index === -1) return

    const newShapes = [...shapes]
    if (direction === 'top') {
      const [item] = newShapes.splice(index, 1)
      newShapes.push(item)
    } else if (direction === 'bottom') {
      const [item] = newShapes.splice(index, 1)
      newShapes.unshift(item)
    } else if (direction === 'up' && index < newShapes.length - 1) {
      const temp = newShapes[index]
      newShapes[index] = newShapes[index + 1]
      newShapes[index + 1] = temp
    } else if (direction === 'down' && index > 0) {
      const temp = newShapes[index]
      newShapes[index] = newShapes[index - 1]
      newShapes[index - 1] = temp
    }
    updateShapes(newShapes)
  }

  // Alignment controls
  const handleAlign = (align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedShapes.length > 1) {
      const minX = Math.min(...selectedShapes.map((s) => s.x))
      const maxX = Math.max(...selectedShapes.map((s) => s.x + s.width))
      const minY = Math.min(...selectedShapes.map((s) => s.y))
      const maxY = Math.max(...selectedShapes.map((s) => s.y + s.height))
      const avgCenterX = (minX + maxX) / 2
      const avgCenterY = (minY + maxY) / 2

      const next = shapes.map((s) => {
        if (!selectedIds.includes(s.id)) return s
        let nextX = s.x
        let nextY = s.y
        if (align === 'left') nextX = minX
        else if (align === 'right') nextX = maxX - s.width
        else if (align === 'center') nextX = avgCenterX - s.width / 2
        else if (align === 'top') nextY = minY
        else if (align === 'bottom') nextY = maxY - s.height
        else if (align === 'middle') nextY = avgCenterY - s.height / 2
        return {
          ...s,
          x: snapCoordinate(nextX, config.gridSize, config.snapToGrid),
          y: snapCoordinate(nextY, config.gridSize, config.snapToGrid)
        }
      })
      updateShapes(next)
    } else if (primarySelected) {
      let nextX = primarySelected.x
      let nextY = primarySelected.y

      switch (align) {
        case 'left':
          nextX = 0
          break
        case 'center':
          nextX = (config.width - primarySelected.width) / 2
          break
        case 'right':
          nextX = config.width - primarySelected.width
          break
        case 'top':
          nextY = 0
          break
        case 'middle':
          nextY = (config.height - primarySelected.height) / 2
          break
        case 'bottom':
          nextY = config.height - primarySelected.height
          break
      }

      handleUpdateSelected({
        x: snapCoordinate(nextX, config.gridSize, config.snapToGrid),
        y: snapCoordinate(nextY, config.gridSize, config.snapToGrid)
      })
    }
  }

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handleDeleteSelected()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        handleDuplicateSelected()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handleRedo()
      } else if (e.key.toLowerCase() === 'v') {
        setToolMode('select')
      } else if (e.key.toLowerCase() === 'p') {
        setToolMode('pencil')
      } else if (
        selectedIds.length > 0 &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
      ) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : config.snapToGrid ? config.gridSize : 1
        let dx = 0
        let dy = 0
        if (e.key === 'ArrowLeft') dx = -step
        if (e.key === 'ArrowRight') dx = step
        if (e.key === 'ArrowUp') dy = -step
        if (e.key === 'ArrowDown') dy = step

        const next = shapes.map((s) => {
          if (selectedIds.includes(s.id)) {
            return { ...s, x: s.x + dx, y: s.y + dy }
          }
          return s
        })
        updateShapes(next, true)
      } else if (e.key === 'Escape') {
        setSelectedIds([])
        setToolMode('select')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedIds,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleUndo,
    handleRedo,
    shapes,
    updateShapes,
    config
  ])

  // Canvas background pointer down -> Start Marquee Selection or Pencil Drawing
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const canvasX = (e.clientX - rect.left) / zoom
      const canvasY = (e.clientY - rect.top) / zoom

      if (toolMode === 'pencil') {
        setPencilPoints([{ x: canvasX, y: canvasY }])
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        return
      }

      setIsMarquee(true)
      setMarqueeStart({ x: canvasX, y: canvasY })
      setMarqueeCurrent({ x: canvasX, y: canvasY })

      if (!e.shiftKey) {
        setSelectedIds([])
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
  }

  // Mouse drag & resize handlers on shapes
  const handlePointerDown = (e: React.PointerEvent, shapeId: string, handle?: string) => {
    if (toolMode === 'pencil') {
      handleCanvasPointerDown(e)
      return
    }

    e.stopPropagation()
    const targetShape = shapes.find((s) => s.id === shapeId)
    if (!targetShape) return

    let activeIds = selectedIds
    if (e.shiftKey) {
      if (selectedIds.includes(shapeId)) {
        activeIds = selectedIds.filter((id) => id !== shapeId)
      } else {
        activeIds = [...selectedIds, shapeId]
      }
      setSelectedIds(activeIds)
    } else {
      if (!selectedIds.includes(shapeId)) {
        activeIds = [shapeId]
        setSelectedIds(activeIds)
      }
    }

    const activeShapes = shapes.filter((s) => activeIds.includes(s.id))

    setIsDragging(true)
    setDragHandle(handle || 'body')
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      primaryX: targetShape.x,
      primaryY: targetShape.y,
      primaryW: targetShape.width,
      primaryH: targetShape.height,
      rotation: targetShape.rotation,
      shapePositions: activeShapes.map((s) => ({
        id: s.id,
        x: s.x,
        y: s.y,
        w: s.width,
        h: s.height
      }))
    })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    // Freehand Pencil Drawing
    if (toolMode === 'pencil' && pencilPoints.length > 0 && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const currentX = (e.clientX - rect.left) / zoom
      const currentY = (e.clientY - rect.top) / zoom
      setPencilPoints((prev) => [...prev, { x: currentX, y: currentY }])
      return
    }

    // Marquee Selection dragging
    if (isMarquee && marqueeStart && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect()
      const currentX = (e.clientX - rect.left) / zoom
      const currentY = (e.clientY - rect.top) / zoom
      setMarqueeCurrent({ x: currentX, y: currentY })

      const minX = Math.min(marqueeStart.x, currentX)
      const maxX = Math.max(marqueeStart.x, currentX)
      const minY = Math.min(marqueeStart.y, currentY)
      const maxY = Math.max(marqueeStart.y, currentY)

      const intersected = shapes
        .filter((s) => {
          return s.x < maxX && s.x + s.width > minX && s.y < maxY && s.y + s.height > minY
        })
        .map((s) => s.id)

      setSelectedIds((prev) =>
        e.shiftKey ? Array.from(new Set([...prev, ...intersected])) : intersected
      )
      return
    }

    if (!isDragging || !dragStart || selectedShapes.length === 0) return

    const deltaX = (e.clientX - dragStart.mouseX) / zoom
    const deltaY = (e.clientY - dragStart.mouseY) / zoom

    if (dragHandle === 'body') {
      const updated = shapes.map((s) => {
        const init = dragStart.shapePositions.find((p) => p.id === s.id)
        if (!init) return s
        const nextX = snapCoordinate(init.x + deltaX, config.gridSize, config.snapToGrid)
        const nextY = snapCoordinate(init.y + deltaY, config.gridSize, config.snapToGrid)
        return { ...s, x: nextX, y: nextY }
      })
      updateShapes(updated, false)
    } else if (dragHandle === 'se') {
      const nextW = Math.max(
        10,
        snapCoordinate(dragStart.primaryW + deltaX, config.gridSize, config.snapToGrid)
      )
      const nextH = Math.max(
        10,
        snapCoordinate(dragStart.primaryH + deltaY, config.gridSize, config.snapToGrid)
      )
      handleUpdateSelected({ width: nextW, height: nextH }, false)
    } else if (dragHandle === 'e') {
      const nextW = Math.max(
        10,
        snapCoordinate(dragStart.primaryW + deltaX, config.gridSize, config.snapToGrid)
      )
      handleUpdateSelected({ width: nextW }, false)
    } else if (dragHandle === 's') {
      const nextH = Math.max(
        10,
        snapCoordinate(dragStart.primaryH + deltaY, config.gridSize, config.snapToGrid)
      )
      handleUpdateSelected({ height: nextH }, false)
    } else if (dragHandle === 'nw') {
      const nextW = Math.max(
        10,
        snapCoordinate(dragStart.primaryW - deltaX, config.gridSize, config.snapToGrid)
      )
      const nextH = Math.max(
        10,
        snapCoordinate(dragStart.primaryH - deltaY, config.gridSize, config.snapToGrid)
      )
      const nextX = snapCoordinate(
        dragStart.primaryX + (dragStart.primaryW - nextW),
        config.gridSize,
        config.snapToGrid
      )
      const nextY = snapCoordinate(
        dragStart.primaryY + (dragStart.primaryH - nextH),
        config.gridSize,
        config.snapToGrid
      )
      handleUpdateSelected({ x: nextX, y: nextY, width: nextW, height: nextH }, false)
    } else if (dragHandle === 'ne') {
      const nextW = Math.max(
        10,
        snapCoordinate(dragStart.primaryW + deltaX, config.gridSize, config.snapToGrid)
      )
      const nextH = Math.max(
        10,
        snapCoordinate(dragStart.primaryH - deltaY, config.gridSize, config.snapToGrid)
      )
      const nextY = snapCoordinate(
        dragStart.primaryY + (dragStart.primaryH - nextH),
        config.gridSize,
        config.snapToGrid
      )
      handleUpdateSelected({ y: nextY, width: nextW, height: nextH }, false)
    } else if (dragHandle === 'sw') {
      const nextW = Math.max(
        10,
        snapCoordinate(dragStart.primaryW - deltaX, config.gridSize, config.snapToGrid)
      )
      const nextH = Math.max(
        10,
        snapCoordinate(dragStart.primaryH + deltaY, config.gridSize, config.snapToGrid)
      )
      const nextX = snapCoordinate(
        dragStart.primaryX + (dragStart.primaryW - nextW),
        config.gridSize,
        config.snapToGrid
      )
      handleUpdateSelected({ x: nextX, width: nextW, height: nextH }, false)
    } else if (dragHandle === 'n') {
      const nextH = Math.max(
        10,
        snapCoordinate(dragStart.primaryH - deltaY, config.gridSize, config.snapToGrid)
      )
      const nextY = snapCoordinate(
        dragStart.primaryY + (dragStart.primaryH - nextH),
        config.gridSize,
        config.snapToGrid
      )
      handleUpdateSelected({ y: nextY, height: nextH }, false)
    } else if (dragHandle === 'w') {
      const nextW = Math.max(
        10,
        snapCoordinate(dragStart.primaryW - deltaX, config.gridSize, config.snapToGrid)
      )
      const nextX = snapCoordinate(
        dragStart.primaryX + (dragStart.primaryW - nextW),
        config.gridSize,
        config.snapToGrid
      )
      handleUpdateSelected({ x: nextX, width: nextW }, false)
    } else if (dragHandle === 'rotate') {
      const cx = dragStart.primaryX + dragStart.primaryW / 2
      const cy = dragStart.primaryY + dragStart.primaryH / 2
      const mouseCanvasX = (e.clientX - (svgRef.current?.getBoundingClientRect().left ?? 0)) / zoom
      const mouseCanvasY = (e.clientY - (svgRef.current?.getBoundingClientRect().top ?? 0)) / zoom
      const angle = (Math.atan2(mouseCanvasY - cy, mouseCanvasX - cx) * 180) / Math.PI + 90
      const normalized = (Math.round(angle) + 360) % 360
      handleUpdateSelected({ rotation: normalized }, false)
    }
  }

  const handlePointerUp = () => {
    // Finish Pencil Drawing
    if (toolMode === 'pencil' && pencilPoints.length > 1) {
      const minX = Math.min(...pencilPoints.map((p) => p.x))
      const maxX = Math.max(...pencilPoints.map((p) => p.x))
      const minY = Math.min(...pencilPoints.map((p) => p.y))
      const maxY = Math.max(...pencilPoints.map((p) => p.y))
      const width = Math.max(10, maxX - minX)
      const height = Math.max(10, maxY - minY)

      let d = `M ${roundTo(pencilPoints[0].x - minX, 1)} ${roundTo(pencilPoints[0].y - minY, 1)}`
      for (let i = 1; i < pencilPoints.length - 1; i++) {
        const xc = (pencilPoints[i].x + pencilPoints[i + 1].x) / 2 - minX
        const yc = (pencilPoints[i].y + pencilPoints[i + 1].y) / 2 - minY
        d += ` Q ${roundTo(pencilPoints[i].x - minX, 1)} ${roundTo(pencilPoints[i].y - minY, 1)}, ${roundTo(xc, 1)} ${roundTo(yc, 1)}`
      }
      const last = pencilPoints[pencilPoints.length - 1]
      d += ` L ${roundTo(last.x - minX, 1)} ${roundTo(last.y - minY, 1)}`

      const newShape = createDefaultShape('freehand', config, {
        name: 'Brush Stroke',
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(width),
        height: Math.round(height),
        pathData: d,
        fill: 'none',
        stroke: '#f59e0b',
        strokeWidth: 4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
      })

      updateShapes([...shapes, newShape])
      setSelectedIds([newShape.id])
      setPencilPoints([])
      return
    }
    setPencilPoints([])

    if (isMarquee) {
      setIsMarquee(false)
      setMarqueeStart(null)
      setMarqueeCurrent(null)
    }
    if (isDragging) {
      setIsDragging(false)
      setDragHandle(null)
      setDragStart(null)
      // Commit final position to history
      updateShapes(shapes, true)
    }
  }

  // Code generation outputs
  const svgOutput = useMemo(() => generateSvgString(config, shapes), [config, shapes])
  const reactComponentOutput = useMemo(
    () => generateReactComponent(config, shapes, 'CustomVectorIcon'),
    [config, shapes]
  )

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(svgOutput)
      setCopiedCode(true)
      toastSuccess('SVG code copied to clipboard')
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      toastError('Failed to copy SVG code')
    }
  }

  const handleCopyComponent = async () => {
    try {
      await navigator.clipboard.writeText(reactComponentOutput)
      setCopiedComponent(true)
      toastSuccess('React component copied to clipboard')
      setTimeout(() => setCopiedComponent(false), 2000)
    } catch {
      toastError('Failed to copy React component')
    }
  }

  const handleExportFile = async () => {
    setExporting(true)
    try {
      const defaultName = `vector-${config.width}x${config.height}.${exportFormat}`
      const saveRes = await window.stash.dialogs.saveFile({
        title: `Export as ${exportFormat.toUpperCase()}`,
        defaultName,
        filters: [{ name: `${exportFormat.toUpperCase()} File`, extensions: [exportFormat] }]
      })

      if (saveRes.cancelled || !saveRes.path) return

      if (exportFormat === 'svg') {
        await window.stash.fs.writeTextFile({
          path: saveRes.path,
          content: svgOutput
        })
      } else {
        const mime =
          exportFormat === 'png'
            ? 'image/png'
            : exportFormat === 'webp'
              ? 'image/webp'
              : 'image/jpeg'
        const blob = await rasterizeSvgToBlob(
          svgOutput,
          config.width,
          config.height,
          exportScale,
          mime
        )
        const arrayBuffer = await blob.arrayBuffer()
        await window.stash.fs.writeFileBytes(saveRes.path, arrayBuffer)
      }

      toastSuccess(`Exported to ${defaultName}`)
      recordHistoryQuietly({
        toolId: 'svg-creator',
        operation: `Export Vector (${exportFormat.toUpperCase()})`,
        inputs: [`${config.width}x${config.height}`],
        outputs: [saveRes.path],
        status: 'success'
      })
    } catch (err) {
      toastError(err)
    } finally {
      setExporting(false)
    }
  }

  // Filtered preset icons for the Icon Library modal
  const filteredIcons = useMemo(() => {
    return PRESET_ICONS.filter((icon) => {
      const matchesCat = iconCategoryFilter === 'all' || icon.category === iconCategoryFilter
      const matchesQuery =
        !iconSearchQuery || icon.name.toLowerCase().includes(iconSearchQuery.toLowerCase())
      return matchesCat && matchesQuery
    })
  }, [iconCategoryFilter, iconSearchQuery])

  return (
    <div className="flex flex-col gap-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface/80 px-3.5 py-2 text-[12px] text-dim">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-amber-400 tracking-wider uppercase">
            BETA
          </span>

          {/* Preset Canvas Sizing */}
          <select
            value={`${config.width}x${config.height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number)
              if (w && h) setConfig((c) => ({ ...c, width: w, height: h }))
            }}
            className="rounded border border-line bg-base px-2 py-1 text-[11.5px] text-ink focus:border-accent focus:outline-none"
          >
            {CANVAS_PRESETS.map((preset) => (
              <option key={preset.id} value={`${preset.width}x${preset.height}`}>
                {preset.label}
              </option>
            ))}
          </select>

          <span className="text-faint">·</span>

          {/* Width x Height inputs */}
          <div className="flex items-center gap-1 font-mono text-[11px]">
            <input
              type="number"
              value={config.width}
              min={16}
              max={4096}
              onChange={(e) =>
                setConfig((c) => ({ ...c, width: Math.max(16, Number(e.target.value)) }))
              }
              className="w-14 rounded border border-line bg-base px-1.5 py-0.5 text-center text-ink"
              title="Canvas Width"
            />
            <span className="text-faint">×</span>
            <input
              type="number"
              value={config.height}
              min={16}
              max={4096}
              onChange={(e) =>
                setConfig((c) => ({ ...c, height: Math.max(16, Number(e.target.value)) }))
              }
              className="w-14 rounded border border-line bg-base px-1.5 py-0.5 text-center text-ink"
              title="Canvas Height"
            />
            <span className="text-faint">px</span>
          </div>

          <span className="text-faint">·</span>

          {/* Background selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-faint">BG:</span>
            <input
              type="color"
              value={config.background === 'transparent' ? '#000000' : config.background}
              onChange={(e) => setConfig((c) => ({ ...c, background: e.target.value }))}
              className="h-6 w-6 rounded border border-line cursor-pointer bg-transparent"
              title="Canvas Background Color"
            />
            <button
              type="button"
              onClick={() =>
                setConfig((c) => ({
                  ...c,
                  background: c.background === 'transparent' ? '#0f172a' : 'transparent'
                }))
              }
              className="px-1.5 py-0.5 rounded border border-line bg-base text-[11px] text-faint hover:text-ink cursor-pointer"
            >
              {config.background === 'transparent' ? 'Solid' : 'Clear'}
            </button>
          </div>
        </div>

        {/* Right Action Icons (Grid, Undo, Redo, Zoom) */}
        <div className="flex items-center gap-1.5">
          <IconButton
            aria-label="Toggle Grid Lines"
            title="Toggle Grid Lines"
            onClick={() => setConfig((c) => ({ ...c, showGrid: !c.showGrid }))}
            className={config.showGrid ? 'text-accent bg-surface' : ''}
          >
            <Grid size={14} />
          </IconButton>

          <IconButton
            aria-label="Snap to Grid"
            title={`Snap to Grid (${config.gridSize}px)`}
            onClick={() => setConfig((c) => ({ ...c, snapToGrid: !c.snapToGrid }))}
            className={config.snapToGrid ? 'text-accent bg-surface' : ''}
          >
            <div className="relative">
              <Grid size={14} />
              <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 rounded-full bg-accent" />
            </div>
          </IconButton>

          <div className="h-4 w-px bg-line/60 mx-1" />

          <IconButton
            aria-label="Undo Action"
            title="Undo (Ctrl+Z)"
            disabled={historyIndex <= 0}
            onClick={handleUndo}
          >
            <Undo2 size={14} />
          </IconButton>

          <IconButton
            aria-label="Redo Action"
            title="Redo (Ctrl+Y)"
            disabled={historyIndex >= history.length - 1}
            onClick={handleRedo}
          >
            <Redo2 size={14} />
          </IconButton>

          <div className="h-4 w-px bg-line/60 mx-1" />

          {/* Zoom controls */}
          <div className="flex items-center rounded border border-line bg-base">
            <IconButton
              aria-label="Zoom Out"
              title="Zoom Out"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              size="sm"
            >
              <ZoomOut size={12} />
            </IconButton>
            <span className="font-mono text-[11px] px-1 text-ink">{Math.round(zoom * 100)}%</span>
            <IconButton
              aria-label="Zoom In"
              title="Zoom In"
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              size="sm"
            >
              <ZoomIn size={12} />
            </IconButton>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-1 text-[10px] text-faint hover:text-ink cursor-pointer border-l border-line"
              title="Reset Zoom"
            >
              100%
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Workstation Layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Shape Palette (1 column on large screens) */}
        <div className="lg:col-span-1 flex flex-row lg:flex-col items-center justify-start gap-1 rounded-md border border-line bg-surface/60 p-1.5 overflow-x-auto max-h-[720px] overflow-y-auto">
          {/* Tool Modes: Select & Pencil */}
          <div className="flex lg:flex-col gap-1 w-full pb-1 border-b border-line/40">
            <IconButton
              aria-label="Select & Move tool"
              title="Select & Move (V)"
              onClick={() => setToolMode('select')}
              className={toolMode === 'select' ? 'text-accent bg-surface shadow-xs' : ''}
            >
              <Move size={15} />
            </IconButton>

            <IconButton
              aria-label="Freehand Pencil Tool"
              title="Freehand Pencil (P)"
              onClick={() => {
                setToolMode('pencil')
                setSelectedIds([])
              }}
              className={toolMode === 'pencil' ? 'text-accent bg-surface shadow-xs' : ''}
            >
              <PenTool size={15} />
            </IconButton>
          </div>

          {/* Geometric Shapes */}
          <IconButton
            aria-label="Add Rectangle"
            title="Rectangle"
            onClick={() => handleAddShape('rect')}
          >
            <Square size={15} />
          </IconButton>

          <IconButton
            aria-label="Add Rounded Rectangle"
            title="Rounded Rectangle"
            onClick={() => handleAddShape('rect', { cornerRadius: 20 })}
          >
            <div className="w-3.5 h-3.5 border-2 border-current rounded-sm" />
          </IconButton>

          <IconButton
            aria-label="Add Circle"
            title="Circle / Ellipse"
            onClick={() => handleAddShape('circle')}
          >
            <Circle size={15} />
          </IconButton>

          <IconButton
            aria-label="Add Triangle"
            title="Triangle"
            onClick={() => handleAddShape('triangle')}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="12,2 22,22 2,22" />
            </svg>
          </IconButton>

          <IconButton
            aria-label="Add Polygon"
            title="Polygon (Hexagon / N-sided)"
            onClick={() => handleAddShape('polygon', { pointsCount: 6 })}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" />
            </svg>
          </IconButton>

          <IconButton
            aria-label="Add Star"
            title="Star / Badge"
            onClick={() => handleAddShape('star')}
          >
            <Star size={15} />
          </IconButton>

          <IconButton
            aria-label="Add Heart"
            title="Heart"
            onClick={() => handleAddShape('heart', { fill: '#ec4899' })}
          >
            <Heart size={15} />
          </IconButton>

          <IconButton
            aria-label="Add Speech Bubble"
            title="Callout / Speech Bubble"
            onClick={() => handleAddShape('speech-bubble')}
          >
            <MessageSquare size={15} />
          </IconButton>

          <IconButton
            aria-label="Add Shield"
            title="Shield Crest"
            onClick={() => handleAddShape('shield')}
          >
            <Shield size={15} />
          </IconButton>

          <IconButton
            aria-label="Add Cross Plus"
            title="Cross / Plus"
            onClick={() => handleAddShape('plus')}
          >
            <Plus size={15} />
          </IconButton>

          <IconButton
            aria-label="Add Ring Donut"
            title="Hollow Ring / Donut"
            onClick={() => handleAddShape('ring')}
          >
            <Disc size={15} />
          </IconButton>

          <div className="hidden lg:block w-full border-b border-line/40 my-1" />

          {/* Connectors & Lines */}
          <IconButton aria-label="Add Arrow" title="Arrow" onClick={() => handleAddShape('arrow')}>
            <ArrowRight size={15} />
          </IconButton>

          <IconButton
            aria-label="Add Double Arrow"
            title="Double-Headed Arrow"
            onClick={() => handleAddShape('double-arrow')}
          >
            <ArrowLeftRight size={15} />
          </IconButton>

          <IconButton aria-label="Add Line" title="Line" onClick={() => handleAddShape('line')}>
            <Minus size={15} />
          </IconButton>

          <IconButton
            aria-label="Add Text"
            title="Text Label (T)"
            onClick={() => handleAddShape('text')}
          >
            <Type size={15} />
          </IconButton>

          <div className="hidden lg:block w-full border-b border-line/40 my-1" />

          {/* Custom SVG Path / Code Insert */}
          <IconButton
            aria-label="Insert Custom SVG Path"
            title="Paste Custom SVG Path"
            onClick={() => setShowCustomPathModal(true)}
            className="text-amber-400 hover:text-amber-300"
          >
            <Code2 size={15} />
          </IconButton>

          {/* Full Icon Library Modal Drawer */}
          <IconButton
            aria-label="Browse Vector Icons Library"
            title="Icon Library (40+ Vector Glyphs)"
            onClick={() => setShowIconLibraryModal(true)}
            className="text-accent hover:text-accent-hover"
          >
            <Sparkles size={15} />
          </IconButton>
        </div>

        {/* Center Interactive Vector Stage */}
        <div className="lg:col-span-8 flex flex-col items-center justify-center rounded-md border border-line bg-base/80 p-4 min-h-[620px] max-h-[720px] overflow-auto relative select-none">
          {/* Canvas Wrapper */}
          <div
            style={{
              width: config.width * zoom,
              height: config.height * zoom,
              boxShadow: '0 0 30px -5px rgba(0,0,0,0.6)'
            }}
            className={`relative transition-all duration-75 border border-line-strong rounded-sm overflow-hidden bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] ${
              toolMode === 'pencil' ? 'cursor-crosshair' : 'cursor-default'
            }`}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${config.width} ${config.height}`}
              width="100%"
              height="100%"
              style={{
                backgroundColor: config.background !== 'transparent' ? config.background : undefined
              }}
              className="overflow-visible block"
            >
              {/* Optional Grid Lines Overlay */}
              {config.showGrid && (
                <defs>
                  <pattern
                    id="grid-pattern"
                    width={config.gridSize}
                    height={config.gridSize}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${config.gridSize} 0 L 0 0 0 ${config.gridSize}`}
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>
              )}

              {config.showGrid && (
                <rect
                  id="grid-rect"
                  width="100%"
                  height="100%"
                  fill="url(#grid-pattern)"
                  pointerEvents="none"
                />
              )}

              {/* Rendered Vector Shapes */}
              {shapes.map((shape) => {
                const isSelected = selectedIds.includes(shape.id)
                const {
                  type,
                  x,
                  y,
                  width,
                  height,
                  rotation,
                  fill,
                  stroke,
                  strokeWidth,
                  strokeDasharray,
                  strokeLinecap,
                  strokeLinejoin,
                  opacity,
                  cornerRadius,
                  pointsCount,
                  innerRadiusRatio,
                  thicknessRatio,
                  pathData,
                  text,
                  fontSize,
                  fontFamily,
                  fontWeight,
                  textAlign,
                  iconPath,
                  viewBoxSize = 24
                } = shape

                return (
                  <g
                    key={shape.id}
                    transform={
                      rotation
                        ? `rotate(${rotation} ${x + width / 2} ${y + height / 2})`
                        : undefined
                    }
                    opacity={opacity}
                    onPointerDown={(e) => handlePointerDown(e, shape.id, 'body')}
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                    className="cursor-move group"
                  >
                    {type === 'rect' && (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        rx={cornerRadius || 0}
                        fill={fill}
                        stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDasharray}
                        strokeLinecap={strokeLinecap}
                        strokeLinejoin={strokeLinejoin}
                      />
                    )}

                    {type === 'circle' && (
                      <circle
                        cx={x + width / 2}
                        cy={y + height / 2}
                        r={Math.min(width, height) / 2}
                        fill={fill}
                        stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                        strokeWidth={strokeWidth}
                      />
                    )}

                    {type === 'ellipse' && (
                      <ellipse
                        cx={x + width / 2}
                        cy={y + height / 2}
                        rx={width / 2}
                        ry={height / 2}
                        fill={fill}
                        stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                        strokeWidth={strokeWidth}
                      />
                    )}

                    {type === 'triangle' && (
                      <polygon
                        points={`${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`}
                        fill={fill}
                        stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                        strokeWidth={strokeWidth}
                      />
                    )}

                    {type === 'star' && (
                      <g transform={`translate(${x}, ${y})`}>
                        <polygon
                          points={getStarPoints(
                            width,
                            height,
                            pointsCount || 5,
                            innerRadiusRatio || 0.4
                          )}
                          fill={fill}
                          stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                          strokeWidth={strokeWidth}
                        />
                      </g>
                    )}

                    {type === 'polygon' && (
                      <g transform={`translate(${x}, ${y})`}>
                        <polygon
                          points={getPolygonPoints(width, height, pointsCount || 6)}
                          fill={fill}
                          stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                          strokeWidth={strokeWidth}
                        />
                      </g>
                    )}

                    {type === 'heart' && (
                      <g transform={`translate(${x}, ${y})`}>
                        <path
                          d={getHeartPath(width, height)}
                          fill={fill}
                          stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                          strokeWidth={strokeWidth}
                        />
                      </g>
                    )}

                    {type === 'speech-bubble' && (
                      <g transform={`translate(${x}, ${y})`}>
                        <path
                          d={getSpeechBubblePath(width, height, cornerRadius || 8)}
                          fill={fill}
                          stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                          strokeWidth={strokeWidth}
                        />
                      </g>
                    )}

                    {type === 'shield' && (
                      <g transform={`translate(${x}, ${y})`}>
                        <path
                          d={getShieldPath(width, height)}
                          fill={fill}
                          stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                          strokeWidth={strokeWidth}
                        />
                      </g>
                    )}

                    {type === 'ring' && (
                      <g transform={`translate(${x}, ${y})`}>
                        <path
                          d={getRingPath(width, height, innerRadiusRatio || 0.6)}
                          fillRule="evenodd"
                          fill={fill}
                          stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                          strokeWidth={strokeWidth}
                        />
                      </g>
                    )}

                    {type === 'plus' && (
                      <g transform={`translate(${x}, ${y})`}>
                        <polygon
                          points={getPlusPoints(width, height, thicknessRatio || 0.35)}
                          fill={fill}
                          stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                          strokeWidth={strokeWidth}
                        />
                      </g>
                    )}

                    {type === 'arrow' && (
                      <path
                        d={`M ${x} ${y + height / 2 - Math.max(2, strokeWidth) / 2} L ${
                          x + width - Math.min(24, Math.max(12, height))
                        } ${y + height / 2 - Math.max(2, strokeWidth) / 2} L ${
                          x + width - Math.min(24, Math.max(12, height))
                        } ${y} L ${x + width} ${y + height / 2} L ${
                          x + width - Math.min(24, Math.max(12, height))
                        } ${y + height} L ${x + width - Math.min(24, Math.max(12, height))} ${
                          y + height / 2 + Math.max(2, strokeWidth) / 2
                        } L ${x} ${y + height / 2 + Math.max(2, strokeWidth) / 2} Z`}
                        fill={fill}
                        stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                        strokeWidth={strokeWidth}
                      />
                    )}

                    {type === 'double-arrow' && (
                      <g transform={`translate(${x}, ${y})`}>
                        <path
                          d={getDoubleArrowPath(width, height, strokeWidth || 2)}
                          fill={fill}
                          stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                          strokeWidth={strokeWidth}
                        />
                      </g>
                    )}

                    {type === 'freehand' && (
                      <g transform={`translate(${x}, ${y})`}>
                        <path
                          d={pathData || ''}
                          fill={fill}
                          stroke={stroke !== 'none' ? stroke : '#f59e0b'}
                          strokeWidth={strokeWidth || 3}
                          strokeLinecap={strokeLinecap || 'round'}
                          strokeLinejoin={strokeLinejoin || 'round'}
                        />
                      </g>
                    )}

                    {type === 'line' && (
                      <line
                        x1={x}
                        y1={y}
                        x2={x + width}
                        y2={y + height}
                        stroke={stroke !== 'none' ? stroke : fill}
                        strokeWidth={Math.max(1, strokeWidth)}
                        strokeLinecap={strokeLinecap || 'round'}
                        strokeDasharray={strokeDasharray}
                      />
                    )}

                    {type === 'text' && (
                      <text
                        x={
                          textAlign === 'center'
                            ? x + width / 2
                            : textAlign === 'right'
                              ? x + width
                              : x
                        }
                        y={y + height / 2 + (fontSize || 24) * 0.35}
                        fontFamily={fontFamily || 'sans-serif'}
                        fontSize={fontSize || 24}
                        fontWeight={fontWeight || 'normal'}
                        textAnchor={
                          textAlign === 'center'
                            ? 'middle'
                            : textAlign === 'right'
                              ? 'end'
                              : 'start'
                        }
                        fill={fill}
                        stroke={stroke !== 'none' && strokeWidth > 0 ? stroke : undefined}
                        strokeWidth={strokeWidth}
                      >
                        {text || 'Text'}
                      </text>
                    )}

                    {type === 'preset-icon' && (
                      <g
                        transform={`translate(${x}, ${y}) scale(${width / viewBoxSize}, ${
                          height / viewBoxSize
                        })`}
                      >
                        <path d={iconPath || ''} fill={fill} />
                      </g>
                    )}

                    {/* Interactive Selection Box and Drag Handles */}
                    {isSelected && (
                      <g>
                        {/* Bounding Box Outline */}
                        <rect
                          x={x - 2}
                          y={y - 2}
                          width={width + 4}
                          height={height + 4}
                          fill="none"
                          stroke="var(--color-accent, #f59e0b)"
                          strokeWidth="1.5"
                          strokeDasharray={selectedIds.length > 1 ? '5 3' : '4 4'}
                          pointerEvents="none"
                        />

                        {/* If single selection: render full 8-point handles + rotation handle */}
                        {selectedIds.length === 1 && (
                          <>
                            {/* 4 Corner Handles */}
                            {/* NW */}
                            <circle
                              cx={x}
                              cy={y}
                              r="4.5"
                              fill="var(--color-accent, #f59e0b)"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="pointer-events-auto cursor-nwse-resize"
                              onPointerDown={(e) => handlePointerDown(e, shape.id, 'nw')}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {/* NE */}
                            <circle
                              cx={x + width}
                              cy={y}
                              r="4.5"
                              fill="var(--color-accent, #f59e0b)"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="pointer-events-auto cursor-nesw-resize"
                              onPointerDown={(e) => handlePointerDown(e, shape.id, 'ne')}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {/* SE */}
                            <circle
                              cx={x + width}
                              cy={y + height}
                              r="4.5"
                              fill="var(--color-accent, #f59e0b)"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="pointer-events-auto cursor-nwse-resize"
                              onPointerDown={(e) => handlePointerDown(e, shape.id, 'se')}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {/* SW */}
                            <circle
                              cx={x}
                              cy={y + height}
                              r="4.5"
                              fill="var(--color-accent, #f59e0b)"
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="pointer-events-auto cursor-nesw-resize"
                              onPointerDown={(e) => handlePointerDown(e, shape.id, 'sw')}
                              onClick={(e) => e.stopPropagation()}
                            />

                            {/* 4 Midpoint Edge Handles */}
                            {/* N */}
                            <circle
                              cx={x + width / 2}
                              cy={y}
                              r="3.5"
                              fill="#ffffff"
                              stroke="var(--color-accent, #f59e0b)"
                              strokeWidth="1.5"
                              className="pointer-events-auto cursor-ns-resize"
                              onPointerDown={(e) => handlePointerDown(e, shape.id, 'n')}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {/* S */}
                            <circle
                              cx={x + width / 2}
                              cy={y + height}
                              r="3.5"
                              fill="#ffffff"
                              stroke="var(--color-accent, #f59e0b)"
                              strokeWidth="1.5"
                              className="pointer-events-auto cursor-ns-resize"
                              onPointerDown={(e) => handlePointerDown(e, shape.id, 's')}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {/* E */}
                            <circle
                              cx={x + width}
                              cy={y + height / 2}
                              r="3.5"
                              fill="#ffffff"
                              stroke="var(--color-accent, #f59e0b)"
                              strokeWidth="1.5"
                              className="pointer-events-auto cursor-ew-resize"
                              onPointerDown={(e) => handlePointerDown(e, shape.id, 'e')}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {/* W */}
                            <circle
                              cx={x}
                              cy={y + height / 2}
                              r="3.5"
                              fill="#ffffff"
                              stroke="var(--color-accent, #f59e0b)"
                              strokeWidth="1.5"
                              className="pointer-events-auto cursor-ew-resize"
                              onPointerDown={(e) => handlePointerDown(e, shape.id, 'w')}
                              onClick={(e) => e.stopPropagation()}
                            />

                            {/* Rotation Handle Top */}
                            <line
                              x1={x + width / 2}
                              y1={y}
                              x2={x + width / 2}
                              y2={y - 18}
                              stroke="var(--color-accent, #f59e0b)"
                              strokeWidth="1"
                            />
                            <circle
                              cx={x + width / 2}
                              cy={y - 18}
                              r="4.5"
                              fill="#ffffff"
                              stroke="var(--color-accent, #f59e0b)"
                              strokeWidth="1.5"
                              className="pointer-events-auto cursor-grab"
                              onPointerDown={(e) => handlePointerDown(e, shape.id, 'rotate')}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </>
                        )}
                      </g>
                    )}
                  </g>
                )
              })}

              {/* Active Pencil Live Preview */}
              {toolMode === 'pencil' && pencilPoints.length > 1 && (
                <path
                  d={pencilPoints.reduce(
                    (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`,
                    ''
                  )}
                  fill="none"
                  stroke="var(--color-accent, #f59e0b)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              )}

              {/* Marquee (Drag Selection) Box */}
              {isMarquee && marqueeStart && marqueeCurrent && (
                <rect
                  x={Math.min(marqueeStart.x, marqueeCurrent.x)}
                  y={Math.min(marqueeStart.y, marqueeCurrent.y)}
                  width={Math.abs(marqueeCurrent.x - marqueeStart.x)}
                  height={Math.abs(marqueeCurrent.y - marqueeStart.y)}
                  fill="rgba(245, 158, 11, 0.15)"
                  stroke="var(--color-accent, #f59e0b)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  pointerEvents="none"
                />
              )}
            </svg>
          </div>

          {/* Bottom Canvas HUD */}
          <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[10.5px] font-mono text-faint pointer-events-none">
            <span>
              Canvas: {config.width}×{config.height}px · {shapes.length} layer
              {shapes.length === 1 ? '' : 's'}
              {toolMode === 'pencil' && (
                <span className="text-accent ml-2 font-sans font-semibold">
                  ✎ Freehand Pencil Active (Click and drag to draw)
                </span>
              )}
            </span>
            {selectedShapes.length === 1 && primarySelected && (
              <span>
                Selected: {primarySelected.name} (X: {Math.round(primarySelected.x)}, Y:{' '}
                {Math.round(primarySelected.y)}, W: {Math.round(primarySelected.width)}, H:{' '}
                {Math.round(primarySelected.height)})
              </span>
            )}
            {selectedShapes.length > 1 && (
              <span className="text-accent font-medium">
                {selectedShapes.length} shapes selected (Shift+Click or drag to modify)
              </span>
            )}
          </div>
        </div>

        {/* Right Inspector & Code Studio Panel */}
        <div className="lg:col-span-3">
          <Panel className="flex flex-col h-[620px] p-3 space-y-3">
            {/* Top Segmented Tabs */}
            <div className="flex items-center rounded border border-line bg-base/60 p-0.5 text-[11.5px]">
              <button
                type="button"
                onClick={() => setActiveTab('style')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded transition-colors cursor-pointer ${
                  activeTab === 'style'
                    ? 'bg-surface text-accent font-medium shadow-xs'
                    : 'text-faint hover:text-ink'
                }`}
              >
                <Sliders size={13} /> Style
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('export')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded transition-colors cursor-pointer ${
                  activeTab === 'export'
                    ? 'bg-surface text-accent font-medium shadow-xs'
                    : 'text-faint hover:text-ink'
                }`}
              >
                <Braces size={13} /> Export & Code
              </button>
            </div>

            {activeTab === 'style' ? (
              /* Shape Style Inspector */
              selectedShapes.length > 1 ? (
                /* Multi-Shape Selection Inspector */
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-[12px]">
                  {/* Multi-Selection Header */}
                  <div className="flex items-center justify-between border-b border-line/50 pb-2">
                    <span className="font-semibold text-ink truncate">
                      {selectedShapes.length} Shapes Selected
                    </span>
                    <div className="flex items-center gap-1">
                      <IconButton
                        aria-label="Duplicate Selected Shapes"
                        title="Duplicate All (Ctrl+D)"
                        onClick={handleDuplicateSelected}
                        size="sm"
                      >
                        <Copy size={12} />
                      </IconButton>
                      <IconButton
                        aria-label="Delete Selected Shapes"
                        title="Delete All (Delete)"
                        onClick={handleDeleteSelected}
                        size="sm"
                        className="text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 size={12} />
                      </IconButton>
                    </div>
                  </div>

                  {/* Batch Alignment */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-faint uppercase font-medium">
                      Align Selection
                    </label>
                    <div className="flex items-center justify-between rounded border border-line bg-base/40 p-1">
                      <IconButton
                        aria-label="Align Left"
                        size="sm"
                        title="Align Left"
                        onClick={() => handleAlign('left')}
                      >
                        <AlignLeft size={13} />
                      </IconButton>
                      <IconButton
                        aria-label="Align Center"
                        size="sm"
                        title="Align Center"
                        onClick={() => handleAlign('center')}
                      >
                        <AlignCenter size={13} />
                      </IconButton>
                      <IconButton
                        aria-label="Align Right"
                        size="sm"
                        title="Align Right"
                        onClick={() => handleAlign('right')}
                      >
                        <AlignRight size={13} />
                      </IconButton>
                      <IconButton
                        aria-label="Align Top"
                        size="sm"
                        title="Align Top"
                        onClick={() => handleAlign('top')}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="2" y1="3" x2="22" y2="3" />
                          <rect x="7" y="8" width="10" height="12" rx="1" />
                        </svg>
                      </IconButton>
                      <IconButton
                        aria-label="Align Middle"
                        size="sm"
                        title="Align Middle"
                        onClick={() => handleAlign('middle')}
                      >
                        <AlignJustify size={13} />
                      </IconButton>
                      <IconButton
                        aria-label="Align Bottom"
                        size="sm"
                        title="Align Bottom"
                        onClick={() => handleAlign('bottom')}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="2" y1="21" x2="22" y2="21" />
                          <rect x="7" y="4" width="10" height="12" rx="1" />
                        </svg>
                      </IconButton>
                    </div>
                  </div>

                  {/* Batch Fill Swatches */}
                  <div className="space-y-1.5 border-t border-line/40 pt-2">
                    <label className="text-[11px] text-faint uppercase font-medium">
                      Batch Fill Color
                    </label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {SWATCH_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleUpdateSelected({ fill: color })}
                          style={{ backgroundColor: color === 'none' ? 'transparent' : color }}
                          className="h-5 w-5 rounded-full border border-line/80 cursor-pointer hover:scale-110 transition-transform"
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Batch Opacity Slider */}
                  <div className="space-y-1.5 border-t border-line/40 pt-2">
                    <label className="text-[11px] text-faint uppercase font-medium">
                      Batch Opacity
                    </label>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      defaultValue="1"
                      onChange={(e) => handleUpdateSelected({ opacity: Number(e.target.value) })}
                      className="w-full accent-accent"
                    />
                  </div>

                  {/* Selected Shapes List */}
                  <div className="space-y-1.5 border-t border-line/40 pt-2">
                    <label className="text-[11px] text-faint uppercase font-medium">
                      Selected Shapes
                    </label>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {selectedShapes.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded border border-line/40 bg-base/40 text-[11.5px]"
                        >
                          <span className="text-ink truncate">{s.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedIds((prev) => prev.filter((id) => id !== s.id))
                            }
                            className="text-faint hover:text-rose-400 cursor-pointer text-[11px]"
                            title="Remove from selection"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : primarySelected ? (
                /* Single Shape Inspector */
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-[12px]">
                  {/* Layer Actions Header */}
                  <div className="flex items-center justify-between border-b border-line/50 pb-2">
                    <span className="font-semibold text-ink truncate">{primarySelected.name}</span>
                    <div className="flex items-center gap-1">
                      <IconButton
                        aria-label="Duplicate Shape"
                        title="Duplicate (Ctrl+D)"
                        onClick={handleDuplicateSelected}
                        size="sm"
                      >
                        <Copy size={12} />
                      </IconButton>
                      <IconButton
                        aria-label="Delete Shape"
                        title="Delete (Delete)"
                        onClick={handleDeleteSelected}
                        size="sm"
                        className="text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 size={12} />
                      </IconButton>
                    </div>
                  </div>

                  {/* Alignment Row */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-faint uppercase font-medium">
                      Alignment
                    </label>
                    <div className="flex items-center justify-between rounded border border-line bg-base/40 p-1">
                      <IconButton
                        aria-label="Align Left"
                        size="sm"
                        title="Align Left"
                        onClick={() => handleAlign('left')}
                      >
                        <AlignLeft size={13} />
                      </IconButton>
                      <IconButton
                        aria-label="Align Center"
                        size="sm"
                        title="Align Center"
                        onClick={() => handleAlign('center')}
                      >
                        <AlignCenter size={13} />
                      </IconButton>
                      <IconButton
                        aria-label="Align Right"
                        size="sm"
                        title="Align Right"
                        onClick={() => handleAlign('right')}
                      >
                        <AlignRight size={13} />
                      </IconButton>
                      <IconButton
                        aria-label="Align Top"
                        size="sm"
                        title="Align Top"
                        onClick={() => handleAlign('top')}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="2" y1="3" x2="22" y2="3" />
                          <rect x="7" y="8" width="10" height="12" rx="1" />
                        </svg>
                      </IconButton>
                      <IconButton
                        aria-label="Align Middle"
                        size="sm"
                        title="Align Middle"
                        onClick={() => handleAlign('middle')}
                      >
                        <AlignJustify size={13} />
                      </IconButton>
                      <IconButton
                        aria-label="Align Bottom"
                        size="sm"
                        title="Align Bottom"
                        onClick={() => handleAlign('bottom')}
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="2" y1="21" x2="22" y2="21" />
                          <rect x="7" y="4" width="10" height="12" rx="1" />
                        </svg>
                      </IconButton>
                    </div>
                  </div>

                  {/* Dimensions & Rotation */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-faint uppercase font-medium">
                      Position & Size
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="flex items-center gap-1 rounded border border-line bg-base px-2 py-1">
                        <span className="text-faint">X</span>
                        <input
                          type="number"
                          value={Math.round(primarySelected.x)}
                          onChange={(e) => handleUpdateSelected({ x: Number(e.target.value) })}
                          className="w-full bg-transparent text-ink outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded border border-line bg-base px-2 py-1">
                        <span className="text-faint">Y</span>
                        <input
                          type="number"
                          value={Math.round(primarySelected.y)}
                          onChange={(e) => handleUpdateSelected({ y: Number(e.target.value) })}
                          className="w-full bg-transparent text-ink outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded border border-line bg-base px-2 py-1">
                        <span className="text-faint">W</span>
                        <input
                          type="number"
                          value={Math.round(primarySelected.width)}
                          min={2}
                          onChange={(e) =>
                            handleUpdateSelected({ width: Math.max(2, Number(e.target.value)) })
                          }
                          className="w-full bg-transparent text-ink outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded border border-line bg-base px-2 py-1">
                        <span className="text-faint">H</span>
                        <input
                          type="number"
                          value={Math.round(primarySelected.height)}
                          min={2}
                          onChange={(e) =>
                            handleUpdateSelected({ height: Math.max(2, Number(e.target.value)) })
                          }
                          className="w-full bg-transparent text-ink outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Polygon Specific: Number of Sides / Points */}
                  {primarySelected.type === 'polygon' && (
                    <div className="space-y-1.5 border-t border-line/40 pt-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-faint uppercase font-medium">Polygon Sides</span>
                        <span className="font-mono text-dim">
                          {primarySelected.pointsCount || 6} sides
                        </span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="16"
                        value={primarySelected.pointsCount || 6}
                        onChange={(e) =>
                          handleUpdateSelected({ pointsCount: Number(e.target.value) })
                        }
                        className="w-full accent-accent"
                      />
                    </div>
                  )}

                  {/* Star Specific: Points Count & Inner Radius */}
                  {primarySelected.type === 'star' && (
                    <div className="space-y-2 border-t border-line/40 pt-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-faint uppercase font-medium">Star Points</span>
                        <span className="font-mono text-dim">
                          {primarySelected.pointsCount || 5} points
                        </span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="24"
                        value={primarySelected.pointsCount || 5}
                        onChange={(e) =>
                          handleUpdateSelected({ pointsCount: Number(e.target.value) })
                        }
                        className="w-full accent-accent"
                      />
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-faint uppercase font-medium">Inner Ratio</span>
                        <span className="font-mono text-dim">
                          {Math.round((primarySelected.innerRadiusRatio || 0.4) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.9"
                        step="0.05"
                        value={primarySelected.innerRadiusRatio || 0.4}
                        onChange={(e) =>
                          handleUpdateSelected({ innerRadiusRatio: Number(e.target.value) })
                        }
                        className="w-full accent-accent"
                      />
                    </div>
                  )}

                  {/* Ring Specific: Inner Hole Ratio */}
                  {primarySelected.type === 'ring' && (
                    <div className="space-y-1.5 border-t border-line/40 pt-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-faint uppercase font-medium">Hole Ratio</span>
                        <span className="font-mono text-dim">
                          {Math.round((primarySelected.innerRadiusRatio || 0.6) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.9"
                        step="0.05"
                        value={primarySelected.innerRadiusRatio || 0.6}
                        onChange={(e) =>
                          handleUpdateSelected({ innerRadiusRatio: Number(e.target.value) })
                        }
                        className="w-full accent-accent"
                      />
                    </div>
                  )}

                  {/* Plus Specific: Arm Thickness Ratio */}
                  {primarySelected.type === 'plus' && (
                    <div className="space-y-1.5 border-t border-line/40 pt-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-faint uppercase font-medium">Arm Thickness</span>
                        <span className="font-mono text-dim">
                          {Math.round((primarySelected.thicknessRatio || 0.35) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.15"
                        max="0.75"
                        step="0.05"
                        value={primarySelected.thicknessRatio || 0.35}
                        onChange={(e) =>
                          handleUpdateSelected({ thicknessRatio: Number(e.target.value) })
                        }
                        className="w-full accent-accent"
                      />
                    </div>
                  )}

                  {/* Text Properties if text is selected */}
                  {primarySelected.type === 'text' && (
                    <div className="space-y-1.5 border-t border-line/40 pt-2">
                      <label className="text-[11px] text-faint uppercase font-medium">
                        Text Content
                      </label>
                      <input
                        type="text"
                        value={primarySelected.text || ''}
                        onChange={(e) => handleUpdateSelected({ text: e.target.value })}
                        className="w-full rounded border border-line bg-base px-2 py-1 text-ink text-[12px]"
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="number"
                          value={primarySelected.fontSize || 24}
                          min={8}
                          max={200}
                          onChange={(e) =>
                            handleUpdateSelected({ fontSize: Number(e.target.value) })
                          }
                          className="w-16 rounded border border-line bg-base px-1.5 py-1 text-center font-mono text-[11px]"
                          title="Font Size"
                        />
                        <select
                          value={primarySelected.fontWeight || 'normal'}
                          onChange={(e) => handleUpdateSelected({ fontWeight: e.target.value })}
                          className="flex-1 rounded border border-line bg-base px-2 py-1 text-[11px] text-ink"
                        >
                          <option value="normal">Normal</option>
                          <option value="bold">Bold</option>
                          <option value="600">Semi-Bold</option>
                          <option value="300">Light</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Corner Radius if rect or speech-bubble */}
                  {(primarySelected.type === 'rect' ||
                    primarySelected.type === 'speech-bubble') && (
                    <div className="space-y-1.5 border-t border-line/40 pt-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-faint uppercase font-medium">Corner Radius</span>
                        <span className="font-mono text-dim">
                          {primarySelected.cornerRadius || 0}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={primarySelected.cornerRadius || 0}
                        onChange={(e) =>
                          handleUpdateSelected({ cornerRadius: Number(e.target.value) })
                        }
                        className="w-full accent-accent"
                      />
                    </div>
                  )}

                  {/* Fill Color */}
                  <div className="space-y-1.5 border-t border-line/40 pt-2">
                    <label className="text-[11px] text-faint uppercase font-medium">
                      Fill Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primarySelected.fill === 'none' ? '#000000' : primarySelected.fill}
                        onChange={(e) => handleUpdateSelected({ fill: e.target.value })}
                        className="h-7 w-7 rounded border border-line cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={primarySelected.fill}
                        onChange={(e) => handleUpdateSelected({ fill: e.target.value })}
                        className="flex-1 rounded border border-line bg-base px-2 py-1 font-mono text-[11px] text-ink"
                      />
                    </div>

                    {/* Quick Swatches */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {SWATCH_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleUpdateSelected({ fill: color })}
                          style={{ backgroundColor: color === 'none' ? 'transparent' : color }}
                          className={`h-5 w-5 rounded-full border cursor-pointer ${
                            primarySelected.fill === color
                              ? 'ring-2 ring-accent border-white'
                              : 'border-line/80'
                          } ${color === 'none' ? 'relative bg-line/20' : ''}`}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Stroke Properties */}
                  <div className="space-y-1.5 border-t border-line/40 pt-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-faint uppercase font-medium">Stroke Border</span>
                      <span className="font-mono text-dim">{primarySelected.strokeWidth}px</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={
                          primarySelected.stroke === 'none' ? '#ffffff' : primarySelected.stroke
                        }
                        onChange={(e) => handleUpdateSelected({ stroke: e.target.value })}
                        className="h-7 w-7 rounded border border-line cursor-pointer bg-transparent"
                      />
                      <input
                        type="range"
                        min="0"
                        max="24"
                        value={primarySelected.strokeWidth}
                        onChange={(e) =>
                          handleUpdateSelected({ strokeWidth: Number(e.target.value) })
                        }
                        className="flex-1 accent-accent"
                      />
                    </div>
                  </div>

                  {/* Opacity Slider */}
                  <div className="space-y-1.5 border-t border-line/40 pt-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-faint uppercase font-medium">Opacity</span>
                      <span className="font-mono text-dim">
                        {Math.round(primarySelected.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={primarySelected.opacity}
                      onChange={(e) => handleUpdateSelected({ opacity: Number(e.target.value) })}
                      className="w-full accent-accent"
                    />
                  </div>

                  {/* Layer Order Controls */}
                  <div className="space-y-1.5 border-t border-line/40 pt-2 pb-2">
                    <label className="text-[11px] text-faint uppercase font-medium">
                      Layer Hierarchy
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => handleMoveLayer('top')}>
                        Bring to Front
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleMoveLayer('bottom')}
                      >
                        Send to Back
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleMoveLayer('up')}>
                        Bring Forward
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleMoveLayer('down')}>
                        Send Backward
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col space-y-2.5 overflow-y-auto pr-1 text-[12px]">
                  <div className="flex items-center justify-between border-b border-line/50 pb-2">
                    <span className="text-[11px] text-faint uppercase font-medium">
                      Canvas Layers ({shapes.length})
                    </span>
                  </div>
                  {shapes.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-faint">
                      <Sliders size={28} className="text-dim mb-2" />
                      <p className="text-[13px] font-medium text-ink">Canvas is Empty</p>
                      <p className="mt-1 text-[11.5px] max-w-[200px]">
                        Add shapes or icons from the left palette to start designing.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {shapes.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={(e) => {
                            if (e.shiftKey) {
                              setSelectedIds((prev) =>
                                prev.includes(s.id)
                                  ? prev.filter((x) => x !== s.id)
                                  : [...prev, s.id]
                              )
                            } else {
                              setSelectedIds([s.id])
                            }
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded border text-left transition-colors cursor-pointer text-[12px] ${
                            selectedIds.includes(s.id)
                              ? 'border-accent/60 bg-surface text-ink'
                              : 'border-line/40 bg-base/40 hover:bg-surface/80 hover:border-line text-ink'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-faint font-mono text-[10.5px]">
                              #{shapes.length - idx}
                            </span>
                            <span className="truncate">{s.name}</span>
                          </div>
                          <span className="text-faint text-[10.5px] font-mono capitalize">
                            {s.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : (
              /* Export & Code Studio */
              <div className="flex-1 flex flex-col space-y-3 overflow-hidden text-[12px]">
                {/* Format and Resolution Selector */}
                <div className="space-y-2 border-b border-line/50 pb-3">
                  <label className="text-[11px] text-faint uppercase font-medium">
                    Export Format & Scale
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={exportFormat}
                      onChange={(e) =>
                        setExportFormat(e.target.value as 'svg' | 'png' | 'webp' | 'jpeg')
                      }
                      className="flex-1 rounded border border-line bg-base px-2 py-1.5 text-ink font-medium"
                    >
                      <option value="svg">SVG (Vector Code)</option>
                      <option value="png">PNG (Lossless Raster)</option>
                      <option value="webp">WebP (Modern Web)</option>
                      <option value="jpeg">JPEG (Compressed)</option>
                    </select>

                    {exportFormat !== 'svg' && (
                      <select
                        value={exportScale}
                        onChange={(e) => setExportScale(Number(e.target.value))}
                        className="w-20 rounded border border-line bg-base px-2 py-1.5 text-ink font-mono"
                        title="Resolution Multiplier"
                      >
                        <option value={1}>1x</option>
                        <option value={2}>2x (HD)</option>
                        <option value={4}>4x (UHD)</option>
                      </select>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-center gap-2 mt-2"
                    onClick={handleExportFile}
                    disabled={exporting}
                  >
                    <Download size={13} />
                    {exporting
                      ? 'Exporting...'
                      : `Save as ${exportFormat.toUpperCase()} (${config.width * (exportFormat === 'svg' ? 1 : exportScale)}×${config.height * (exportFormat === 'svg' ? 1 : exportScale)})`}
                  </Button>
                </div>

                {/* SVG Code Preview & Copy */}
                <div className="flex-1 flex flex-col space-y-1.5 overflow-hidden">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-faint uppercase font-medium">SVG Markup</span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCode ? <Check size={11} /> : <Copy size={11} />}
                      {copiedCode ? 'Copied' : 'Copy SVG'}
                    </button>
                  </div>
                  <pre className="flex-1 rounded border border-line bg-base/90 p-2.5 font-mono text-[10.5px] text-dim overflow-auto leading-relaxed select-all">
                    {svgOutput}
                  </pre>
                </div>

                {/* React TSX Component Code Preview & Copy */}
                <div className="h-32 flex flex-col space-y-1.5 overflow-hidden">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-faint uppercase font-medium">React Component (TSX)</span>
                    <button
                      type="button"
                      onClick={handleCopyComponent}
                      className="text-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedComponent ? <Check size={11} /> : <Copy size={11} />}
                      {copiedComponent ? 'Copied' : 'Copy TSX'}
                    </button>
                  </div>
                  <pre className="flex-1 rounded border border-line bg-base/90 p-2.5 font-mono text-[10.5px] text-dim overflow-auto leading-relaxed select-all">
                    {reactComponentOutput}
                  </pre>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* Modal: Insert Custom SVG / Path */}
      {showCustomPathModal &&
        createPortal(
          <div
            className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowCustomPathModal(false)
            }}
          >
            <Panel className="w-full max-w-md p-4 space-y-3.5 shadow-2xl border-line-strong">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <Code2 size={16} className="text-accent" />
                  <h3 className="font-semibold text-[13.5px] text-ink">Insert Custom SVG Path</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomPathModal(false)}
                  className="text-faint hover:text-ink cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-[12px]">
                <div>
                  <label className="text-[11px] text-faint uppercase font-medium block mb-1">
                    Shape Label
                  </label>
                  <input
                    type="text"
                    value={customPathName}
                    onChange={(e) => setCustomPathName(e.target.value)}
                    placeholder="e.g. Custom Vector Logo"
                    className="w-full rounded border border-line bg-base px-2.5 py-1.5 text-ink outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-faint uppercase font-medium block mb-1">
                    SVG Path Data (d=&quot;...&quot; or raw &lt;svg&gt;)
                  </label>
                  <textarea
                    rows={5}
                    value={customPathInput}
                    onChange={(e) => setCustomPathInput(e.target.value)}
                    placeholder='Paste path string (e.g. M12 2l3.09 6.26L22...) or complete <svg> / <path d="..." />'
                    className="w-full rounded border border-line bg-base p-2.5 font-mono text-[11px] text-ink outline-none focus:border-accent resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line/50">
                <Button variant="secondary" size="sm" onClick={() => setShowCustomPathModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleInsertCustomPath}>
                  Insert into Canvas
                </Button>
              </div>
            </Panel>
          </div>,
          document.body
        )}

      {/* Modal: Icon Library Browser */}
      {showIconLibraryModal &&
        createPortal(
          <div
            className="fixed inset-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIconLibraryModal(false)
            }}
          >
            <Panel className="w-full max-w-2xl p-4 space-y-3.5 shadow-2xl border-line-strong max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-accent" />
                  <h3 className="font-semibold text-[13.5px] text-ink">
                    Vector Icon Library ({PRESET_ICONS.length} Glyphs)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIconLibraryModal(false)}
                  className="text-faint hover:text-ink cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Filter and Search Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <div className="flex items-center gap-1 bg-base/60 p-0.5 rounded border border-line text-[11px]">
                  {['all', 'shapes', 'ui', 'media', 'dev', 'nature'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setIconCategoryFilter(cat)}
                      className={`px-2 py-0.5 rounded capitalize transition-colors cursor-pointer ${
                        iconCategoryFilter === cat
                          ? 'bg-surface text-accent font-medium shadow-xs'
                          : 'text-faint hover:text-ink'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 rounded border border-line bg-base px-2 py-1 text-[11.5px] w-48">
                  <Search size={12} className="text-faint" />
                  <input
                    type="text"
                    value={iconSearchQuery}
                    onChange={(e) => setIconSearchQuery(e.target.value)}
                    placeholder="Search icons..."
                    className="w-full bg-transparent text-ink outline-none"
                  />
                </div>
              </div>

              {/* Icon Cards Grid */}
              <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-1">
                {filteredIcons.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => {
                      handleAddShape('preset-icon', {
                        name: icon.name,
                        iconPath: icon.path
                      })
                      setShowIconLibraryModal(false)
                    }}
                    className="flex flex-col items-center justify-center p-3 rounded border border-line/40 bg-base/40 hover:bg-surface hover:border-accent/60 group transition-all cursor-pointer"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="text-dim group-hover:text-accent transition-colors"
                    >
                      <path d={icon.path} />
                    </svg>
                    <span className="text-[10.5px] text-faint group-hover:text-ink truncate w-full text-center mt-2 font-medium">
                      {icon.name}
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
          </div>,
          document.body
        )}
    </div>
  )
}
