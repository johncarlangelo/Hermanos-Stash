import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Download, Image as ImageIcon, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  CHAR_SETS,
  DEFAULT_ASCII_OPTIONS,
  convertPixelsToAscii,
  type AsciiConvertOptions,
  type CharSetPreset,
  type PixelData
} from './logic'

export default function ImageToAsciiTool() {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string>('')
  const [options, setOptions] = useState<AsciiConvertOptions>(DEFAULT_ASCII_OPTIONS)
  const [asciiResult, setAsciiResult] = useState<{ text: string; html: string; ansi: string }>({
    text: '',
    html: '',
    ansi: ''
  })
  const [fontSize, setFontSize] = useState<number>(7)
  const [copied, setCopied] = useState<string | null>(null)

  // Generate ASCII from loaded image
  const processImage = useCallback(() => {
    if (!imageSrc) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Monospace characters are roughly 2x taller than wide
      const targetWidth = options.width
      const aspect = img.height / img.width
      const targetHeight = Math.max(1, Math.round(targetWidth * aspect * 0.52))

      canvas.width = targetWidth
      canvas.height = targetHeight

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
      const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight)
      const data = imgData.data

      const grid: PixelData[][] = []
      for (let y = 0; y < targetHeight; y++) {
        const row: PixelData[] = []
        for (let x = 0; x < targetWidth; x++) {
          const idx = (y * targetWidth + x) * 4
          row.push({
            r: data[idx],
            g: data[idx + 1],
            b: data[idx + 2],
            a: data[idx + 3]
          })
        }
        grid.push(row)
      }

      const res = convertPixelsToAscii(grid, options)
      setAsciiResult(res)
    }
    img.src = imageSrc
  }, [imageSrc, options])

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

  // Load a quick sample icon image if user wants to demo immediately
  const loadDemo = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 128, 128)
      grad.addColorStop(0, '#f59e0b')
      grad.addColorStop(1, '#ef4444')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(64, 64, 56, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 50px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('H', 64, 64)
      setImageSrc(canvas.toDataURL('image/png'))
      setImageName('demo-avatar.png')
    }
  }

  const handleCopy = async (format: 'plain' | 'html' | 'ansi') => {
    const content =
      format === 'plain'
        ? asciiResult.text
        : format === 'html'
          ? asciiResult.html
          : asciiResult.ansi

    if (!content) return
    await navigator.clipboard.writeText(content)
    setCopied(format)
    setTimeout(() => setCopied(null), 2000)
    toastSuccess(`Copied ${format.toUpperCase()} to clipboard`)
    recordHistoryQuietly('image-to-ascii', 'Image to ASCII Converter', 'text')
  }

  const handleDownload = (format: 'txt' | 'html') => {
    const content =
      format === 'txt'
        ? asciiResult.text
        : `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ASCII Art - ${imageName}</title></head>
<body style="background:#09090b;color:#f4f4f5;font-family:monospace;font-size:10px;line-height:1;letter-spacing:0;white-space:pre;">
${asciiResult.html}
</body>
</html>`

    const blob = new Blob([content], {
      type: format === 'txt' ? 'text/plain' : 'text/html'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${imageName.replace(/\.[^/.]+$/, '') || 'ascii-art'}.${format}`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess(`Downloaded .${format} file`)
    recordHistoryQuietly('image-to-ascii', 'Image to ASCII Converter', 'text')
  }

  return (
    <div className="flex flex-col gap-4 text-[13px] text-ink">
      {/* Main Split Layout */}
      {!imageSrc ? (
        <div className="flex flex-col gap-3">
          <DropZone
            onRawFiles={handleFiles}
            accept={['.png', '.jpg', '.jpeg', '.webp', '.avif', '.bmp', '.svg']}
            label="Drop an image here to convert to ASCII art"
            hint="Supports PNG, JPEG, WebP, AVIF, SVG, and BMP · click to browse"
            dialogTitle="Choose an image for ASCII conversion"
          />
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadDemo}
              className="gap-1.5 cursor-pointer text-[11.5px]"
            >
              <Sparkles size={13} className="text-accent" />
              Load Demo Graphic
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
          {/* Left Controls Panel */}
          <Panel className="lg:col-span-4 p-3.5 flex flex-col gap-3.5 overflow-y-auto">
            {/* Image Info & Reset */}
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <div className="flex items-center gap-2 truncate">
                <ImageIcon size={14} className="text-accent shrink-0" />
                <span className="text-[11.5px] font-medium truncate text-ink">{imageName}</span>
              </div>
              <button
                type="button"
                onClick={() => setImageSrc(null)}
                className="text-[11px] text-faint hover:text-ink cursor-pointer underline"
              >
                Change Image
              </button>
            </div>

            {/* Character Set Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-semibold text-faint">
                Character Ramp
              </label>
              <div className="grid grid-cols-2 gap-1 text-[11.5px]">
                {(
                  ['standard', 'dense', 'blocks', 'binary', 'braille', 'minimal'] as CharSetPreset[]
                ).map((set) => (
                  <button
                    key={set}
                    type="button"
                    onClick={() => setOptions((prev) => ({ ...prev, charSetPreset: set }))}
                    className={`p-1.5 rounded border capitalize text-left transition-colors cursor-pointer ${
                      options.charSetPreset === set
                        ? 'border-accent bg-accent/10 text-accent font-semibold'
                        : 'border-line bg-base text-dim hover:text-ink'
                    }`}
                  >
                    <div className="text-[11px]">{set}</div>
                    <div className="text-[9.5px] text-faint truncate font-mono">
                      {CHAR_SETS[set as keyof typeof CHAR_SETS]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution Columns Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-faint">Output Width (Columns)</span>
                <span className="font-mono text-ink font-semibold">{options.width} cols</span>
              </div>
              <input
                type="range"
                min={30}
                max={150}
                step={2}
                value={options.width}
                onChange={(e) => setOptions((prev) => ({ ...prev, width: Number(e.target.value) }))}
                className="w-full accent-accent"
              />
            </div>

            {/* Contrast & Brightness Sliders */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-faint">Contrast</span>
                  <span className="font-mono text-ink">{options.contrast}%</span>
                </div>
                <input
                  type="range"
                  min={-80}
                  max={80}
                  step={5}
                  value={options.contrast}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, contrast: Number(e.target.value) }))
                  }
                  className="w-full accent-accent"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-faint">Brightness</span>
                  <span className="font-mono text-ink">{options.brightness}%</span>
                </div>
                <input
                  type="range"
                  min={-80}
                  max={80}
                  step={5}
                  value={options.brightness}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, brightness: Number(e.target.value) }))
                  }
                  className="w-full accent-accent"
                />
              </div>
            </div>

            {/* Color Mode & Invert */}
            <div className="space-y-2 border-t border-line/60 pt-2.5">
              <div className="space-y-1">
                <span className="text-[11px] text-faint uppercase font-semibold">Render Mode</span>
                <div className="grid grid-cols-3 gap-1 text-[11px]">
                  {[
                    { id: 'plain', label: 'Plain Text' },
                    { id: 'html', label: 'HTML Color' },
                    { id: 'ansi', label: 'ANSI Code' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({
                          ...prev,
                          colorMode: mode.id as 'plain' | 'html' | 'ansi'
                        }))
                      }
                      className={`py-1.5 rounded border text-center font-medium cursor-pointer ${
                        options.colorMode === mode.id
                          ? 'border-accent bg-surface text-accent'
                          : 'border-line bg-base text-dim hover:text-ink'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11.5px] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={options.invert}
                  onChange={(e) => setOptions((prev) => ({ ...prev, invert: e.target.checked }))}
                  className="rounded border-line accent-accent"
                />
                <span>Invert Character Ramp (Light on Dark)</span>
              </label>
            </div>
          </Panel>

          {/* Right Preview & Export Panel */}
          <Panel className="lg:col-span-8 p-3.5 flex flex-col gap-2 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              {/* Zoom font size controls */}
              <div className="flex items-center gap-1.5 text-[11.5px] text-faint">
                <span>Font Preview:</span>
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.max(3, s - 1))}
                  className="p-1 rounded hover:bg-base text-dim hover:text-ink"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="font-mono text-ink">{fontSize}px</span>
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.min(18, s + 1))}
                  className="p-1 rounded hover:bg-base text-dim hover:text-ink"
                >
                  <ZoomIn size={13} />
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(options.colorMode)}
                  className="gap-1 cursor-pointer text-[11.5px]"
                >
                  {copied === options.colorMode ? <Check size={12} /> : <Copy size={12} />}
                  {copied === options.colorMode
                    ? 'Copied!'
                    : `Copy ${options.colorMode.toUpperCase()}`}
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleDownload(options.colorMode === 'html' ? 'html' : 'txt')}
                  className="gap-1 cursor-pointer text-[11.5px]"
                >
                  <Download size={12} />
                  Download .{options.colorMode === 'html' ? 'html' : 'txt'}
                </Button>
              </div>
            </div>

            {/* Monospace Render Area */}
            <div className="flex-1 rounded border border-line bg-black p-3 overflow-auto select-all">
              {options.colorMode === 'html' ? (
                <div
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.05',
                    fontFamily: 'monospace',
                    letterSpacing: '0px',
                    whiteSpace: 'pre'
                  }}
                  dangerouslySetInnerHTML={{ __html: asciiResult.html }}
                />
              ) : (
                <pre
                  style={{
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.05',
                    fontFamily: 'monospace',
                    letterSpacing: '0px'
                  }}
                  className="text-ink whitespace-pre"
                >
                  {options.colorMode === 'ansi' ? asciiResult.ansi : asciiResult.text}
                </pre>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
