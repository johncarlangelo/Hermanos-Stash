import { useMemo, useState } from 'react'
import { ArrowLeftRight, Check, Copy, Download, FileCode } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  DEFAULT_XML_JSON_OPTIONS,
  formatXml,
  jsonToXml,
  xmlToJson,
  type XmlJsonOptions
} from './logic'

const SAMPLES = {
  xmlConfig: `<?xml version="1.0" encoding="UTF-8"?>
<application id="app-01" env="production">
  <server>
    <host>127.0.0.1</host>
    <port>8080</port>
    <ssl enabled="true"/>
  </server>
  <features>
    <feature enabled="true">DarkTheme</feature>
    <feature enabled="true">LocalFirst</feature>
    <feature enabled="false">CloudSync</feature>
  </features>
</application>`,

  xmlRss: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Hermanos Stash Changelog</title>
    <link>https://hermanos-stash.local</link>
    <item>
      <title>v1.2.0 Released</title>
      <pubDate>Mon, 01 Sep 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`,

  jsonConfig: `{
  "store": {
    "@name": "Hermanos Hardware",
    "location": "Metro Manila",
    "inventory": [
      {
        "id": "item-101",
        "name": "MicroSD 512GB",
        "price": 24.99
      },
      {
        "id": "item-102",
        "name": "USB-C Fast Cable",
        "price": 9.50
      }
    ]
  }
}`
}

export default function XmlJsonTool() {
  const [mode, setMode] = useState<'xml-to-json' | 'json-to-xml'>('xml-to-json')
  const [inputCode, setInputCode] = useState<string>(SAMPLES.xmlConfig)
  const [options, setOptions] = useState<XmlJsonOptions>(DEFAULT_XML_JSON_OPTIONS)
  const [copied, setCopied] = useState(false)

  // Perform live conversion
  const { outputCode, error } = useMemo(() => {
    if (!inputCode.trim()) return { outputCode: '', error: null }
    try {
      if (mode === 'xml-to-json') {
        const json = xmlToJson(inputCode, options)
        return { outputCode: json, error: null }
      } else {
        const xml = jsonToXml(inputCode, options)
        return { outputCode: xml, error: null }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { outputCode: '', error: message || 'Conversion error' }
    }
  }, [inputCode, mode, options])

  const handleSwapMode = () => {
    if (outputCode) {
      setInputCode(outputCode)
    }
    setMode((m) => (m === 'xml-to-json' ? 'json-to-xml' : 'xml-to-json'))
  }

  const handleFormatInput = () => {
    try {
      if (mode === 'xml-to-json') {
        setInputCode(formatXml(inputCode, options.indent))
        toastSuccess('Formatted XML input')
      } else {
        const parsed = JSON.parse(inputCode)
        setInputCode(JSON.stringify(parsed, null, options.indent))
        toastSuccess('Formatted JSON input')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toastError(message || 'Invalid syntax to format')
    }
  }

  const handleCopy = async () => {
    if (!outputCode) return
    await navigator.clipboard.writeText(outputCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toastSuccess(`Copied ${mode === 'xml-to-json' ? 'JSON' : 'XML'} to clipboard`)
    recordHistoryQuietly('xml-json', 'XML ⇄ JSON Converter', 'text')
  }

  const handleDownload = () => {
    if (!outputCode) return
    const ext = mode === 'xml-to-json' ? 'json' : 'xml'
    const blob = new Blob([outputCode], {
      type: mode === 'xml-to-json' ? 'application/json' : 'application/xml'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `converted.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess(`Downloaded .${ext} file`)
    recordHistoryQuietly('xml-json', 'XML ⇄ JSON Converter', 'text')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Top Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <FileCode size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">XML ⇄ JSON Converter & Formatter</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            Bi-directional Parser
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-faint">Presets:</span>
          <button
            type="button"
            onClick={() => {
              setMode('xml-to-json')
              setInputCode(SAMPLES.xmlConfig)
            }}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            App Config (XML)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('xml-to-json')
              setInputCode(SAMPLES.xmlRss)
            }}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            RSS Feed (XML)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('json-to-xml')
              setInputCode(SAMPLES.jsonConfig)
            }}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            Store Inventory (JSON)
          </button>
        </div>
      </div>

      {/* Toolbar / Options */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-surface/60 p-2 rounded-md border border-line/60 text-[11.5px]">
        {/* Mode Selector */}
        <div className="flex items-center gap-1 bg-base p-0.5 rounded border border-line">
          <button
            type="button"
            onClick={() => setMode('xml-to-json')}
            className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
              mode === 'xml-to-json'
                ? 'bg-surface text-accent shadow-xs'
                : 'text-dim hover:text-ink'
            }`}
          >
            XML ➔ JSON
          </button>
          <button
            type="button"
            onClick={() => setMode('json-to-xml')}
            className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
              mode === 'json-to-xml'
                ? 'bg-surface text-accent shadow-xs'
                : 'text-dim hover:text-ink'
            }`}
          >
            JSON ➔ XML
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-faint">Attr Prefix:</span>
            <select
              value={options.attrPrefix}
              onChange={(e) => setOptions((prev) => ({ ...prev, attrPrefix: e.target.value }))}
              className="rounded border border-line bg-base px-1.5 py-0.5 text-ink outline-none"
            >
              <option value="@">@ (e.g. @id)</option>
              <option value="_">_ (e.g. _id)</option>
              <option value="$">$ (e.g. $id)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-faint">Indent:</span>
            <select
              value={options.indent}
              onChange={(e) => setOptions((prev) => ({ ...prev, indent: Number(e.target.value) }))}
              className="rounded border border-line bg-base px-1.5 py-0.5 text-ink outline-none"
            >
              <option value={2}>2 Spaces</option>
              <option value={4}>4 Spaces</option>
            </select>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleFormatInput}
            className="cursor-pointer text-[11px]"
          >
            Format Input
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleSwapMode}
            className="gap-1 cursor-pointer text-[11px]"
          >
            <ArrowLeftRight size={12} />
            Swap Direction
          </Button>
        </div>
      </div>

      {/* Main Split Panels */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0 overflow-hidden">
        {/* Left Input */}
        <Panel className="p-3 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
            <span className="text-[11px] uppercase font-semibold text-faint">
              Input {mode === 'xml-to-json' ? 'XML' : 'JSON'}
            </span>
            <span className="text-[10.5px] text-faint font-mono">
              {inputCode.length.toLocaleString()} chars · {inputCode.split('\n').length} lines
            </span>
          </div>

          <textarea
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            placeholder={
              mode === 'xml-to-json' ? 'Paste XML markup here...' : 'Paste JSON code here...'
            }
            className="flex-1 w-full rounded border border-line bg-base p-2.5 font-mono text-[11.5px] text-ink outline-none focus:border-accent resize-none leading-relaxed select-all"
          />
        </Panel>

        {/* Right Output */}
        <Panel className="p-3 flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
            <span className="text-[11px] uppercase font-semibold text-faint">
              Output {mode === 'xml-to-json' ? 'JSON' : 'XML'}
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                disabled={!outputCode}
                className="gap-1 cursor-pointer text-[11px]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleDownload}
                disabled={!outputCode}
                className="gap-1 cursor-pointer text-[11px]"
              >
                <Download size={12} />
                Download .{mode === 'xml-to-json' ? 'json' : 'xml'}
              </Button>
            </div>
          </div>

          {error ? (
            <div className="flex-1 rounded border border-rose-500/40 bg-rose-500/10 p-3 font-mono text-[11.5px] text-rose-400 overflow-auto">
              <div className="font-semibold mb-1">Parsing / Syntax Error:</div>
              <div>{error}</div>
            </div>
          ) : (
            <pre className="flex-1 rounded border border-line bg-base/90 p-2.5 font-mono text-[11.5px] text-ink overflow-auto select-all leading-relaxed">
              {outputCode || (
                <span className="text-faint italic">Converted code will appear here</span>
              )}
            </pre>
          )}
        </Panel>
      </div>
    </div>
  )
}
