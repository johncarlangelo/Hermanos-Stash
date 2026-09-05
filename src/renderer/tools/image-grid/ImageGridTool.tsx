import { useCallback, useEffect, useState } from 'react'
import { Download, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  DEFAULT_GRID_CONFIG,
  calculateGridLayout,
  type GridItem,
  type GridLayoutConfig
} from './logic'

export default function ImageGridTool() {
  const [items, setItems] = useState<GridItem[]>([])
  const [config, setConfig] = useState<GridLayoutConfig>(DEFAULT_GRID_CONFIG)
  const [rendering, setRendering] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleFiles = (files: File[]) => {
    const loaded: Promise<GridItem>[] = files.map((file, idx) => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const src = e.target?.result as string
          const img = new Image()
          img.onload = () => {
            resolve({
              id: `img-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
              name: file.name,
              width: img.width,
              height: img.height,
              src
            })
          }
          img.src = src
        }
        reader.readAsDataURL(file)
      })
    })

    Promise.all(loaded).then((newItems) => {
      setItems((prev) => [...prev, ...newItems])
      toastSuccess(`Added ${newItems.length} images`)
    })
  }

  const loadDemo = () => {
    const colors = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444']
    const demoItems: GridItem[] = colors.map((col, idx) => {
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 400
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = col
        ctx.fillRect(0, 0, 400, 400)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 36px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`Asset ${idx + 1}`, 200, 200)
      }
      return {
        id: `demo-${idx}`,
        name: `asset-0${idx + 1}.png`,
        width: 400,
        height: 400,
        src: canvas.toDataURL('image/png')
      }
    })
    setItems(demoItems)
  }

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  // Render Grid onto Canvas
  const renderCanvas = useCallback(async () => {
    if (items.length === 0) {
      setPreviewUrl(null)
      return
    }

    setRendering(true)
    const layout = calculateGridLayout(items, config)
    const canvas = document.createElement('canvas')
    canvas.width = layout.totalWidth
    canvas.height = layout.totalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Background
    ctx.fillStyle = config.backgroundColor
    ctx.fillRect(0, 0, layout.totalWidth, layout.totalHeight)

    // Optional Header Title
    if (config.title) {
      ctx.fillStyle = config.backgroundColor === '#ffffff' ? '#18181b' : '#f4f4f5'
      ctx.font = 'bold 22px sans-serif'
      ctx.fillText(config.title, config.margin, config.margin + 26)
    }

    // Load & Draw Images
    const imagePromises = layout.cells.map((cell) => {
      return new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => {
          // Draw Image
          ctx.drawImage(img, cell.imgX, cell.imgY, cell.imgW, cell.imgH)

          // Draw Captions if enabled
          if (config.showCaptions) {
            ctx.fillStyle = config.backgroundColor === '#ffffff' ? '#27272a' : '#e4e4e7'
            ctx.font = '12px monospace'
            ctx.textAlign = 'center'
            const label = config.showIndex
              ? `#${cell.index} ${cell.item.name} (${cell.item.width}×${cell.item.height})`
              : `${cell.item.name}`
            ctx.fillText(label, cell.x + cell.cellW / 2, cell.captionY)
          }
          resolve()
        }
        img.src = cell.item.src
      })
    })

    await Promise.all(imagePromises)
    setPreviewUrl(canvas.toDataURL('image/png'))
    setRendering(false)
  }, [items, config])

  useEffect(() => {
    renderCanvas()
  }, [renderCanvas])

  const handleDownload = () => {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = `contact-sheet-${items.length}-images.png`
    a.click()
    toastSuccess('Contact sheet downloaded')
    recordHistoryQuietly('image-grid', 'Contact Sheet & Collage Grid', 'images')
  }

  return (
    <div className="flex flex-col gap-4 text-[13px] text-ink">
      {/* Main Split Layout */}
      {items.length === 0 ? (
        <div className="flex flex-col gap-3">
          <DropZone
            onRawFiles={handleFiles}
            multiple
            accept={['.png', '.jpg', '.jpeg', '.webp', '.avif']}
            label="Drop multiple images to assemble into a grid / contact sheet"
            hint="Supports batch selection of PNG, JPG, and WebP files · click to browse"
            dialogTitle="Choose images for grid"
          />
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadDemo}
              className="gap-1.5 cursor-pointer text-[11.5px]"
            >
              <Sparkles size={13} className="text-accent" />
              Load Sample Grid (6 Images)
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
          {/* Left Controls & Image List */}
          <Panel className="lg:col-span-4 p-3.5 flex flex-col gap-3 overflow-y-auto">
            {/* Header & Add More */}
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <span className="font-semibold text-[12px] text-ink">
                Loaded Images ({items.length})
              </span>
              <label className="text-[11px] text-accent hover:underline cursor-pointer flex items-center gap-1">
                <Plus size={12} />
                <span>Add More</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
                  className="hidden"
                />
              </label>
            </div>

            {/* Layout Sliders */}
            <div className="space-y-2.5 text-[11.5px]">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-faint">Grid Columns</span>
                  <span className="font-mono text-ink font-bold">{config.columns}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={config.columns}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, columns: Number(e.target.value) }))
                  }
                  className="w-full accent-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-faint">Gutter</span>
                    <span className="font-mono text-ink">{config.gutter}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={48}
                    step={4}
                    value={config.gutter}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, gutter: Number(e.target.value) }))
                    }
                    className="w-full accent-accent"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-faint">Margin</span>
                    <span className="font-mono text-ink">{config.margin}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={64}
                    step={8}
                    value={config.margin}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, margin: Number(e.target.value) }))
                    }
                    className="w-full accent-accent"
                  />
                </div>
              </div>

              {/* Background Color */}
              <div className="space-y-1">
                <span className="text-[11px] text-faint block">Canvas Background</span>
                <div className="grid grid-cols-3 gap-1 text-[11px]">
                  {[
                    { id: '#18181b', label: 'Dark (#18181b)' },
                    { id: '#09090b', label: 'Black (#09090b)' },
                    { id: '#ffffff', label: 'White (#ffffff)' }
                  ].map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, backgroundColor: bg.id }))}
                      className={`p-1.5 rounded border text-center cursor-pointer ${
                        config.backgroundColor === bg.id
                          ? 'border-accent bg-surface text-accent font-medium'
                          : 'border-line bg-base text-dim hover:text-ink'
                      }`}
                    >
                      {bg.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Captions */}
              <div className="space-y-2 border-t border-line/60 pt-2">
                <div className="space-y-1">
                  <span className="text-faint block text-[10.5px]">Header Title</span>
                  <input
                    type="text"
                    value={config.title || ''}
                    onChange={(e) => setConfig((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Project Assets"
                    className="w-full rounded border border-line bg-base px-2 py-1 text-ink text-[11.5px] outline-none focus:border-accent"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={config.showCaptions}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, showCaptions: e.target.checked }))
                    }
                    className="rounded border-line accent-accent"
                  />
                  <span>Show File Captions & Dimensions</span>
                </label>
              </div>
            </div>

            {/* Thumbnail items list */}
            <div className="space-y-1 border-t border-line/60 pt-2">
              <span className="text-[10.5px] uppercase font-semibold text-faint block">
                Item Queue ({items.length})
              </span>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-1.5 rounded border border-line bg-base/60 text-[11px]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-faint text-[10px]">#{idx + 1}</span>
                      <span className="truncate text-ink">{item.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.id)}
                      className="text-faint hover:text-rose-400 p-0.5 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {/* Right Live Visual Preview & Download */}
          <Panel className="lg:col-span-8 p-3.5 flex flex-col gap-2 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <span className="text-[11px] uppercase font-semibold text-faint">
                Contact Sheet Preview
              </span>

              <Button
                variant="primary"
                size="sm"
                onClick={handleDownload}
                disabled={!previewUrl || rendering}
                className="gap-1.5 cursor-pointer text-[11.5px]"
              >
                <Download size={13} />
                Download Full-Res Grid PNG
              </Button>
            </div>

            <div className="flex-1 rounded border border-line bg-black/60 flex items-center justify-center p-3 overflow-auto">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Contact Sheet Grid"
                  className="max-h-full max-w-full object-contain rounded shadow-lg"
                />
              ) : (
                <div className="text-faint italic">Rendering layout...</div>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
