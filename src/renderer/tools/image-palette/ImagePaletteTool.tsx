import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { extractDominantColors, generatePaletteCode, type SwatchColor } from './logic'

export default function ImagePaletteTool() {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string>('')
  const [colorCount, setColorCount] = useState<number>(6)
  const [swatches, setSwatches] = useState<SwatchColor[]>([])
  const [exportFormat, setExportFormat] = useState<'css' | 'tailwind' | 'json'>('css')
  const [copied, setCopied] = useState<string | null>(null)

  const processImage = useCallback(() => {
    if (!imageSrc) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Downsample for rapid extraction
      const maxDim = 200
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const colors = extractDominantColors(imgData.data, colorCount)
      setSwatches(colors)
    }
    img.src = imageSrc
  }, [imageSrc, colorCount])

  useEffect(() => {
    processImage()
  }, [processImage])

  const handleFiles = (files: File[]) => {
    const file = files[0]
    if (!file) return
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      setImageSrc(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const loadDemo = (type: 'sunset' | 'cyber' | 'forest') => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 256, 256)
      if (type === 'sunset') {
        grad.addColorStop(0, '#f97316')
        grad.addColorStop(0.5, '#ec4899')
        grad.addColorStop(1, '#6366f1')
      } else if (type === 'cyber') {
        grad.addColorStop(0, '#06b6d4')
        grad.addColorStop(0.5, '#3b82f6')
        grad.addColorStop(1, '#8b5cf6')
      } else {
        grad.addColorStop(0, '#10b981')
        grad.addColorStop(0.5, '#14b8a6')
        grad.addColorStop(1, '#059669')
      }
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 256, 256)
      setImageSrc(canvas.toDataURL('image/png'))
      setImageName(`demo-${type}.png`)
    }
  }

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
    toastSuccess(`Copied ${text}`)
    recordHistoryQuietly('image-palette', 'Image Color Palette Extractor', 'images')
  }

  const handleDownloadPaletteCard = () => {
    if (swatches.length === 0) return
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 360
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Background
    ctx.fillStyle = '#18181b'
    ctx.fillRect(0, 0, 800, 360)

    // Header Title
    ctx.fillStyle = '#f4f4f5'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText(`Color Palette — ${imageName || 'Image'}`, 32, 45)

    // Swatch Rectangles
    const pad = 32
    const totalW = 800 - pad * 2
    const swatchW = totalW / swatches.length

    swatches.forEach((s, idx) => {
      const x = pad + idx * swatchW
      const y = 70
      const h = 180

      ctx.fillStyle = s.hex
      ctx.fillRect(x, y, swatchW, h)

      // Hex label below
      ctx.fillStyle = '#f4f4f5'
      ctx.font = 'bold 13px monospace'
      ctx.fillText(s.hex, x + 6, y + h + 30)

      ctx.fillStyle = '#a1a1aa'
      ctx.font = '11px sans-serif'
      ctx.fillText(s.hsl, x + 6, y + h + 50)
    })

    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `palette-${imageName.replace(/\.[^/.]+$/, '') || 'swatches'}.png`
    a.click()
    toastSuccess('Downloaded Palette Card PNG')
    recordHistoryQuietly('image-palette', 'Image Color Palette Extractor', 'images')
  }

  const generatedCode = generatePaletteCode(swatches, exportFormat)

  return (
    <div className="flex flex-col gap-4 text-[13px] text-ink">
      {/* Main Split Layout */}
      {!imageSrc ? (
        <div className="flex flex-col gap-3">
          <DropZone
            onRawFiles={handleFiles}
            accept={['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg']}
            label="Drop an image here to extract its color palette"
            hint="Supports PNG, JPG, WebP, AVIF, and SVG · click to browse"
            dialogTitle="Choose an image for palette extraction"
          />
          <div className="flex items-center justify-center gap-2">
            <span className="text-[11.5px] text-faint">Or try a sample image:</span>
            <button
              type="button"
              onClick={() => loadDemo('sunset')}
              className="px-2.5 py-1 rounded border border-line bg-surface/60 text-[11.5px] text-dim hover:text-ink cursor-pointer transition-colors"
            >
              Sunset
            </button>
            <button
              type="button"
              onClick={() => loadDemo('cyber')}
              className="px-2.5 py-1 rounded border border-line bg-surface/60 text-[11.5px] text-dim hover:text-ink cursor-pointer transition-colors"
            >
              Cyberpunk
            </button>
            <button
              type="button"
              onClick={() => loadDemo('forest')}
              className="px-2.5 py-1 rounded border border-line bg-surface/60 text-[11.5px] text-dim hover:text-ink cursor-pointer transition-colors"
            >
              Forest
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
          {/* Left Preview & Swatches */}
          <div className="lg:col-span-8 flex flex-col gap-3 overflow-y-auto pr-1">
            {/* Image strip & Slider */}
            <Panel className="p-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 truncate">
                <img
                  src={imageSrc}
                  alt="Thumbnail"
                  className="w-10 h-10 rounded border border-line object-cover shrink-0"
                />
                <div className="truncate">
                  <div className="font-semibold text-ink text-[12px] truncate">{imageName}</div>
                  <button
                    type="button"
                    onClick={() => setImageSrc(null)}
                    className="text-[10.5px] text-accent hover:underline cursor-pointer"
                  >
                    Replace Image
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[11.5px]">
                  <span className="text-faint">Swatches:</span>
                  <input
                    type="range"
                    min={4}
                    max={10}
                    value={colorCount}
                    onChange={(e) => setColorCount(Number(e.target.value))}
                    className="w-24 accent-accent"
                  />
                  <span className="font-mono text-ink font-bold w-4">{colorCount}</span>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDownloadPaletteCard}
                  className="gap-1 cursor-pointer text-[11.5px]"
                >
                  <Download size={12} />
                  Export Palette PNG
                </Button>
              </div>
            </Panel>

            {/* Swatches Grid Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {swatches.map((s, i) => (
                <Panel key={i} className="p-2.5 flex flex-col gap-2 group">
                  {/* Swatch color chip */}
                  <div
                    className="w-full h-20 rounded-md border border-line/60 shadow-inner flex items-end justify-end p-1.5 transition-transform group-hover:scale-[1.02]"
                    style={{ backgroundColor: s.hex }}
                  >
                    <button
                      type="button"
                      onClick={() => handleCopy(s.hex, `hex-${i}`)}
                      className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white text-[10.5px] font-mono hover:bg-black/80 transition-colors cursor-pointer"
                    >
                      {copied === `hex-${i}` ? 'Copied' : s.hex}
                    </button>
                  </div>

                  {/* Color details */}
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between items-center text-dim font-mono text-[10.5px]">
                      <span>{s.rgb}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(s.rgb, `rgb-${i}`)}
                        className="text-faint hover:text-ink cursor-pointer"
                      >
                        <Copy size={10} />
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-faint font-mono text-[10.5px]">
                      <span>{s.hsl}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(s.hsl, `hsl-${i}`)}
                        className="text-faint hover:text-ink cursor-pointer"
                      >
                        <Copy size={10} />
                      </button>
                    </div>

                    {/* WCAG Contrast Tags */}
                    <div className="flex items-center justify-between pt-1 border-t border-line/40 text-[10px] text-faint">
                      <span>vs White: {s.contrastWhite}:1</span>
                      <span>vs Black: {s.contrastBlack}:1</span>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </div>

          {/* Right Export Code Panel */}
          <Panel className="lg:col-span-4 p-3.5 flex flex-col gap-2 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
              <span className="text-[11px] uppercase font-semibold text-faint">
                Export Palette Code
              </span>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(generatedCode, 'code')}
                className="gap-1 cursor-pointer text-[10.5px] py-0.5"
              >
                {copied === 'code' ? <Check size={11} /> : <Copy size={11} />}
                {copied === 'code' ? 'Copied' : 'Copy'}
              </Button>
            </div>

            {/* Format Selector */}
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              {(['css', 'tailwind', 'json'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setExportFormat(fmt)}
                  className={`py-1 rounded border uppercase text-center font-mono cursor-pointer ${
                    exportFormat === fmt
                      ? 'border-accent bg-surface text-accent font-bold'
                      : 'border-line bg-base text-dim hover:text-ink'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <pre className="flex-1 rounded border border-line bg-base/90 p-2.5 font-mono text-[11px] text-ink overflow-auto select-all leading-relaxed">
              {generatedCode}
            </pre>
          </Panel>
        </div>
      )}
    </div>
  )
}
