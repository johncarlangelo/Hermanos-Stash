import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Download,
  Eye,
  Pipette,
  RotateCcw,
  Scissors,
  Sliders,
  Sparkles,
  SplitSquareVertical,
  UploadCloud,
  Wand2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { useImageZoomPan } from '../shared/use-image-zoom-pan'
import {
  DEFAULT_REMOVAL_OPTIONS,
  detectBackgroundColor,
  removeBackground,
  rgbToHex,
  type BackgroundPreset,
  type BackgroundRemovalOptions,
  type RemovalMode,
  type RgbColor
} from './logic'

export default function BackgroundRemoverTool() {
  const [originalSrc, setOriginalSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('cutout')
  const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null)
  const [keyColor, setKeyColor] = useState<RgbColor>(DEFAULT_REMOVAL_OPTIONS.keyColor)
  const [mode, setMode] = useState<RemovalMode>(DEFAULT_REMOVAL_OPTIONS.mode)
  const [tolerance, setTolerance] = useState<number>(DEFAULT_REMOVAL_OPTIONS.tolerance)
  const [feather, setFeather] = useState<number>(DEFAULT_REMOVAL_OPTIONS.feather)
  const [defringe, setDefringe] = useState<boolean>(DEFAULT_REMOVAL_OPTIONS.defringe)
  const [bgPreset, setBgPreset] = useState<BackgroundPreset>('transparent')
  const [viewMode, setViewMode] = useState<'split' | 'side' | 'result'>('split')
  const [splitPos, setSplitPos] = useState<number>(50) // 0 to 100%
  const [isEyedropperActive, setIsEyedropperActive] = useState<boolean>(false)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    zoom,
    isZoomed,
    zoomPercent,
    zoomIn,
    zoomOut,
    resetZoom,
    handleWheel,
    handlePointerDown: handleZoomPointerDown,
    handlePointerMove: handleZoomPointerMove,
    handlePointerUp: handleZoomPointerUp,
    handleDoubleClick,
    transformStyle,
    cursorClass
  } = useImageZoomPan({
    minZoom: 1.0,
    maxZoom: 6.0,
    initialZoom: 1.0,
    stepFactor: 1.25
  })

  const isDraggingSplitRef = useRef<boolean>(false)

  const handleStartSplitDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation()
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return

      isDraggingSplitRef.current = true
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Non-fatal
      }

      const onPointerMove = (moveEvt: PointerEvent) => {
        if (!isDraggingSplitRef.current || !canvasRef.current) return
        const rect = canvasRef.current.getBoundingClientRect()
        if (rect.width <= 0) return
        const raw = ((moveEvt.clientX - rect.left) / rect.width) * 100
        const clamped = Math.max(0, Math.min(100, Math.round(raw)))
        setSplitPos(clamped)
      }

      const onPointerUp = (upEvt: PointerEvent) => {
        isDraggingSplitRef.current = false
        try {
          if ((e.currentTarget as HTMLElement).hasPointerCapture(upEvt.pointerId)) {
            (e.currentTarget as HTMLElement).releasePointerCapture(upEvt.pointerId)
          }
        } catch {
          // Non-fatal
        }
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    },
    []
  )

  // Handle file upload
  const handleFiles = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    setFileName(file.name.replace(/\.[^/.]+$/, ''))
    resetZoom()
    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string
      setOriginalSrc(src)
      const img = new Image()
      img.onload = () => {
        setOriginalImg(img)

        // Setup hidden source canvas to extract ImageData and auto-detect background
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const ctx = c.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          const imgData = ctx.getImageData(0, 0, img.width, img.height)
          const detected = detectBackgroundColor(imgData)
          setKeyColor(detected)
        }
        originalCanvasRef.current = c
        toastSuccess(`Loaded image: ${file.name}`)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }, [resetZoom])

  // Sample Product Graphic with clean studio background
  const loadDemoProduct = useCallback(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Solid clean white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 800, 600)

      // Soft shadow underneath product
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
      ctx.beginPath()
      ctx.ellipse(400, 480, 240, 30, 0, 0, Math.PI * 2)
      ctx.fill()

      // High-end Wireless Headphone Product
      // Headband arch
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 36
      ctx.beginPath()
      ctx.arc(400, 320, 160, Math.PI * 0.95, Math.PI * 2.05)
      ctx.stroke()

      // Inner cushioned band
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 14
      ctx.beginPath()
      ctx.arc(400, 320, 146, Math.PI * 0.97, Math.PI * 2.03)
      ctx.stroke()

      // Left Ear Cup (Navy & Silver)
      ctx.fillStyle = '#1e293b'
      ctx.beginPath()
      ctx.ellipse(240, 360, 46, 75, -0.15, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.ellipse(240, 360, 34, 60, -0.15, 0, Math.PI * 2)
      ctx.fill()

      // Left Ear Cushion
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.ellipse(250, 360, 22, 65, -0.15, 0, Math.PI * 2)
      ctx.fill()

      // Right Ear Cup (Navy & Silver)
      ctx.fillStyle = '#1e293b'
      ctx.beginPath()
      ctx.ellipse(560, 360, 46, 75, 0.15, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.ellipse(560, 360, 34, 60, 0.15, 0, Math.PI * 2)
      ctx.fill()

      // Right Ear Cushion
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.ellipse(550, 360, 22, 65, 0.15, 0, Math.PI * 2)
      ctx.fill()

      // Brand Accent badge
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(240, 360, 8, 0, Math.PI * 2)
      ctx.arc(560, 360, 8, 0, Math.PI * 2)
      ctx.fill()
    }

    const dataUrl = canvas.toDataURL('image/png')
    setOriginalSrc(dataUrl)
    setFileName('studio-headphones')
    resetZoom()
    const img = new Image()
    img.onload = () => {
      setOriginalImg(img)
      originalCanvasRef.current = canvas
      setKeyColor({ r: 255, g: 255, b: 255 })
      toastSuccess('Loaded sample studio product')
    }
    img.src = dataUrl
  }, [resetZoom])

  // Draw interactive composite to the visible display canvas
  const drawPreviewCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const origCanvas = originalCanvasRef.current
    const procCanvas = processedCanvasRef.current
    if (!canvas || !origCanvas || !procCanvas) return

    const w = origCanvas.width
    const h = origCanvas.height
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, w, h)

    // Helper to paint selected background preset
    const drawBackground = (
      targetCtx: CanvasRenderingContext2D,
      dx: number,
      dy: number,
      dw: number,
      dh: number
    ) => {
      if (bgPreset === 'transparent') {
        // Draw checkered transparency grid
        const tileSize = 16
        for (let y = dy; y < dy + dh; y += tileSize) {
          for (let x = dx; x < dx + dw; x += tileSize) {
            const isDark = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 1
            targetCtx.fillStyle = isDark ? '#1e293b' : '#334155'
            targetCtx.fillRect(x, y, tileSize, tileSize)
          }
        }
      } else if (bgPreset === 'white') {
        targetCtx.fillStyle = '#ffffff'
        targetCtx.fillRect(dx, dy, dw, dh)
      } else if (bgPreset === 'black') {
        targetCtx.fillStyle = '#09090b'
        targetCtx.fillRect(dx, dy, dw, dh)
      } else if (bgPreset === 'grey') {
        targetCtx.fillStyle = '#71717a'
        targetCtx.fillRect(dx, dy, dw, dh)
      } else if (bgPreset === 'studio-dark') {
        const grad = targetCtx.createRadialGradient(
          w / 2,
          h / 2,
          50,
          w / 2,
          h / 2,
          Math.max(w, h) / 1.4
        )
        grad.addColorStop(0, '#1e293b')
        grad.addColorStop(1, '#020617')
        targetCtx.fillStyle = grad
        targetCtx.fillRect(dx, dy, dw, dh)
      } else if (bgPreset === 'studio-warm') {
        const grad = targetCtx.createLinearGradient(0, 0, w, h)
        grad.addColorStop(0, '#f97316')
        grad.addColorStop(1, '#db2777')
        targetCtx.fillStyle = grad
        targetCtx.fillRect(dx, dy, dw, dh)
      } else if (bgPreset === 'studio-cool') {
        const grad = targetCtx.createLinearGradient(0, 0, w, h)
        grad.addColorStop(0, '#0284c7')
        grad.addColorStop(1, '#0f172a')
        targetCtx.fillStyle = grad
        targetCtx.fillRect(dx, dy, dw, dh)
      }
    }

    if (viewMode === 'result') {
      // Result Only: Draw background then transparent cutout
      drawBackground(ctx, 0, 0, w, h)
      ctx.drawImage(procCanvas, 0, 0)
    } else if (viewMode === 'split') {
      // Split Before / After Slider
      const splitX = Math.round((splitPos / 100) * w)

      // 1. Draw Original on Left Side
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, splitX, h)
      ctx.clip()
      ctx.drawImage(origCanvas, 0, 0)
      ctx.restore()

      // 2. Draw Processed on Right Side
      ctx.save()
      ctx.beginPath()
      ctx.rect(splitX, 0, w - splitX, h)
      ctx.clip()
      drawBackground(ctx, splitX, 0, w - splitX, h)
      ctx.drawImage(procCanvas, 0, 0)
      ctx.restore()

      // 3. Draw Splitter Divider Line
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(splitX, 0)
      ctx.lineTo(splitX, h)
      ctx.stroke()

      // Center handle diamond
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.arc(splitX, h / 2, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(splitX, h / 2, 4, 0, Math.PI * 2)
      ctx.fill()
    } else if (viewMode === 'side') {
      // Side by Side Mode
      drawBackground(ctx, 0, 0, w, h)
      ctx.drawImage(procCanvas, 0, 0)
    }
  }, [bgPreset, viewMode, splitPos])

  // Process and re-render cutout whenever options change
  useEffect(() => {
    if (!originalImg || !originalCanvasRef.current) return
    setIsProcessing(true)

    const timer = setTimeout(() => {
      const origCanvas = originalCanvasRef.current
      if (!origCanvas) {
        setIsProcessing(false)
        return
      }

      const origCtx = origCanvas.getContext('2d')
      if (!origCtx) {
        setIsProcessing(false)
        return
      }

      const imgData = origCtx.getImageData(0, 0, origCanvas.width, origCanvas.height)
      const options: BackgroundRemovalOptions = {
        keyColor,
        mode,
        tolerance,
        feather,
        defringe
      }

      const processedData = removeBackground(imgData, options)

      // Store processed transparent result in offscreen canvas
      const procCanvas = document.createElement('canvas')
      procCanvas.width = origCanvas.width
      procCanvas.height = origCanvas.height
      const procCtx = procCanvas.getContext('2d')
      if (procCtx) {
        procCtx.putImageData(processedData, 0, 0)
      }
      processedCanvasRef.current = procCanvas

      // Render onto interactive view canvas
      drawPreviewCanvas()
      setIsProcessing(false)
    }, 40)

    return () => clearTimeout(timer)
  }, [originalImg, keyColor, mode, tolerance, feather, defringe, drawPreviewCanvas])

  // Canvas Click for Eyedropper sampling
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEyedropperActive || !canvasRef.current || !originalCanvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = Math.floor((e.clientX - rect.left) * scaleX)
    const y = Math.floor((e.clientY - rect.top) * scaleY)

    const origCtx = originalCanvasRef.current.getContext('2d')
    if (!origCtx) return

    const pixel = origCtx.getImageData(x, y, 1, 1).data
    setKeyColor({ r: pixel[0], g: pixel[1], b: pixel[2] })
    setIsEyedropperActive(false)
    toastSuccess(`Sampled color: ${rgbToHex({ r: pixel[0], g: pixel[1], b: pixel[2] })}`)
  }

  // Exports
  const handleDownloadPng = () => {
    if (!processedCanvasRef.current) return
    try {
      // Export either transparent or with chosen background preset
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = processedCanvasRef.current.width
      exportCanvas.height = processedCanvasRef.current.height
      const ctx = exportCanvas.getContext('2d')
      if (!ctx) return

      if (bgPreset !== 'transparent') {
        if (bgPreset === 'white') ctx.fillStyle = '#ffffff'
        else if (bgPreset === 'black') ctx.fillStyle = '#000000'
        else if (bgPreset === 'grey') ctx.fillStyle = '#71717a'
        else if (bgPreset === 'studio-dark') {
          const g = ctx.createRadialGradient(
            exportCanvas.width / 2,
            exportCanvas.height / 2,
            50,
            exportCanvas.width / 2,
            exportCanvas.height / 2,
            exportCanvas.width / 1.4
          )
          g.addColorStop(0, '#1e293b')
          g.addColorStop(1, '#020617')
          ctx.fillStyle = g
        } else if (bgPreset === 'studio-warm') {
          const g = ctx.createLinearGradient(0, 0, exportCanvas.width, exportCanvas.height)
          g.addColorStop(0, '#f97316')
          g.addColorStop(1, '#db2777')
          ctx.fillStyle = g
        } else if (bgPreset === 'studio-cool') {
          const g = ctx.createLinearGradient(0, 0, exportCanvas.width, exportCanvas.height)
          g.addColorStop(0, '#0284c7')
          g.addColorStop(1, '#0f172a')
          ctx.fillStyle = g
        }
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
      }

      ctx.drawImage(processedCanvasRef.current, 0, 0)

      exportCanvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${fileName}-cutout.png`
        a.click()
        URL.revokeObjectURL(url)
        toastSuccess('Exported transparent PNG')
        recordHistoryQuietly('background-remover', 'Background Remover', 'images')
      }, 'image/png')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toastError(`Export failed: ${msg}`)
    }
  }

  const handleDownloadWebp = () => {
    if (!processedCanvasRef.current) return
    try {
      processedCanvasRef.current.toBlob(
        (blob) => {
          if (!blob) return
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${fileName}-cutout.webp`
          a.click()
          URL.revokeObjectURL(url)
          toastSuccess('Exported transparent WebP')
          recordHistoryQuietly('background-remover', 'Background Remover', 'images')
        },
        'image/webp',
        0.95
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toastError(`Export failed: ${msg}`)
    }
  }

  const handleCopyClipboard = async () => {
    if (!processedCanvasRef.current) return
    try {
      processedCanvasRef.current.toBlob(async (blob) => {
        if (!blob) return
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        toastSuccess('Copied transparent cutout to clipboard!')
      }, 'image/png')
    } catch {
      toastError('Clipboard image copy not supported in this environment')
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 text-[13px] text-ink overflow-hidden p-4 sm:p-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-accent/40 bg-raised text-accent shadow-xs">
            <Scissors size={18} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
              Background Remover
              <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent font-medium uppercase">
                Chroma & Keying
              </span>
            </h2>
            <p className="text-[12px] text-dim">
              Isolate foreground objects, remove studio backgrounds, and export transparent PNGs
              with soft feathered edges.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadDemoProduct}
            className="flex items-center gap-1.5"
          >
            <Sparkles size={13} className="text-accent" />
            <span>Load Sample Product</span>
          </Button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-y-auto pr-1">
        {/* LEFT COLUMN: Controls & Keying Settings (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {!originalSrc ? (
            <Panel className="p-4 flex flex-col items-center justify-center text-center gap-3">
              <DropZone
                accept={['.jpg', '.jpeg', '.png', '.webp']}
                onRawFiles={handleFiles}
                label="Drop image to remove background"
                hint="Supports JPEG, PNG, and WebP — click to browse"
                className="w-full py-8"
              />
              <p className="text-[12px] text-faint">
                Works best with portraits, product photos, icons, and items against clean or solid
                backgrounds.
              </p>
            </Panel>
          ) : (
            <>
              {/* Removal Method Panel */}
              <Panel className="p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b border-line pb-2">
                  <span className="font-semibold text-[13px] text-ink flex items-center gap-1.5">
                    <Wand2 size={14} className="text-accent" />
                    Keying Engine & Mode
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOriginalSrc(null)
                      setOriginalImg(null)
                    }}
                    className="text-[11px] text-faint hover:text-danger cursor-pointer"
                  >
                    Change Image
                  </button>
                </div>

                {/* Mode Selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('contiguous')}
                    className={`p-2 rounded border text-left cursor-pointer transition-all ${
                      mode === 'contiguous'
                        ? 'border-accent bg-accent-soft/30 text-ink shadow-xs'
                        : 'border-line bg-surface/50 text-dim hover:text-ink'
                    }`}
                  >
                    <div className="font-medium text-[12px] text-ink flex items-center gap-1">
                      {mode === 'contiguous' && <Check size={11} className="text-accent" />}
                      Contiguous (Edges In)
                    </div>
                    <div className="text-[10px] text-faint leading-snug mt-0.5">
                      Only removes outer backdrop. Preserves internal matching colors (teeth, white
                      clothing).
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('global')}
                    className={`p-2 rounded border text-left cursor-pointer transition-all ${
                      mode === 'global'
                        ? 'border-accent bg-accent-soft/30 text-ink shadow-xs'
                        : 'border-line bg-surface/50 text-dim hover:text-ink'
                    }`}
                  >
                    <div className="font-medium text-[12px] text-ink flex items-center gap-1">
                      {mode === 'global' && <Check size={11} className="text-accent" />}
                      Global (All Matches)
                    </div>
                    <div className="text-[10px] text-faint leading-snug mt-0.5">
                      Erases the key color across the entire image. Great for logos, icons, and line
                      art.
                    </div>
                  </button>
                </div>

                {/* Key Background Color Picker */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-dim font-medium">Target Background Color</span>
                    <span className="font-mono text-faint text-[10.5px]">{rgbToHex(keyColor)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded border border-line shadow-xs shrink-0"
                      style={{ backgroundColor: rgbToHex(keyColor) }}
                    />

                    <div className="flex flex-wrap gap-1 flex-1">
                      {[
                        { label: 'White', color: { r: 255, g: 255, b: 255 } },
                        { label: 'Black', color: { r: 0, g: 0, b: 0 } },
                        { label: 'Green', color: { r: 0, g: 255, b: 0 } },
                        { label: 'Grey', color: { r: 128, g: 128, b: 128 } }
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setKeyColor(preset.color)}
                          className="px-2 py-0.5 rounded text-[10.5px] border border-line bg-surface hover:text-ink text-dim transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => setIsEyedropperActive(!isEyedropperActive)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] border transition-colors ${
                          isEyedropperActive
                            ? 'border-accent bg-accent text-base font-semibold'
                            : 'border-line bg-surface text-dim hover:text-ink'
                        }`}
                        title="Click to sample color from image preview"
                      >
                        <Pipette size={10} />
                        <span>{isEyedropperActive ? 'Click Image' : 'Pick'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </Panel>

              {/* Edge Refinement & Sliders */}
              <Panel className="p-4 space-y-4">
                <span className="font-semibold text-[13px] text-ink flex items-center gap-1.5 border-b border-line pb-2">
                  <Sliders size={14} className="text-accent" />
                  Edge Tolerance & Softness
                </span>

                {/* Color Tolerance Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11.5px] text-dim">
                    <span>Color Tolerance</span>
                    <span className="font-mono text-accent">{tolerance}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="80"
                    step="1"
                    value={tolerance}
                    onChange={(e) => setTolerance(parseInt(e.target.value, 10))}
                    className="w-full accent-accent cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-faint">
                    <span>Strict (exact match)</span>
                    <span>Broad (handles shadows/gradients)</span>
                  </div>
                </div>

                {/* Feather Edge Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11.5px] text-dim">
                    <span>Edge Feather & Smoothing</span>
                    <span className="font-mono text-accent">{feather}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={feather}
                    onChange={(e) => setFeather(parseInt(e.target.value, 10))}
                    className="w-full accent-accent cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-faint">
                    <span>Sharp cutout</span>
                    <span>Soft anti-aliased matte</span>
                  </div>
                </div>

                {/* Defringe Checkbox */}
                <div className="flex items-center justify-between border-t border-line/60 pt-2">
                  <label htmlFor="defringe-check" className="text-[12px] text-dim cursor-pointer">
                    Color Decontaminate (Defringe Halo)
                  </label>
                  <input
                    type="checkbox"
                    id="defringe-check"
                    checked={defringe}
                    onChange={(e) => setDefringe(e.target.checked)}
                    className="accent-accent cursor-pointer"
                  />
                </div>
              </Panel>

              {/* Background Backdrop Presets */}
              <Panel className="p-4 space-y-2.5">
                <span className="font-semibold text-[13px] text-ink flex items-center gap-1.5">
                  <Eye size={14} className="text-accent" />
                  Preview & Output Backdrop
                </span>

                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'transparent', label: 'Transparent' },
                    { id: 'white', label: 'Solid White' },
                    { id: 'black', label: 'Solid Black' },
                    { id: 'grey', label: 'Solid Grey' },
                    { id: 'studio-dark', label: 'Studio Dark' },
                    { id: 'studio-warm', label: 'Studio Warm' },
                    { id: 'studio-cool', label: 'Studio Cool' }
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setBgPreset(bg.id as BackgroundPreset)}
                      className={`p-1.5 rounded border text-center text-[10.5px] cursor-pointer transition-all ${
                        bgPreset === bg.id
                          ? 'border-accent bg-accent-soft text-accent font-medium'
                          : 'border-line bg-surface/50 text-dim hover:text-ink'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </Panel>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Canvas Preview & Exports (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3 min-h-0">
          <Panel className="flex-1 flex flex-col overflow-hidden p-4">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[13px] text-ink">Cutout View</span>
                {originalImg && (
                  <span className="rounded bg-raised px-2 py-0.5 font-mono text-[10.5px] text-faint border border-line">
                    {originalImg.naturalWidth} × {originalImg.naturalHeight}px
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Selector */}
                <div className="flex items-center gap-1 bg-surface rounded p-0.5 border border-line">
                  <button
                    type="button"
                    onClick={() => setViewMode('split')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] transition-colors ${
                      viewMode === 'split'
                        ? 'bg-accent text-base font-semibold'
                        : 'text-dim hover:text-ink'
                    }`}
                    title="Interactive Before & After Split Slider"
                  >
                    <SplitSquareVertical size={11} />
                    <span>Split Slider</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('result')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] transition-colors ${
                      viewMode === 'result'
                        ? 'bg-accent text-base font-semibold'
                        : 'text-dim hover:text-ink'
                    }`}
                    title="Cutout Result Only"
                  >
                    <Eye size={11} />
                    <span>Result Only</span>
                  </button>
                </div>

                {/* Zoom & Pan Controls */}
                <div className="flex items-center gap-1 bg-surface rounded p-0.5 border border-line">
                  <button
                    type="button"
                    onClick={() => zoomOut()}
                    disabled={zoom <= 1.0}
                    className="p-1 rounded text-dim hover:text-ink disabled:opacity-40 disabled:hover:text-dim transition-colors"
                    title="Zoom out (Mouse wheel down)"
                  >
                    <ZoomOut size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={resetZoom}
                    className="px-1.5 py-0.5 font-mono text-[10.5px] text-faint hover:text-ink transition-colors"
                    title="Click to reset zoom (100% Fit)"
                  >
                    {zoomPercent}%
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomIn()}
                    disabled={zoom >= 6.0}
                    className="p-1 rounded text-dim hover:text-ink disabled:opacity-40 disabled:hover:text-dim transition-colors"
                    title="Zoom in (Mouse wheel up)"
                  >
                    <ZoomIn size={12} />
                  </button>
                  {isZoomed && (
                    <button
                      type="button"
                      onClick={resetZoom}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-accent-soft text-accent font-medium hover:bg-accent/20 transition-colors"
                      title="Reset view to fit container (Double-click)"
                    >
                      <RotateCcw size={10} />
                      <span>Fit</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Canvas Surface with Wheel Zoom & Drag-to-Pan */}
            <div
              ref={containerRef}
              onWheel={handleWheel}
              onPointerDown={(e) => {
                if (isEyedropperActive) return
                handleZoomPointerDown(e)
              }}
              onPointerMove={handleZoomPointerMove}
              onPointerUp={handleZoomPointerUp}
              onDoubleClick={handleDoubleClick}
              className={`flex-1 overflow-hidden bg-base/80 rounded-md border border-line p-4 flex items-center justify-center my-3 min-h-[360px] relative select-none ${
                isEyedropperActive ? 'cursor-crosshair' : cursorClass
              }`}
            >
              {originalSrc ? (
                <div
                  style={transformStyle}
                  className="relative shadow-2xl rounded border border-line/60 overflow-hidden max-w-full"
                >
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="block max-w-full max-h-[500px] object-contain"
                  />

                  {/* Interactive Split Slider Handle */}
                  {viewMode === 'split' && (
                    <div
                      onPointerDown={handleStartSplitDrag}
                      style={{ left: `${splitPos}%` }}
                      className="absolute top-0 bottom-0 -translate-x-1/2 w-8 flex items-center justify-center cursor-ew-resize pointer-events-auto z-20 group"
                      title="Drag to compare before & after (Split Slider)"
                    >
                      <div className="w-0.5 h-full bg-accent/80 group-hover:bg-accent group-hover:w-1 transition-all shadow-sm" />
                      <div className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-accent text-base flex items-center justify-center shadow-lg border border-accent/40 text-[9px] font-bold tracking-tighter select-none transition-transform group-hover:scale-110">
                        ↔
                      </div>
                    </div>
                  )}

                  {isEyedropperActive && (
                    <div className="absolute top-2 left-2 bg-accent text-base font-semibold text-[10.5px] px-2 py-1 rounded shadow-md pointer-events-none">
                      Click image to pick color
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-8 text-faint space-y-2">
                  <UploadCloud size={32} className="mx-auto text-faint/50" />
                  <p className="text-[13px] text-dim">No image loaded</p>
                  <p className="text-[11.5px]">
                    Drop an image or click &ldquo;Load Sample Product&rdquo; above to get started.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <div className="text-[11.5px] text-faint font-mono">
                {isProcessing ? (
                  <span className="text-accent animate-pulse">Processing cutout...</span>
                ) : (
                  <span>Ready to export transparent cutout</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyClipboard}
                  disabled={!originalImg}
                  className="flex items-center gap-1.5"
                  title="Copy transparent PNG directly to clipboard"
                >
                  <Copy size={13} />
                  <span>Copy Image</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadWebp}
                  disabled={!originalImg}
                  className="flex items-center gap-1.5"
                  title="Export transparent WebP"
                >
                  <Download size={13} />
                  <span>WebP</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDownloadPng}
                  disabled={!originalImg}
                  className="flex items-center gap-1.5"
                  title="Export high-resolution transparent PNG"
                >
                  <Download size={13} />
                  <span>Download PNG</span>
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
