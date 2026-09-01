import { useMemo, useState } from 'react'
import { Check, Copy, Download, Palette, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  DEFAULT_GRADIENT,
  PRESET_GRADIENTS,
  generateCssGradient,
  generateSvgGradient,
  type ColorStop,
  type GradientConfig,
  type GradientType
} from './logic'

export default function GradientStudioTool() {
  const [config, setConfig] = useState<GradientConfig>(DEFAULT_GRADIENT)
  const [exportFormat, setExportFormat] = useState<'css' | 'svg'>('css')
  const [copied, setCopied] = useState(false)

  const cssGradient = useMemo(() => generateCssGradient(config), [config])
  const svgGradient = useMemo(() => generateSvgGradient(config), [config])

  const handleAddStop = () => {
    const newStop: ColorStop = {
      id: `stop-${Date.now()}`,
      color: '#3b82f6',
      position: 50,
      opacity: 1
    }
    setConfig((prev) => ({
      ...prev,
      stops: [...prev.stops, newStop]
    }))
  }

  const handleUpdateStop = (id: string, updates: Partial<ColorStop>) => {
    setConfig((prev) => ({
      ...prev,
      stops: prev.stops.map((s) => (s.id === id ? { ...s, ...updates } : s))
    }))
  }

  const handleRemoveStop = (id: string) => {
    if (config.stops.length <= 2) return
    setConfig((prev) => ({
      ...prev,
      stops: prev.stops.filter((s) => s.id !== id)
    }))
  }

  const handleCopy = async () => {
    const code = exportFormat === 'css' ? `background: ${cssGradient};` : svgGradient
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toastSuccess(`Copied ${exportFormat.toUpperCase()} to clipboard`)
    recordHistoryQuietly('gradient-studio', 'CSS & Vector Gradient Studio', 'images')
  }

  const handleDownloadPng = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 1920
    canvas.height = 1080
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw linear/radial gradient
    if (config.type === 'linear') {
      const angleRad = (config.angle * Math.PI) / 180
      const x1 = Math.round(960 - Math.cos(angleRad) * 960)
      const y1 = Math.round(540 - Math.sin(angleRad) * 540)
      const x2 = Math.round(960 + Math.cos(angleRad) * 960)
      const y2 = Math.round(540 + Math.sin(angleRad) * 540)
      const grad = ctx.createLinearGradient(x1, y1, x2, y2)
      config.stops.forEach((s) => grad.addColorStop(s.position / 100, s.color))
      ctx.fillStyle = grad
    } else {
      const grad = ctx.createRadialGradient(960, 540, 50, 960, 540, 960)
      config.stops.forEach((s) => grad.addColorStop(s.position / 100, s.color))
      ctx.fillStyle = grad
    }
    ctx.fillRect(0, 0, 1920, 1080)

    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `gradient-${config.type}.png`
    a.click()
    toastSuccess('Downloaded 1920x1080 Gradient PNG')
    recordHistoryQuietly('gradient-studio', 'CSS & Vector Gradient Studio', 'images')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Top Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">CSS & Vector Gradient Studio</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            Linear · Radial · Conic · SVG Export
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-faint">Presets:</span>
          {PRESET_GRADIENTS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => setConfig(p.config)}
              className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink hover:border-accent cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left Controls */}
        <Panel className="lg:col-span-5 p-3.5 flex flex-col gap-3 overflow-y-auto">
          {/* Gradient Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase font-semibold text-faint">Gradient Type</label>
            <div className="grid grid-cols-4 gap-1 text-[11px]">
              {(['linear', 'radial', 'conic', 'mesh'] as GradientType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, type }))}
                  className={`py-1.5 rounded border capitalize text-center font-medium transition-colors cursor-pointer ${
                    config.type === type
                      ? 'border-accent bg-surface text-accent font-semibold shadow-xs'
                      : 'border-line bg-base text-dim hover:text-ink'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Angle / Direction Slider (Linear & Conic) */}
          {(config.type === 'linear' || config.type === 'conic') && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11.5px]">
                <span className="text-faint">Angle / Rotation</span>
                <span className="font-mono text-ink font-bold">{config.angle}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={config.angle}
                onChange={(e) => setConfig((prev) => ({ ...prev, angle: Number(e.target.value) }))}
                className="w-full accent-accent"
              />
            </div>
          )}

          {/* Color Stops List */}
          <div className="space-y-2 border-t border-line/60 pt-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-semibold text-faint">
                Color Stops ({config.stops.length})
              </span>
              <button
                type="button"
                onClick={handleAddStop}
                className="text-[11px] text-accent hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} />
                <span>Add Stop</span>
              </button>
            </div>

            <div className="space-y-2">
              {config.stops.map((stop) => (
                <div
                  key={stop.id}
                  className="p-2 rounded border border-line bg-base/60 flex items-center gap-2 text-[11.5px]"
                >
                  <input
                    type="color"
                    value={stop.color}
                    onChange={(e) => handleUpdateStop(stop.id, { color: e.target.value })}
                    className="w-7 h-7 rounded border border-line bg-transparent cursor-pointer shrink-0"
                  />

                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-[10.5px]">
                      <span className="font-mono text-ink font-bold">{stop.color}</span>
                      <span className="font-mono text-faint">{stop.position}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={stop.position}
                      onChange={(e) =>
                        handleUpdateStop(stop.id, { position: Number(e.target.value) })
                      }
                      className="w-full accent-accent h-1.5"
                    />
                  </div>

                  {config.stops.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStop(stop.id)}
                      className="text-faint hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Right Live Canvas & Code Export */}
        <div className="lg:col-span-7 flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* Visual Canvas Display */}
          <Panel className="flex-1 p-3 flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
              <span className="text-[11px] uppercase font-semibold text-faint">
                Live Studio Canvas
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDownloadPng}
                className="gap-1 cursor-pointer text-[11px] py-0.5"
              >
                <Download size={12} />
                Download PNG (1080p)
              </Button>
            </div>

            <div
              className="flex-1 w-full rounded-md border border-line shadow-inner transition-all duration-200 min-h-[180px]"
              style={{ background: cssGradient }}
            />
          </Panel>

          {/* Export Code Drawer */}
          <Panel className="h-44 p-3 flex flex-col gap-2 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase font-semibold text-faint">Export Code:</span>
                <div className="flex items-center gap-1 bg-base p-0.5 rounded border border-line text-[10.5px]">
                  <button
                    type="button"
                    onClick={() => setExportFormat('css')}
                    className={`px-2 py-0.5 rounded font-mono cursor-pointer ${
                      exportFormat === 'css'
                        ? 'bg-surface text-accent font-bold'
                        : 'text-faint hover:text-ink'
                    }`}
                  >
                    CSS
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('svg')}
                    className={`px-2 py-0.5 rounded font-mono cursor-pointer ${
                      exportFormat === 'svg'
                        ? 'bg-surface text-accent font-bold'
                        : 'text-faint hover:text-ink'
                    }`}
                  >
                    SVG
                  </button>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                className="gap-1 cursor-pointer text-[11px] py-0.5"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy Code'}
              </Button>
            </div>

            <pre className="flex-1 rounded border border-line bg-base/90 p-2 font-mono text-[11px] text-ink overflow-auto select-all leading-relaxed">
              {exportFormat === 'css' ? `background: ${cssGradient};` : svgGradient}
            </pre>
          </Panel>
        </div>
      </div>
    </div>
  )
}
