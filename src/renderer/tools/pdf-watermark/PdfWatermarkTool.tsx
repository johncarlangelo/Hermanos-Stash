import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { DEFAULT_WATERMARK_CONFIG, stampPdfWatermark, type PdfWatermarkConfig } from './logic'

const PRESET_TEXTS = [
  'CONFIDENTIAL',
  'DRAFT',
  'DO NOT COPY',
  'SAMPLE',
  'INTERNAL ONLY',
  'TOP SECRET'
]

export default function PdfWatermarkTool() {
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [config, setConfig] = useState<PdfWatermarkConfig>(DEFAULT_WATERMARK_CONFIG)
  const [processing, setProcessing] = useState(false)

  const handleFiles = (files: File[]) => {
    const file = files[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      setFileBytes(e.target?.result as ArrayBuffer)
    }
    reader.readAsArrayBuffer(file)
  }

  const handleDownload = async () => {
    if (!fileBytes) return
    setProcessing(true)
    try {
      const stamped = await stampPdfWatermark(fileBytes, config)
      const blob = new Blob([stamped as unknown as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `watermarked-${fileName || 'document.pdf'}`
      a.click()
      URL.revokeObjectURL(url)
      toastSuccess('Watermarked PDF downloaded')
      recordHistoryQuietly('pdf-watermark', 'PDF Watermarker & Stamp', 'documents')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`Failed to stamp watermark: ${message}`)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 text-[13px] text-ink">
      {!fileBytes ? (
        <DropZone
          onRawFiles={handleFiles}
          accept={['.pdf']}
          label="Drop a PDF here to stamp watermarks"
          hint="Supports confidential, draft, and custom text stamps · click to browse"
          dialogTitle="Choose a PDF to watermark"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
          {/* Left Settings Panel */}
          <Panel className="lg:col-span-6 p-3.5 flex flex-col gap-3 overflow-y-auto">
            {/* File Info */}
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <div className="flex items-center gap-2 truncate">
                <FileText size={14} className="text-accent shrink-0" />
                <span className="font-semibold text-ink text-[12px] truncate">{fileName}</span>
              </div>
              <button
                type="button"
                onClick={() => setFileBytes(null)}
                className="text-[11px] text-accent hover:underline cursor-pointer"
              >
                Change PDF
              </button>
            </div>

            {/* Watermark Preset Chips */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-semibold text-faint">
                Preset Stamps
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TEXTS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, text: t }))}
                    className={`px-2 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
                      config.text === t
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-line bg-base text-dim hover:text-ink'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Text Input */}
            <div className="space-y-1">
              <span className="text-[11px] text-faint">Custom Watermark Text</span>
              <input
                type="text"
                value={config.text}
                onChange={(e) => setConfig((prev) => ({ ...prev, text: e.target.value }))}
                placeholder="Enter watermark text..."
                className="w-full rounded border border-line bg-base px-2.5 py-1.5 text-ink font-bold text-[13px] outline-none focus:border-accent"
              />
            </div>

            {/* Style Sliders: Angle, Size, Opacity */}
            <div className="space-y-2.5 border-t border-line/60 pt-2.5 text-[11.5px]">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-faint">Rotation Angle</span>
                    <span className="font-mono text-ink font-bold">{config.rotationDegrees}°</span>
                  </div>
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    step={5}
                    value={config.rotationDegrees}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        rotationDegrees: Number(e.target.value)
                      }))
                    }
                    className="w-full accent-accent"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-faint">Font Size</span>
                    <span className="font-mono text-ink font-bold">{config.fontSize}pt</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={90}
                    value={config.fontSize}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, fontSize: Number(e.target.value) }))
                    }
                    className="w-full accent-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-faint">Opacity</span>
                    <span className="font-mono text-ink font-bold">
                      {Math.round(config.opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={0.8}
                    step={0.05}
                    value={config.opacity}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, opacity: Number(e.target.value) }))
                    }
                    className="w-full accent-accent"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-faint block">Stamp Color</span>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {['#ef4444', '#71717a', '#f59e0b', '#3b82f6'].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, colorHex: col }))}
                        className={`w-6 h-6 rounded-full border cursor-pointer ${
                          config.colorHex === col ? 'ring-2 ring-accent ring-offset-2' : ''
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Tiled Mode */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={config.tiled}
                  onChange={(e) => setConfig((prev) => ({ ...prev, tiled: e.target.checked }))}
                  className="rounded border-line accent-accent"
                />
                <span>Tile 3×3 repeated watermark pattern across entire page</span>
              </label>
            </div>
          </Panel>

          {/* Right Visual Simulation & Download */}
          <Panel className="lg:col-span-6 p-3.5 flex flex-col justify-between gap-3 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
              <span className="text-[11px] uppercase font-semibold text-faint">
                Watermark Simulation
              </span>
              <span className="text-faint text-[10.5px]">Vector Rendered Layer</span>
            </div>

            {/* Simulated Paper Sheet */}
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="w-56 h-72 rounded border border-line bg-white shadow-xl flex items-center justify-center p-4 relative overflow-hidden">
                {/* Dummy text lines in background */}
                <div className="space-y-2 opacity-15 w-full">
                  <div className="h-2 bg-zinc-600 rounded w-3/4" />
                  <div className="h-2 bg-zinc-500 rounded w-full" />
                  <div className="h-2 bg-zinc-500 rounded w-5/6" />
                  <div className="h-2 bg-zinc-500 rounded w-full" />
                  <div className="h-2 bg-zinc-500 rounded w-2/3" />
                </div>

                {/* Overlaid Watermark Stamp */}
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none select-none text-center font-bold font-sans uppercase tracking-wider"
                  style={{
                    color: config.colorHex,
                    opacity: config.opacity,
                    transform: `rotate(${config.rotationDegrees}deg)`,
                    fontSize: `${Math.round(config.fontSize * 0.45)}px`
                  }}
                >
                  {config.tiled ? (
                    <div className="grid grid-cols-2 gap-4">
                      <span>{config.text}</span>
                      <span>{config.text}</span>
                      <span>{config.text}</span>
                      <span>{config.text}</span>
                    </div>
                  ) : (
                    <span>{config.text}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Download Bar */}
            <div className="border-t border-line/60 pt-2 flex items-center justify-between">
              <span className="text-[11px] text-faint">
                Applies watermark to all vector document pages
              </span>

              <Button
                variant="primary"
                size="md"
                onClick={handleDownload}
                disabled={processing}
                className="gap-2 cursor-pointer text-[12px]"
              >
                <Download size={13} />
                {processing ? 'Stamping...' : 'Download Watermarked PDF'}
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
