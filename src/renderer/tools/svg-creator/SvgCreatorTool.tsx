import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowRight,
  Braces,
  Check,
  Circle,
  Copy,
  Download,
  DraftingCompass,
  FileCode,
  Grid,
  Minus,
  Move,
  Redo2,
  Sliders,
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

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'style' | 'export'>('style')
  const [zoom, setZoom] = useState(1)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedComponent, setCopiedComponent] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportScale, setExportScale] = useState<number>(2)
  const [exportFormat, setExportFormat] = useState<'svg' | 'png' | 'webp' | 'jpeg'>('svg')

  const selectedShape = useMemo(
    () => shapes.find((s) => s.id === selectedId) ?? null,
    [shapes, selectedId]
  )

  // Canvas interaction state
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragHandle, setDragHandle] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<{
    mouseX: number
    mouseY: number
    shapeX: number
    shapeY: number
    shapeW: number
    shapeH: number
    rotation: number
  } | null>(null)

  // Undo / Redo handlers
  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex((i) => i - 1)
    }
  }, [canUndo])

  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex((i) => i + 1)
    }
  }, [canRedo])

  // Add a new shape to the canvas
  const handleAddShape = (type: ShapeType, extra?: Partial<Shape>) => {
    const newShape = createDefaultShape(type, config, extra)
    updateShapes([...shapes, newShape])
    setSelectedId(newShape.id)
  }

  // Update properties of the currently selected shape
  const handleUpdateSelected = useCallback(
    (props: Partial<Shape>, record = true) => {
      if (!selectedId) return
      const next = shapes.map((s) => (s.id === selectedId ? { ...s, ...props } : s))
      updateShapes(next, record)
    },
    [selectedId, shapes, updateShapes]
  )

  // Delete active shape
  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return
    updateShapes(shapes.filter((s) => s.id !== selectedId))
    setSelectedId(null)
  }, [selectedId, shapes, updateShapes])

  // Duplicate active shape
  const handleDuplicateSelected = useCallback(() => {
    if (!selectedShape) return
    const offset = config.snapToGrid ? config.gridSize : 20
    const copy: Shape = {
      ...selectedShape,
      id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${selectedShape.name} (Copy)`,
      x: selectedShape.x + offset,
      y: selectedShape.y + offset
    }
    updateShapes([...shapes, copy])
    setSelectedId(copy.id)
  }, [selectedShape, config, shapes, updateShapes])

  // Layer ordering
  const handleMoveLayer = (direction: 'up' | 'down' | 'top' | 'bottom') => {
    if (!selectedId) return
    const idx = shapes.findIndex((s) => s.id === selectedId)
    if (idx === -1) return

    const next = [...shapes]
    const [item] = next.splice(idx, 1)

    if (direction === 'top') {
      next.push(item)
    } else if (direction === 'bottom') {
      next.unshift(item)
    } else if (direction === 'up' && idx < shapes.length - 1) {
      next.splice(idx + 1, 0, item)
    } else if (direction === 'down' && idx > 0) {
      next.splice(idx - 1, 0, item)
    } else {
      next.splice(idx, 0, item)
    }

    updateShapes(next)
  }

  // Alignment helpers
  const handleAlign = (align: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedShape) return
    let nextX = selectedShape.x
    let nextY = selectedShape.y

    switch (align) {
      case 'left':
        nextX = 0
        break
      case 'center':
        nextX = (config.width - selectedShape.width) / 2
        break
      case 'right':
        nextX = config.width - selectedShape.width
        break
      case 'top':
        nextY = 0
        break
      case 'middle':
        nextY = (config.height - selectedShape.height) / 2
        break
      case 'bottom':
        nextY = config.height - selectedShape.height
        break
    }

    handleUpdateSelected({
      x: snapCoordinate(nextX, config.gridSize, config.snapToGrid),
      y: snapCoordinate(nextY, config.gridSize, config.snapToGrid)
    })
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
      } else if (
        selectedShape &&
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

        handleUpdateSelected({
          x: selectedShape.x + dx,
          y: selectedShape.y + dy
        })
      } else if (e.key === 'Escape') {
        setSelectedId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    selectedShape,
    handleDeleteSelected,
    handleDuplicateSelected,
    handleUndo,
    handleRedo,
    handleUpdateSelected,
    config
  ])

  // Mouse drag & resize handlers
  const handlePointerDown = (e: React.PointerEvent, shapeId: string, handle?: string) => {
    e.stopPropagation()
    const targetShape = shapes.find((s) => s.id === shapeId)
    if (!targetShape) return

    setSelectedId(shapeId)
    setIsDragging(true)
    setDragHandle(handle || 'body')
    setDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      shapeX: targetShape.x,
      shapeY: targetShape.y,
      shapeW: targetShape.width,
      shapeH: targetShape.height,
      rotation: targetShape.rotation
    })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStart || !selectedShape) return

    const deltaX = (e.clientX - dragStart.mouseX) / zoom
    const deltaY = (e.clientY - dragStart.mouseY) / zoom

    if (dragHandle === 'body') {
      const nextX = snapCoordinate(dragStart.shapeX + deltaX, config.gridSize, config.snapToGrid)
      const nextY = snapCoordinate(dragStart.shapeY + deltaY, config.gridSize, config.snapToGrid)
      handleUpdateSelected({ x: nextX, y: nextY }, false)
    } else if (dragHandle === 'se') {
      const nextW = Math.max(
        10,
        snapCoordinate(dragStart.shapeW + deltaX, config.gridSize, config.snapToGrid)
      )
      const nextH = Math.max(
        10,
        snapCoordinate(dragStart.shapeH + deltaY, config.gridSize, config.snapToGrid)
      )
      handleUpdateSelected({ width: nextW, height: nextH }, false)
    } else if (dragHandle === 'e') {
      const nextW = Math.max(
        10,
        snapCoordinate(dragStart.shapeW + deltaX, config.gridSize, config.snapToGrid)
      )
      handleUpdateSelected({ width: nextW }, false)
    } else if (dragHandle === 's') {
      const nextH = Math.max(
        10,
        snapCoordinate(dragStart.shapeH + deltaY, config.gridSize, config.snapToGrid)
      )
      handleUpdateSelected({ height: nextH }, false)
    } else if (dragHandle === 'rotate') {
      const cx = dragStart.shapeX + dragStart.shapeW / 2
      const cy = dragStart.shapeY + dragStart.shapeH / 2
      // Canvas coordinate of cursor
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        const mouseCanvasX = (e.clientX - rect.left) / zoom
        const mouseCanvasY = (e.clientY - rect.top) / zoom
        const rad = Math.atan2(mouseCanvasY - cy, mouseCanvasX - cx)
        let deg = Math.round((rad * 180) / Math.PI) + 90
        if (deg < 0) deg += 360
        if (e.shiftKey) deg = Math.round(deg / 15) * 15 // snap to 15 degrees
        handleUpdateSelected({ rotation: deg }, false)
      }
    }
  }

  const handlePointerUp = (_e: React.PointerEvent) => {
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

  return (
    <div className="flex flex-col gap-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface/80 px-3.5 py-2 text-[12px] text-dim">
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Grid & Snap Toggles */}
          <button
            type="button"
            onClick={() => setConfig((c) => ({ ...c, showGrid: !c.showGrid }))}
            className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] transition-colors cursor-pointer ${
              config.showGrid
                ? 'border-accent/40 bg-accent/15 text-accent'
                : 'border-line bg-base/50 text-faint hover:text-ink'
            }`}
            title="Toggle Grid Overlay"
          >
            <Grid size={11} /> Grid
          </button>

          <button
            type="button"
            onClick={() => setConfig((c) => ({ ...c, snapToGrid: !c.snapToGrid }))}
            className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] transition-colors cursor-pointer ${
              config.snapToGrid
                ? 'border-accent/40 bg-accent/15 text-accent'
                : 'border-line bg-base/50 text-faint hover:text-ink'
            }`}
            title="Toggle Snap to Grid"
          >
            <DraftingCompass size={11} /> Snap
          </button>
        </div>

        {/* Zoom & Undo/Redo */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded border border-line bg-base/60 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndo}
              className="rounded p-1 text-faint hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!canRedo}
              className="rounded p-1 text-faint hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={13} />
            </button>
          </div>

          <div className="flex items-center rounded border border-line bg-base/60 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.25, roundTo(z - 0.25, 2)))}
              className="rounded p-1 text-faint hover:text-ink cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="px-1.5 font-mono text-[10.5px] text-faint select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, roundTo(z + 0.25, 2)))}
              className="rounded p-1 text-faint hover:text-ink cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="rounded px-1.5 py-0.5 text-[10px] text-dim hover:text-ink cursor-pointer"
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
        <div className="lg:col-span-1 flex flex-row lg:flex-col items-center justify-start gap-1.5 rounded-md border border-line bg-surface/60 p-2 overflow-x-auto">
          <IconButton
            aria-label="Select & Move tool"
            title="Select & Move (V)"
            onClick={() => {}}
            className="text-accent bg-surface"
          >
            <Move size={15} />
          </IconButton>

          <div className="hidden lg:block w-full border-b border-line/40 my-1" />

          <IconButton
            aria-label="Add Rectangle"
            title="Rectangle (R)"
            onClick={() => handleAddShape('rect')}
          >
            <Square size={15} />
          </IconButton>

          <IconButton
            aria-label="Add Circle / Ellipse"
            title="Circle / Ellipse (O)"
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

          <IconButton aria-label="Add Star" title="Star" onClick={() => handleAddShape('star')}>
            <Star size={15} />
          </IconButton>

          <IconButton aria-label="Add Arrow" title="Arrow" onClick={() => handleAddShape('arrow')}>
            <ArrowRight size={15} />
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

          {/* Quick Glyph Icons */}
          {PRESET_ICONS.slice(0, 4).map((icon) => (
            <IconButton
              key={icon.id}
              aria-label={`Insert ${icon.name}`}
              title={`Insert ${icon.name}`}
              onClick={() =>
                handleAddShape('preset-icon', {
                  name: icon.name,
                  iconPath: icon.path
                })
              }
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d={icon.path} />
              </svg>
            </IconButton>
          ))}
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
            className="relative transition-all duration-75 border border-line-strong rounded-sm overflow-hidden bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px]"
            onClick={() => setSelectedId(null)}
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
                <rect width="100%" height="100%" fill="url(#grid-pattern)" pointerEvents="none" />
              )}

              {/* Rendered Vector Shapes */}
              {shapes.map((shape) => {
                const isSelected = shape.id === selectedId
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
                      <g className="pointer-events-none">
                        {/* Bounding Box Outline */}
                        <rect
                          x={x - 2}
                          y={y - 2}
                          width={width + 4}
                          height={height + 4}
                          fill="none"
                          stroke="var(--color-accent, #f59e0b)"
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                        />

                        {/* Corner Resize Handle SE */}
                        <circle
                          cx={x + width}
                          cy={y + height}
                          r="5"
                          fill="var(--color-accent, #f59e0b)"
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="pointer-events-auto cursor-se-resize"
                          onPointerDown={(e) => handlePointerDown(e, shape.id, 'se')}
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
                        />
                      </g>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Bottom Canvas HUD */}
          <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[10.5px] font-mono text-faint pointer-events-none">
            <span>
              Canvas: {config.width}×{config.height}px · {shapes.length} layer
              {shapes.length === 1 ? '' : 's'}
            </span>
            {selectedShape && (
              <span>
                Selected: {selectedShape.name} (X: {Math.round(selectedShape.x)}, Y:{' '}
                {Math.round(selectedShape.y)}, W: {Math.round(selectedShape.width)}, H:{' '}
                {Math.round(selectedShape.height)})
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
              selectedShape ? (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-[12px]">
                  {/* Layer Actions Header */}
                  <div className="flex items-center justify-between border-b border-line/50 pb-2">
                    <span className="font-semibold text-ink truncate">{selectedShape.name}</span>
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
                          value={Math.round(selectedShape.x)}
                          onChange={(e) => handleUpdateSelected({ x: Number(e.target.value) })}
                          className="w-full bg-transparent text-ink outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded border border-line bg-base px-2 py-1">
                        <span className="text-faint">Y</span>
                        <input
                          type="number"
                          value={Math.round(selectedShape.y)}
                          onChange={(e) => handleUpdateSelected({ y: Number(e.target.value) })}
                          className="w-full bg-transparent text-ink outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded border border-line bg-base px-2 py-1">
                        <span className="text-faint">W</span>
                        <input
                          type="number"
                          value={Math.round(selectedShape.width)}
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
                          value={Math.round(selectedShape.height)}
                          min={2}
                          onChange={(e) =>
                            handleUpdateSelected({ height: Math.max(2, Number(e.target.value)) })
                          }
                          className="w-full bg-transparent text-ink outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Text Properties if text is selected */}
                  {selectedShape.type === 'text' && (
                    <div className="space-y-1.5 border-t border-line/40 pt-2">
                      <label className="text-[11px] text-faint uppercase font-medium">
                        Text Content
                      </label>
                      <input
                        type="text"
                        value={selectedShape.text || ''}
                        onChange={(e) => handleUpdateSelected({ text: e.target.value })}
                        className="w-full rounded border border-line bg-base px-2 py-1 text-ink text-[12px]"
                      />
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="number"
                          value={selectedShape.fontSize || 24}
                          min={8}
                          max={200}
                          onChange={(e) =>
                            handleUpdateSelected({ fontSize: Number(e.target.value) })
                          }
                          className="w-16 rounded border border-line bg-base px-1.5 py-1 text-center font-mono text-[11px]"
                          title="Font Size"
                        />
                        <select
                          value={selectedShape.fontWeight || 'normal'}
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

                  {/* Corner Radius if rect */}
                  {selectedShape.type === 'rect' && (
                    <div className="space-y-1.5 border-t border-line/40 pt-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-faint uppercase font-medium">Corner Radius</span>
                        <span className="font-mono text-dim">
                          {selectedShape.cornerRadius || 0}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedShape.cornerRadius || 0}
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
                        value={selectedShape.fill === 'none' ? '#000000' : selectedShape.fill}
                        onChange={(e) => handleUpdateSelected({ fill: e.target.value })}
                        className="h-7 w-7 rounded border border-line cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={selectedShape.fill}
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
                            selectedShape.fill === color
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
                      <span className="font-mono text-dim">{selectedShape.strokeWidth}px</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={selectedShape.stroke === 'none' ? '#ffffff' : selectedShape.stroke}
                        onChange={(e) => handleUpdateSelected({ stroke: e.target.value })}
                        className="h-7 w-7 rounded border border-line cursor-pointer bg-transparent"
                      />
                      <input
                        type="range"
                        min="0"
                        max="24"
                        value={selectedShape.strokeWidth}
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
                        {Math.round(selectedShape.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={selectedShape.opacity}
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
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-faint">
                  <Sliders size={28} className="text-dim mb-2" />
                  <p className="text-[13px] font-medium text-ink">No Shape Selected</p>
                  <p className="mt-1 text-[11.5px] max-w-[200px]">
                    Click any shape on the canvas or pick one from the left palette to customize its
                    properties.
                  </p>
                </div>
              )
            ) : (
              /* Export & Code Studio */
              <div className="flex-1 flex flex-col space-y-3 overflow-hidden text-[12px]">
                {/* Format and Resolution Selector */}
                <div className="space-y-2 border-b border-line/50 pb-3">
                  <label className="text-[11px] text-faint uppercase font-medium">
                    Export File
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={exportFormat}
                      onChange={(e) =>
                        setExportFormat(e.target.value as 'svg' | 'png' | 'webp' | 'jpeg')
                      }
                      className="rounded border border-line bg-base px-2 py-1.5 text-[11.5px] text-ink"
                    >
                      <option value="svg">SVG Vector (.svg)</option>
                      <option value="png">PNG Image (.png)</option>
                      <option value="webp">WebP Image (.webp)</option>
                      <option value="jpeg">JPEG Image (.jpg)</option>
                    </select>

                    {exportFormat !== 'svg' && (
                      <select
                        value={exportScale}
                        onChange={(e) => setExportScale(Number(e.target.value))}
                        className="rounded border border-line bg-base px-2 py-1.5 text-[11.5px] text-ink font-mono"
                      >
                        <option value={1}>
                          1× ({config.width}×{config.height})
                        </option>
                        <option value={2}>
                          2× ({config.width * 2}×{config.height * 2}) Retina
                        </option>
                        <option value={4}>
                          4× ({config.width * 4}×{config.height * 4}) 4K Print
                        </option>
                      </select>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => void handleExportFile()}
                    disabled={exporting}
                    loading={exporting}
                  >
                    <Download size={13} /> Export {exportFormat.toUpperCase()} File
                  </Button>
                </div>

                {/* Live SVG Code Snippet */}
                <div className="flex-1 flex flex-col space-y-1.5 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-faint uppercase font-medium">
                      Generated Markup
                    </label>
                    <div className="flex items-center gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => void handleCopyCode()}>
                        {copiedCode ? (
                          <Check size={12} className="text-emerald-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                        {copiedCode ? 'Copied' : 'SVG'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleCopyComponent()}
                      >
                        {copiedComponent ? (
                          <Check size={12} className="text-emerald-400" />
                        ) : (
                          <FileCode size={12} />
                        )}
                        {copiedComponent ? 'Copied' : 'React'}
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto rounded border border-line bg-base/60 p-2 font-mono text-[11px] leading-relaxed text-ink">
                    <pre className="whitespace-pre">{svgOutput}</pre>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
