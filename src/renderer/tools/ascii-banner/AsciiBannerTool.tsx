import { useMemo, useState } from 'react'
import { Check, Copy, Download, Terminal, Type } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { FONTS } from './fonts'
import {
  DEFAULT_BANNER_OPTIONS,
  generateAsciiBanner,
  type BannerOptions,
  type BorderStyle
} from './logic'

const PRESETS = ['HERMANOS', 'STASH', 'TERMINAL', 'LOCAL FIRST', 'DEV SUITE', 'OFFLINE']

export default function AsciiBannerTool() {
  const [text, setText] = useState('HERMANOS')
  const [options, setOptions] = useState<BannerOptions>(DEFAULT_BANNER_OPTIONS)
  const [copied, setCopied] = useState(false)

  const asciiOutput = useMemo(() => {
    return generateAsciiBanner(text, options)
  }, [text, options])

  const lineCount = useMemo(() => {
    return asciiOutput ? asciiOutput.split('\n').length : 0
  }, [asciiOutput])

  const maxCols = useMemo(() => {
    if (!asciiOutput) return 0
    return Math.max(...asciiOutput.split('\n').map((l) => l.length), 0)
  }, [asciiOutput])

  const handleCopy = async () => {
    if (!asciiOutput) return
    await navigator.clipboard.writeText(asciiOutput)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toastSuccess('ASCII Banner copied to clipboard')
    recordHistoryQuietly('ascii-banner', 'ASCII Banner Generator', 'text')
  }

  const handleDownload = () => {
    if (!asciiOutput) return
    const blob = new Blob([asciiOutput], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `banner-${
      text
        .slice(0, 12)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_') || 'ascii'
    }.txt`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess('Banner downloaded as text file')
    recordHistoryQuietly('ascii-banner', 'ASCII Banner Generator', 'text')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Top Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">ASCII Art & Banner Generator</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            FIGlet Typography
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-faint">Presets:</span>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setText(p)}
              className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink hover:border-accent transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left Controls Panel */}
        <Panel className="lg:col-span-4 p-3.5 flex flex-col gap-3.5 overflow-y-auto">
          {/* Text Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase font-semibold text-faint flex items-center justify-between">
              <span>Text Input</span>
              <span className="text-[10px] text-faint lowercase">A-Z, 0-9, symbols</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type something..."
              rows={3}
              className="w-full rounded border border-line bg-base p-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent resize-none leading-relaxed"
            />
          </div>

          {/* Font Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase font-semibold text-faint">Font Style</label>
            <div className="grid grid-cols-2 gap-1.5">
              {FONTS.map((font) => (
                <button
                  key={font.name}
                  type="button"
                  onClick={() => setOptions((prev) => ({ ...prev, font: font.name }))}
                  className={`p-2 rounded border text-left transition-all cursor-pointer ${
                    options.font === font.name
                      ? 'border-accent bg-accent/10 text-accent font-semibold shadow-xs'
                      : 'border-line bg-base/50 text-dim hover:text-ink hover:bg-base'
                  }`}
                >
                  <div className="text-[11.5px] truncate">{font.label.split(' (')[0]}</div>
                  <div className="text-[10px] text-faint truncate">
                    {font.height} lines · {font.name}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Border Frame Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase font-semibold text-faint">Border Frame</label>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              {(['single', 'double', 'rounded', 'stars', 'hash', 'none'] as BorderStyle[]).map(
                (b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setOptions((prev) => ({ ...prev, border: b }))}
                    className={`px-2 py-1.5 rounded border capitalize text-center transition-colors cursor-pointer ${
                      options.border === b
                        ? 'border-accent bg-surface text-accent font-medium'
                        : 'border-line bg-base text-dim hover:text-ink'
                    }`}
                  >
                    {b}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Spacing & Padding Sliders */}
          <div className="space-y-2.5 border-t border-line/60 pt-2.5">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-faint">Letter Spacing</span>
                <span className="font-mono text-ink">{options.letterSpacing}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={options.letterSpacing}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, letterSpacing: Number(e.target.value) }))
                }
                className="w-full accent-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-faint">Padding X</span>
                  <span className="font-mono text-ink">{options.paddingX}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={1}
                  value={options.paddingX}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, paddingX: Number(e.target.value) }))
                  }
                  className="w-full accent-accent"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-faint">Padding Y</span>
                  <span className="font-mono text-ink">{options.paddingY}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={options.paddingY}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, paddingY: Number(e.target.value) }))
                  }
                  className="w-full accent-accent"
                />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-faint block">Alignment</span>
              <div className="grid grid-cols-3 gap-1 text-[11px]">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => setOptions((prev) => ({ ...prev, align }))}
                    className={`py-1 rounded border capitalize text-center cursor-pointer ${
                      options.align === align
                        ? 'border-accent bg-surface text-accent font-medium'
                        : 'border-line bg-base text-dim hover:text-ink'
                    }`}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* Right Output Panel */}
        <Panel className="lg:col-span-8 p-3.5 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <div className="flex items-center gap-2 text-[11.5px] text-faint">
              <Type size={13} className="text-accent" />
              <span>
                Dimensions: <strong className="text-ink font-mono">{maxCols}</strong> cols ×{' '}
                <strong className="text-ink font-mono">{lineCount}</strong> lines
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5 cursor-pointer text-[11.5px]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy ASCII'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleDownload}
                className="gap-1.5 cursor-pointer text-[11.5px]"
              >
                <Download size={12} />
                Download .txt
              </Button>
            </div>
          </div>

          <div className="flex-1 rounded border border-line bg-base/90 p-3 font-mono text-[11px] text-ink overflow-auto select-all leading-tight">
            {asciiOutput ? (
              <pre className="whitespace-pre">{asciiOutput}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-faint italic">
                Type in the input box to generate ASCII art
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
