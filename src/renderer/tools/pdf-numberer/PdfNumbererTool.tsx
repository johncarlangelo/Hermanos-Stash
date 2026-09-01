import { useState } from 'react'
import { Download, FileText, Hash } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  DEFAULT_NUMBERING_CONFIG,
  formatPageString,
  stampPdfPageNumbers,
  type NumberPosition,
  type NumberingFormat,
  type PdfNumberingConfig
} from './logic'

export default function PdfNumbererTool() {
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [config, setConfig] = useState<PdfNumberingConfig>(DEFAULT_NUMBERING_CONFIG)
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
      const stamped = await stampPdfPageNumbers(fileBytes, config)
      const blob = new Blob([stamped as unknown as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `numbered-${fileName || 'document.pdf'}`
      a.click()
      URL.revokeObjectURL(url)
      toastSuccess('Numbered PDF downloaded')
      recordHistoryQuietly('pdf-numberer', 'PDF Page Numberer', 'documents')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(`Failed to stamp numbers: ${message}`)
    } finally {
      setProcessing(false)
    }
  }

  const samplePreviewText = formatPageString(1, 12, config)

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Hash size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">PDF Page Numberer & Bates Stamper</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            Bates Stamping · Custom Positioning
          </span>
        </div>
      </div>

      {/* Main Split Layout */}
      {!fileBytes ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <DropZone
            onRawFiles={handleFiles}
            accept={['.pdf']}
            label="Drop a PDF here to stamp page numbers or Bates numbers"
            hint="Supports multi-page PDF documents"
            className="max-w-md w-full"
          />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
          {/* Left Configuration Panel */}
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

            {/* Numbering Format Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-semibold text-faint">
                Numbering Template
              </label>
              <div className="grid grid-cols-2 gap-1 text-[11px]">
                {[
                  { id: 'page-of-total', label: 'Page X of Y' },
                  { id: 'slash-total', label: 'X / Y' },
                  { id: 'dash-n', label: '- X -' },
                  { id: 'page-n', label: 'Page X' },
                  { id: 'bates', label: 'Bates (DOC-000001)' },
                  { id: 'custom', label: 'Custom Pattern' }
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, format: fmt.id as NumberingFormat }))
                    }
                    className={`p-1.5 rounded border text-left cursor-pointer ${
                      config.format === fmt.id
                        ? 'border-accent bg-surface text-accent font-semibold shadow-xs'
                        : 'border-line bg-base text-dim hover:text-ink'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bates Prefix & Digits */}
            {config.format === 'bates' && (
              <div className="grid grid-cols-2 gap-2 rounded border border-line bg-base/50 p-2.5">
                <div className="space-y-1">
                  <span className="text-[10.5px] text-faint">Bates Prefix</span>
                  <input
                    type="text"
                    value={config.batesPrefix}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, batesPrefix: e.target.value }))
                    }
                    className="w-full rounded border border-line bg-base px-2 py-1 text-ink font-mono text-[11.5px] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10.5px] text-faint">Digit Padding</span>
                  <input
                    type="number"
                    min={3}
                    max={10}
                    value={config.batesDigits}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        batesDigits: parseInt(e.target.value, 10) || 6
                      }))
                    }
                    className="w-full rounded border border-line bg-base px-2 py-1 text-ink font-mono text-[11.5px] outline-none"
                  />
                </div>
              </div>
            )}

            {/* Custom Pattern Input */}
            {config.format === 'custom' && (
              <div className="space-y-1">
                <span className="text-[10.5px] text-faint">
                  Custom Pattern (Use <code>{'{n}'}</code> and <code>{'{total}'}</code>)
                </span>
                <input
                  type="text"
                  value={config.customTemplate}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, customTemplate: e.target.value }))
                  }
                  className="w-full rounded border border-line bg-base px-2.5 py-1 text-ink font-mono text-[11.5px] outline-none"
                />
              </div>
            )}

            {/* 6-Position Grid Selector */}
            <div className="space-y-1.5 border-t border-line/60 pt-2">
              <label className="text-[11px] uppercase font-semibold text-faint">
                Position on Page
              </label>
              <div className="grid grid-cols-3 gap-1 text-[11px]">
                {[
                  { id: 'top-left', label: 'Top Left' },
                  { id: 'top-center', label: 'Top Center' },
                  { id: 'top-right', label: 'Top Right' },
                  { id: 'bottom-left', label: 'Bottom Left' },
                  { id: 'bottom-center', label: 'Bottom Center' },
                  { id: 'bottom-right', label: 'Bottom Right' }
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({ ...prev, position: pos.id as NumberPosition }))
                    }
                    className={`py-1.5 rounded border text-center font-medium transition-colors cursor-pointer ${
                      config.position === pos.id
                        ? 'border-accent bg-surface text-accent font-bold'
                        : 'border-line bg-base text-dim hover:text-ink'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Page Range Filter */}
            <div className="space-y-1 border-t border-line/60 pt-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-faint">Page Filter</span>
                <span className="text-faint text-[10.5px]">
                  e.g. &quot;all&quot; or &quot;2-&quot; (skip cover)
                </span>
              </div>
              <input
                type="text"
                value={config.pageRangeText}
                onChange={(e) => setConfig((prev) => ({ ...prev, pageRangeText: e.target.value }))}
                placeholder="all"
                className="w-full rounded border border-line bg-base px-2.5 py-1 text-ink font-mono text-[11.5px] outline-none"
              />
            </div>
          </Panel>

          {/* Right Visual Document Simulation & Download */}
          <Panel className="lg:col-span-6 p-3.5 flex flex-col justify-between gap-3 overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
              <span className="text-[11px] uppercase font-semibold text-faint">
                Page Stamp Layout Simulation
              </span>
              <span className="text-accent font-mono text-[11px] font-bold">
                {samplePreviewText}
              </span>
            </div>

            {/* Simulated Sheet Paper */}
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="w-56 h-72 rounded border border-line bg-white shadow-xl flex flex-col justify-between p-4 relative">
                {/* Header Positions */}
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-900">
                  <span
                    className={
                      config.position === 'top-left' ? 'font-bold text-blue-600' : 'opacity-0'
                    }
                  >
                    {samplePreviewText}
                  </span>
                  <span
                    className={
                      config.position === 'top-center' ? 'font-bold text-blue-600' : 'opacity-0'
                    }
                  >
                    {samplePreviewText}
                  </span>
                  <span
                    className={
                      config.position === 'top-right' ? 'font-bold text-blue-600' : 'opacity-0'
                    }
                  >
                    {samplePreviewText}
                  </span>
                </div>

                {/* Dummy page content lines */}
                <div className="space-y-2 opacity-20">
                  <div className="h-2 bg-zinc-400 rounded w-3/4" />
                  <div className="h-2 bg-zinc-300 rounded w-full" />
                  <div className="h-2 bg-zinc-300 rounded w-5/6" />
                  <div className="h-2 bg-zinc-300 rounded w-2/3" />
                </div>

                {/* Footer Positions */}
                <div className="flex justify-between items-center text-[10px] font-mono text-zinc-900">
                  <span
                    className={
                      config.position === 'bottom-left' ? 'font-bold text-blue-600' : 'opacity-0'
                    }
                  >
                    {samplePreviewText}
                  </span>
                  <span
                    className={
                      config.position === 'bottom-center' ? 'font-bold text-blue-600' : 'opacity-0'
                    }
                  >
                    {samplePreviewText}
                  </span>
                  <span
                    className={
                      config.position === 'bottom-right' ? 'font-bold text-blue-600' : 'opacity-0'
                    }
                  >
                    {samplePreviewText}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="border-t border-line/60 pt-2 flex items-center justify-between">
              <span className="text-[11px] text-faint">
                Applies stamped numbers losslessly to vector PDF stream
              </span>

              <Button
                variant="primary"
                size="md"
                onClick={handleDownload}
                disabled={processing}
                className="gap-2 cursor-pointer text-[12px]"
              >
                <Download size={13} />
                {processing ? 'Stamping PDF...' : 'Download Stamped PDF'}
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}
