import { useMemo, useState } from 'react'
import { Check, Copy, Download, Table as TableIcon } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  DEFAULT_TABLE_OPTIONS,
  generateAsciiTable,
  parseTableData,
  type TableOptions,
  type TableStyle
} from './logic'

const SAMPLES = {
  servers: `Host, Region, CPU%, Memory, Status
srv-us-east-1, us-east-1, 14.2%, 6.4 GB, ACTIVE
srv-eu-west-1, eu-west-1, 48.0%, 14.2 GB, ACTIVE
srv-ap-east-1, ap-east-1, 89.5%, 31.8 GB, WARNING
srv-backup-01, us-west-2, 2.1%, 1.2 GB, IDLE`,

  team: `ID, Name, Role, Team, Level
101, Elena Rostova, Lead Architect, Platform, L6
102, Marcus Vance, Senior Engineer, Frontend, L5
103, Kenji Sato, Security Specialist, DevOps, L5
104, Priya Patel, Data Engineer, Analytics, L4`,

  routes: `Method, Endpoint, Controller, Auth
GET, /api/v1/tools, ToolsController@index, None
POST, /api/v1/tools/run, ToolsController@execute, Bearer
GET, /api/v1/health, HealthController@check, None
DELETE, /api/v1/cache, AdminController@purge, MasterKey`,

  json: `[
  {"sku": "HS-001", "product": "Pro Stash License", "price": 49.00, "stock": 999},
  {"sku": "HS-002", "product": "Vector Studio Pack", "price": 19.50, "stock": 420},
  {"sku": "HS-003", "product": "Dev Master Kit", "price": 29.00, "stock": 150}
]`
}

export default function AsciiTableTool() {
  const [inputData, setInputData] = useState<string>(SAMPLES.servers)
  const [options, setOptions] = useState<TableOptions>(DEFAULT_TABLE_OPTIONS)
  const [copied, setCopied] = useState(false)

  const parsedGrid = useMemo(() => {
    return parseTableData(inputData)
  }, [inputData])

  const asciiTable = useMemo(() => {
    return generateAsciiTable(parsedGrid, options)
  }, [parsedGrid, options])

  const stats = useMemo(() => {
    if (!parsedGrid || parsedGrid.length === 0) return { rows: 0, cols: 0 }
    return {
      rows: options.hasHeader ? Math.max(0, parsedGrid.length - 1) : parsedGrid.length,
      cols: parsedGrid[0]?.length ?? 0
    }
  }, [parsedGrid, options.hasHeader])

  const handleCopy = async () => {
    if (!asciiTable) return
    await navigator.clipboard.writeText(asciiTable)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toastSuccess('Table copied to clipboard')
    recordHistoryQuietly('ascii-table', 'ASCII Table Generator', 'text')
  }

  const handleDownload = () => {
    if (!asciiTable) return
    const isMd = options.style === 'markdown'
    const blob = new Blob([asciiTable], {
      type: isMd ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `table.${isMd ? 'md' : 'txt'}`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess(`Table downloaded as .${isMd ? 'md' : 'txt'}`)
    recordHistoryQuietly('ascii-table', 'ASCII Table Generator', 'text')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <TableIcon size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">ASCII & Unicode Table Generator</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            Box-Drawing & Markdown
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-faint">Presets:</span>
          <button
            type="button"
            onClick={() => setInputData(SAMPLES.servers)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink hover:border-accent cursor-pointer"
          >
            Servers
          </button>
          <button
            type="button"
            onClick={() => setInputData(SAMPLES.team)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink hover:border-accent cursor-pointer"
          >
            Team
          </button>
          <button
            type="button"
            onClick={() => setInputData(SAMPLES.routes)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink hover:border-accent cursor-pointer"
          >
            API Routes
          </button>
          <button
            type="button"
            onClick={() => setInputData(SAMPLES.json)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink hover:border-accent cursor-pointer"
          >
            JSON
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left Inputs & Settings */}
        <Panel className="lg:col-span-5 p-3.5 flex flex-col gap-3 overflow-y-auto">
          {/* Data Textarea */}
          <div className="space-y-1.5 flex-1 flex flex-col min-h-[140px]">
            <label className="text-[11px] uppercase font-semibold text-faint flex items-center justify-between">
              <span>Input Data</span>
              <span className="text-[10px] text-faint lowercase">CSV, TSV, JSON, or Pipes</span>
            </label>
            <textarea
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              placeholder="Paste CSV, TSV, pipe-delimited text, or JSON array..."
              className="flex-1 w-full rounded border border-line bg-base p-2.5 font-mono text-[11.5px] text-ink outline-none focus:border-accent resize-none leading-relaxed"
            />
          </div>

          {/* Table Style Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase font-semibold text-faint">Table Style</label>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              {[
                { id: 'unicode-single', label: 'Unicode Single ┌─┐' },
                { id: 'unicode-double', label: 'Unicode Double ╔═╗' },
                { id: 'unicode-rounded', label: 'Unicode Rounded ╭─╮' },
                { id: 'markdown', label: 'Markdown |---|' },
                { id: 'ascii-simple', label: 'ASCII Simple +-+' },
                { id: 'ascii-compact', label: 'ASCII Dots .-.' },
                { id: 'sql', label: 'SQL Terminal +---+' }
              ].map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setOptions((prev) => ({ ...prev, style: style.id as TableStyle }))}
                  className={`p-1.5 rounded border text-left font-mono transition-colors cursor-pointer ${
                    options.style === style.id
                      ? 'border-accent bg-surface text-accent font-semibold'
                      : 'border-line bg-base text-dim hover:text-ink'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table Toggles */}
          <div className="space-y-2 border-t border-line/60 pt-2 text-[11.5px]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.hasHeader}
                onChange={(e) => setOptions((prev) => ({ ...prev, hasHeader: e.target.checked }))}
                className="rounded border-line accent-accent"
              />
              <span>First row is Header row</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeRowIndex}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, includeRowIndex: e.target.checked }))
                }
                className="rounded border-line accent-accent"
              />
              <span>Include Row Index Column (#)</span>
            </label>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <span className="text-[11px] text-faint block">Alignment</span>
                <select
                  value={options.align}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      align: e.target.value as 'auto' | 'left' | 'center' | 'right'
                    }))
                  }
                  className="w-full rounded border border-line bg-base px-2 py-1 text-ink text-[11.5px] outline-none"
                >
                  <option value="auto">Auto (Numbers Right)</option>
                  <option value="left">Left Aligned</option>
                  <option value="center">Center Aligned</option>
                  <option value="right">Right Aligned</option>
                </select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-faint block">Padding</span>
                <select
                  value={options.padding}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, padding: Number(e.target.value) }))
                  }
                  className="w-full rounded border border-line bg-base px-2 py-1 text-ink text-[11.5px] outline-none"
                >
                  <option value={1}>1 Space (Compact)</option>
                  <option value={2}>2 Spaces (Breathable)</option>
                </select>
              </div>
            </div>
          </div>
        </Panel>

        {/* Right Output Panel */}
        <Panel className="lg:col-span-7 p-3.5 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <div className="flex items-center gap-2 text-[11.5px] text-faint">
              <span>
                Grid: <strong className="text-ink font-mono">{stats.cols}</strong> cols ×{' '}
                <strong className="text-ink font-mono">{stats.rows}</strong> rows
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                className="gap-1 cursor-pointer text-[11.5px]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy Table'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleDownload}
                className="gap-1 cursor-pointer text-[11.5px]"
              >
                <Download size={12} />
                Download
              </Button>
            </div>
          </div>

          <div className="flex-1 rounded border border-line bg-base/90 p-3 font-mono text-[11px] text-ink overflow-auto select-all leading-relaxed">
            {asciiTable ? (
              <pre className="whitespace-pre">{asciiTable}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-faint italic">
                Enter table data on the left to render table
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
