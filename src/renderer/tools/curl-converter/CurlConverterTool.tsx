import { useMemo, useState } from 'react'
import { Check, Copy, Download, Terminal } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { generateCodeFromCurl, parseCurlCommand, type TargetLanguage } from './logic'

const SAMPLES = {
  github: `curl https://api.github.com/repos/facebook/react/releases/latest \\
  -H "Accept: application/vnd.github.v3+json" \\
  -H "User-Agent: HermanosStash"`,

  openai: `curl https://api.openai.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Explain local-first software in 1 sentence."}]
  }'`,

  stripe: `curl https://api.stripe.com/v1/payment_intents \\
  -u sk_test_51Nz...: \\
  -d "amount=2000" \\
  -d "currency=usd" \\
  -d "payment_method_types[]=card"`
}

const LANGUAGES: { id: TargetLanguage; label: string; ext: string }[] = [
  { id: 'javascript-fetch', label: 'JS / TS (Fetch)', ext: 'ts' },
  { id: 'javascript-axios', label: 'JS / TS (Axios)', ext: 'ts' },
  { id: 'python-requests', label: 'Python (Requests)', ext: 'py' },
  { id: 'python-httpx', label: 'Python (HTTPX)', ext: 'py' },
  { id: 'go', label: 'Go (net/http)', ext: 'go' },
  { id: 'rust', label: 'Rust (Reqwest)', ext: 'rs' },
  { id: 'php', label: 'PHP (cURL)', ext: 'php' },
  { id: 'curl-clean', label: 'cURL (Formatted)', ext: 'sh' }
]

export default function CurlConverterTool() {
  const [curlInput, setCurlInput] = useState<string>(SAMPLES.openai)
  const [selectedLang, setSelectedLang] = useState<TargetLanguage>('javascript-fetch')
  const [copied, setCopied] = useState(false)

  const parsed = useMemo(() => {
    return parseCurlCommand(curlInput)
  }, [curlInput])

  const generatedCode = useMemo(() => {
    return generateCodeFromCurl(parsed, selectedLang)
  }, [parsed, selectedLang])

  const handleCopy = async () => {
    if (!generatedCode) return
    await navigator.clipboard.writeText(generatedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toastSuccess('Code copied to clipboard')
    recordHistoryQuietly('curl-converter', 'cURL ⇄ Code Generator', 'developer')
  }

  const handleDownload = () => {
    if (!generatedCode) return
    const langObj = LANGUAGES.find((l) => l.id === selectedLang)
    const ext = langObj?.ext || 'txt'
    const blob = new Blob([generatedCode], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `request.${ext}`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess(`Downloaded request.${ext}`)
    recordHistoryQuietly('curl-converter', 'cURL ⇄ Code Generator', 'developer')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Top Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">cURL ⇄ Code Generator</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            Fetch · Axios · Python · Go · Rust
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-faint">Presets:</span>
          <button
            type="button"
            onClick={() => setCurlInput(SAMPLES.openai)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            OpenAI Chat API
          </button>
          <button
            type="button"
            onClick={() => setCurlInput(SAMPLES.github)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            GitHub Releases
          </button>
          <button
            type="button"
            onClick={() => setCurlInput(SAMPLES.stripe)}
            className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] text-dim hover:text-ink cursor-pointer"
          >
            Stripe Charges
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left Input */}
        <Panel className="lg:col-span-5 p-3.5 flex flex-col gap-2.5 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
            <span className="text-[11px] uppercase font-semibold text-faint">
              cURL Input Command
            </span>
            <button
              type="button"
              onClick={() => setCurlInput('')}
              className="text-[11px] text-faint hover:text-ink cursor-pointer"
            >
              Clear
            </button>
          </div>

          <textarea
            value={curlInput}
            onChange={(e) => setCurlInput(e.target.value)}
            placeholder="Paste curl command line here..."
            className="flex-1 w-full rounded border border-line bg-base p-2.5 font-mono text-[11.5px] text-ink outline-none focus:border-accent resize-none leading-relaxed select-all"
          />

          {/* Parsed Summary Strip */}
          {parsed.url && (
            <div className="rounded border border-line bg-base/60 p-2 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 truncate">
                <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent font-mono font-bold text-[10px]">
                  {parsed.method}
                </span>
                <span className="text-dim font-mono truncate">{parsed.url}</span>
              </div>
              <div className="text-faint text-[10px]">
                {Object.keys(parsed.headers).length} header(s) ·{' '}
                {parsed.body ? 'Payload attached' : 'No body'}
              </div>
            </div>
          )}
        </Panel>

        {/* Right Output */}
        <Panel className="lg:col-span-7 p-3.5 flex flex-col gap-2 overflow-hidden">
          {/* Target Language Tabs */}
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <div className="flex flex-wrap items-center gap-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setSelectedLang(lang.id)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    selectedLang === lang.id
                      ? 'bg-surface text-accent border border-accent/40 shadow-xs'
                      : 'text-faint hover:text-ink hover:bg-base'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                disabled={!generatedCode}
                className="gap-1 cursor-pointer text-[11px]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={handleDownload}
                disabled={!generatedCode}
                className="gap-1 cursor-pointer text-[11px]"
              >
                <Download size={12} />
                Save File
              </Button>
            </div>
          </div>

          <pre className="flex-1 rounded border border-line bg-base/90 p-3 font-mono text-[11.5px] text-ink overflow-auto select-all leading-relaxed">
            {generatedCode}
          </pre>
        </Panel>
      </div>
    </div>
  )
}
