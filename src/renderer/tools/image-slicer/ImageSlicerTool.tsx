import { useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Download, Image as ImageIcon, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  DEFAULT_SLICE_CONFIG,
  calculateSlices,
  type ImageSlice,
  type SliceGridConfig
} from './logic'

export default function ImageSlicerTool() {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string>('')
  const [imgDim, setImgDim] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [config, setConfig] = useState<SliceGridConfig>(DEFAULT_SLICE_CONFIG)
  const [exporting, setExporting] = useState(false)
  const imgObjRef = useRef<HTMLImageElement | null>(null)

  const handleFiles = (files: File[]) => {
    const file = files[0]
    if (!file) return
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const src = e.target?.result as string
      const img = new Image()
      img.onload = () => {
        setImgDim({ width: img.width, height: img.height })
        imgObjRef.current = img
        setImageSrc(src)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  const loadDemo = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 900
    canvas.height = 900
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Cosmic sunset graphic
      const grad = ctx.createLinearGradient(0, 0, 900, 900)
      grad.addColorStop(0, '#3b82f6')
      grad.addColorStop(0.5, '#ec4899')
      grad.addColorStop(1, '#f59e0b')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 900, 900)

      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.beginPath()
      ctx.arc(450, 450, 260, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 72px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('HERMANOS', 450, 420)
      ctx.font = '32px sans-serif'
      ctx.fillText('GRID SLICER WORKSTATION', 450, 480)

      const url = canvas.toDataURL('image/png')
      const img = new Image()
      img.onload = () => {
        setImgDim({ width: 900, height: 900 })
        imgObjRef.current = img
        setImageSrc(url)
        setImageName('demo-grid.png')
      }
      img.src = url
    }
  }

  const slices = useMemo(() => {
    return calculateSlices(imgDim.width, imgDim.height, config, imageName || 'image')
  }, [imgDim, config, imageName])

  // Extract a single slice as data URL
  const renderSliceBlob = (slice: ImageSlice): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!imgObjRef.current) return resolve(null)
      const canvas = document.createElement('canvas')
      canvas.width = slice.width
      canvas.height = slice.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(null)

      ctx.drawImage(
        imgObjRef.current,
        slice.x,
        slice.y,
        slice.width,
        slice.height,
        0,
        0,
        slice.width,
        slice.height
      )

      const mime = `image/${config.format}`
      canvas.toBlob((blob) => resolve(blob), mime, config.quality)
    })
  }

  const handleDownloadSingle = async (slice: ImageSlice) => {
    const blob = await renderSliceBlob(slice)
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = slice.filename
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess(`Downloaded ${slice.filename}`)
  }

  const handleDownloadAllZip = async () => {
    if (slices.length === 0) return
    setExporting(true)
    try {
      const zip = new JSZip()
      for (const slice of slices) {
        const blob = await renderSliceBlob(slice)
        if (blob) {
          zip.file(slice.filename, blob)
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `slices-${imageName.replace(/\.[^/.]+$/, '') || 'grid'}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toastSuccess(`Downloaded ZIP archive with ${slices.length} image tiles`)
      recordHistoryQuietly('image-slicer', 'Image Slicer & Grid Splitter', 'images')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`Failed to create ZIP: ${message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 text-[13px] text-ink">
      {/* Main Split Layout */}
      {!imageSrc ? (
        <div className="flex flex-col gap-3">
          <DropZone
            onRawFiles={handleFiles}
            accept={['.png', '.jpg', '.jpeg', '.webp', '.avif', '.bmp']}
            label="Drop an image here to slice into grid tiles"
            hint="Supports PNG, JPG, WebP, AVIF, and BMP · click to browse"
            dialogTitle="Choose an image to slice"
          />
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadDemo}
              className="gap-1.5 cursor-pointer text-[11.5px]"
            >
              <Sparkles size={13} className="text-accent" />
              Load Sample Graphic
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
          {/* Left Config Panel */}
          <Panel className="lg:col-span-4 p-3.5 flex flex-col gap-3.5 overflow-y-auto">
            {/* Image Info & Reset */}
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <div className="flex items-center gap-2 truncate">
                <ImageIcon size={14} className="text-accent shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-ink text-[12px] truncate">{imageName}</div>
                  <div className="text-[10.5px] text-faint font-mono">
                    {imgDim.width} × {imgDim.height} px
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImageSrc(null)}
                className="text-[11px] text-accent hover:underline cursor-pointer shrink-0"
              >
                Replace
              </button>
            </div>

            {/* Quick Grid Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-semibold text-faint">Grid Presets</label>
              <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
                {[
                  { label: '3×3 Instagram Grid', cols: 3, rows: 3 },
                  { label: '3×1 Carousel Panorama', cols: 3, rows: 1 },
                  { label: '2×2 Square 4-Pack', cols: 2, rows: 2 },
                  { label: '2×1 Split Banner', cols: 2, rows: 1 }
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        mode: 'grid',
                        cols: p.cols,
                        rows: p.rows
                      }))
                    }
                    className={`p-1.5 rounded border text-left cursor-pointer ${
                      config.mode === 'grid' && config.cols === p.cols && config.rows === p.rows
                        ? 'border-accent bg-accent/10 text-accent font-semibold shadow-xs'
                        : 'border-line bg-base text-dim hover:text-ink'
                    }`}
                  >
                    <div className="text-[11px] font-medium">{p.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Columns & Rows Steppers */}
            <div className="space-y-2 border-t border-line/60 pt-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] text-faint block">Columns</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={config.cols}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        cols: Math.max(1, parseInt(e.target.value, 10) || 1)
                      }))
                    }
                    className="w-full rounded border border-line bg-base px-2.5 py-1 text-[12px] font-mono text-ink outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-faint block">Rows</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={config.rows}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        rows: Math.max(1, parseInt(e.target.value, 10) || 1)
                      }))
                    }
                    className="w-full rounded border border-line bg-base px-2.5 py-1 text-[12px] font-mono text-ink outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Output Format & Naming */}
            <div className="space-y-2 border-t border-line/60 pt-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] text-faint block">Export Format</span>
                  <select
                    value={config.format}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        format: e.target.value as 'png' | 'jpeg' | 'webp'
                      }))
                    }
                    className="w-full rounded border border-line bg-base px-2 py-1 text-[11.5px] text-ink outline-none"
                  >
                    <option value="png">PNG (Lossless)</option>
                    <option value="jpeg">JPEG (Compressed)</option>
                    <option value="webp">WebP (Modern)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-faint block">Naming Style</span>
                  <select
                    value={config.namingPattern}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        namingPattern: e.target.value as 'row-col' | 'sequential'
                      }))
                    }
                    className="w-full rounded border border-line bg-base px-2 py-1 text-[11.5px] text-ink outline-none"
                  >
                    <option value="row-col">Row & Col (r1_c1)</option>
                    <option value="sequential">Sequential (01, 02)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Summary & Batch ZIP Export */}
            <div className="mt-auto space-y-2 border-t border-line/60 pt-3">
              <div className="flex justify-between text-[11px] text-faint">
                <span>Total Slices:</span>
                <span className="font-mono font-bold text-ink">{slices.length} tiles</span>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleDownloadAllZip}
                disabled={exporting || slices.length === 0}
                className="w-full gap-2 cursor-pointer text-[12px]"
              >
                <Download size={14} />
                {exporting ? 'Packing ZIP...' : `Download All ${slices.length} Slices (ZIP)`}
              </Button>
            </div>
          </Panel>

          {/* Right Preview with Grid Overlay & Tiles List */}
          <div className="lg:col-span-8 flex flex-col gap-3 overflow-hidden">
            {/* Visual Canvas Overlay Preview */}
            <Panel className="flex-1 p-3 flex flex-col gap-2 min-h-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
                <span className="text-[11px] uppercase font-semibold text-faint">
                  Live Slice Overlay Preview
                </span>
                <span className="text-[10.5px] text-faint font-mono">
                  Tile size: ~{Math.round(imgDim.width / config.cols)} ×{' '}
                  {Math.round(imgDim.height / config.rows)} px
                </span>
              </div>

              <div className="flex-1 rounded border border-line bg-black/40 flex items-center justify-center p-3 overflow-hidden relative">
                <div className="relative inline-block max-h-full max-w-full">
                  <img
                    src={imageSrc}
                    alt="Source"
                    className="max-h-[260px] max-w-full object-contain rounded"
                  />

                  {/* Grid Lines Overlay */}
                  <div
                    className="absolute inset-0 grid pointer-events-none"
                    style={{
                      gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
                      gridTemplateRows: `repeat(${config.rows}, 1fr)`
                    }}
                  >
                    {slices.map((s) => (
                      <div
                        key={s.index}
                        className="border border-dashed border-accent/70 bg-accent/5 flex items-center justify-center relative"
                      >
                        <span className="bg-black/75 px-1.5 py-0.5 rounded text-[9.5px] font-mono text-white font-bold">
                          #{s.index}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            {/* Individual Tile Cards Strip */}
            <Panel className="h-36 p-3 flex flex-col gap-1.5 overflow-hidden">
              <div className="text-[11px] uppercase font-semibold text-faint">
                Individual Slices ({slices.length})
              </div>

              <div className="flex-1 flex gap-2 overflow-x-auto pb-1">
                {slices.map((slice) => (
                  <div
                    key={slice.index}
                    className="w-28 shrink-0 p-1.5 rounded border border-line bg-base/60 flex flex-col justify-between text-[10.5px]"
                  >
                    <div className="flex justify-between items-center text-dim font-mono">
                      <span className="font-bold text-accent">#{slice.index}</span>
                      <span className="text-[9.5px] text-faint">
                        {slice.width}×{slice.height}
                      </span>
                    </div>

                    <div className="truncate text-faint text-[9.5px] font-mono mt-0.5">
                      {slice.filename}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadSingle(slice)}
                      className="mt-1 w-full py-0.5 rounded border border-line bg-base hover:bg-surface text-ink text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Download size={10} />
                      Save
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
