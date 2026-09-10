import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Check,
  Copy,
  Cpu,
  Gauge,
  Play,
  RotateCcw,
  Sliders,
  Square,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  Zap
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FieldRow, Select, TextArea } from '../../components/ui/Inputs'
import { Panel, SectionHeading } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import {
  DEFAULT_ENDPOINTS,
  QUICK_PROMPTS,
  SIMULATED_MODELS,
  SYSTEM_PROMPT_PRESETS,
  calculateBenchmark,
  clampOptions,
  formatBytes,
  parseNdjsonChunk,
  parseOllamaTags,
  parseOpenAiModels,
  simulateStreamCompletion,
  type BenchmarkMetrics,
  type LocalEndpoint,
  type LocalModelInfo,
  type ModelOptions
} from './logic'

interface Message {
  id: string
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp: number
  metrics?: BenchmarkMetrics
}

export default function LocalLlmPlaygroundTool() {
  const [endpointId, setEndpointId] = useState<string>('ollama')
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline' | 'simulation'>(
    'simulation'
  )
  const [availableModels, setAvailableModels] = useState<LocalModelInfo[]>([...SIMULATED_MODELS])
  const [selectedModelId, setSelectedModelId] = useState<string>(SIMULATED_MODELS[0].id)
  const [options, setOptions] = useState<ModelOptions>({
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 1024,
    systemPrompt: SYSTEM_PROMPT_PRESETS[0].prompt
  })
  const [messages, setMessages] = useState<Message[]>([])
  const [inputPrompt, setInputPrompt] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [activeMetrics, setActiveMetrics] = useState<BenchmarkMetrics | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)

  const activeEndpoint = useMemo<LocalEndpoint>(() => {
    return (
      DEFAULT_ENDPOINTS.find((e) => e.id === endpointId) ?? {
        id: 'custom',
        name: 'Custom Endpoint',
        url: 'http://localhost:11434',
        type: 'ollama'
      }
    )
  }, [endpointId])

  // Probe endpoint and fetch available models
  const refreshModels = useCallback(async () => {
    if (activeEndpoint.type === 'simulation') {
      setConnectionStatus('simulation')
      setAvailableModels([...SIMULATED_MODELS])
      setSelectedModelId(SIMULATED_MODELS[0].id)
      return
    }

    try {
      const url =
        activeEndpoint.type === 'ollama'
          ? `${activeEndpoint.url}/api/tags`
          : `${activeEndpoint.url}/v1/models`

      const res = await fetch(url, { signal: AbortSignal.timeout(2500) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const json = await res.json()
      const models =
        activeEndpoint.type === 'ollama' ? parseOllamaTags(json) : parseOpenAiModels(json)

      if (models.length > 0) {
        setConnectionStatus('connected')
        setAvailableModels(models)
        setSelectedModelId(models[0].id)
        toastSuccess(`Connected to ${activeEndpoint.name}: found ${models.length} model(s)`)
      } else {
        setConnectionStatus('connected')
        setAvailableModels([...SIMULATED_MODELS])
        setSelectedModelId(SIMULATED_MODELS[0].id)
        toastSuccess('Connected, but no local models were found. Simulation models loaded.')
      }
    } catch {
      setConnectionStatus('offline')
      setAvailableModels([...SIMULATED_MODELS])
      setSelectedModelId(SIMULATED_MODELS[0].id)
    }
  }, [activeEndpoint])

  useEffect(() => {
    void refreshModels()
  }, [refreshModels])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating])

  // Execute generation
  const handleSendPrompt = async (promptToSend?: string) => {
    const text = (promptToSend ?? inputPrompt).trim()
    if (!text || isGenerating) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    }

    const assistantPlaceholderId = `asst-${Date.now()}`
    const assistantMessage: Message = {
      id: assistantPlaceholderId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInputPrompt('')
    setIsGenerating(true)
    setActiveMetrics(null)

    const controller = new AbortController()
    abortControllerRef.current = controller

    const startTimeMs = Date.now()
    let firstTokenTimeMs = 0
    let accumulatedContent = ''
    let tokensCount = 0

    // Offline simulation branch
    if (connectionStatus === 'simulation' || selectedModelId.endsWith('-sim')) {
      try {
        await simulateStreamCompletion(
          selectedModelId,
          text,
          (chunk) => {
            if (firstTokenTimeMs === 0) firstTokenTimeMs = Date.now()
            accumulatedContent += chunk
            tokensCount++
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantPlaceholderId ? { ...m, content: accumulatedContent } : m
              )
            )
          },
          (metrics) => {
            setActiveMetrics(metrics)
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantPlaceholderId ? { ...m, metrics } : m))
            )
          },
          controller.signal
        )
      } catch (err) {
        if (!controller.signal.aborted) toastError(err)
      } finally {
        setIsGenerating(false)
        abortControllerRef.current = null
      }
      return
    }

    // Real local Ollama/LM-Studio streaming branch
    try {
      const isOllama = activeEndpoint.type === 'ollama'
      const endpointUrl = isOllama
        ? `${activeEndpoint.url}/api/chat`
        : `${activeEndpoint.url}/v1/chat/completions`

      const payload = isOllama
        ? {
            model: selectedModelId,
            messages: [
              ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
              ...messages.map((m) => ({ role: m.role, content: m.content })),
              { role: 'user', content: text }
            ],
            options: {
              temperature: options.temperature,
              top_p: options.topP,
              num_predict: options.maxTokens
            },
            stream: true
          }
        : {
            model: selectedModelId,
            messages: [
              ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
              ...messages.map((m) => ({ role: m.role, content: m.content })),
              { role: 'user', content: text }
            ],
            temperature: options.temperature,
            top_p: options.topP,
            max_tokens: options.maxTokens,
            stream: true
          }

      const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      if (!response.ok) throw new Error(`Inference error HTTP ${response.status}`)
      if (!response.body) throw new Error('Response body was null')

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let done = false
      let finalMeta: Record<string, unknown> | undefined

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        if (readerDone) break

        const chunkText = decoder.decode(value, { stream: true })
        const parsedChunks = parseNdjsonChunk(chunkText)

        for (const item of parsedChunks) {
          if (item.content) {
            if (firstTokenTimeMs === 0) firstTokenTimeMs = Date.now()
            accumulatedContent += item.content
            tokensCount++
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantPlaceholderId ? { ...m, content: accumulatedContent } : m
              )
            )
          }
          if (item.done) {
            done = true
            finalMeta = item.rawMeta
          }
        }
      }

      const endTimeMs = Date.now()
      const metrics = calculateBenchmark(
        startTimeMs,
        firstTokenTimeMs,
        endTimeMs,
        tokensCount,
        finalMeta
      )
      setActiveMetrics(metrics)
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantPlaceholderId ? { ...m, metrics } : m))
      )
    } catch (err) {
      if (!controller.signal.aborted) {
        toastError(err)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantPlaceholderId
              ? {
                  ...m,
                  content: `[Error: Failed to communicate with local endpoint at ${activeEndpoint.url}]`
                }
              : m
          )
        )
      }
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsGenerating(false)
      toastSuccess('Generation stopped')
    }
  }

  const handleCopyText = async (textToCopy: string, id: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopiedId(id)
      toastSuccess('Copied to clipboard')
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      toastError(err)
    }
  }

  const currentModelInfo = availableModels.find((m) => m.id === selectedModelId)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Top Workstation Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-ink">
              Local LLM Playground & Benchmark
            </h2>
            <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-400 tracking-wider uppercase">
              BETA
            </span>
          </div>
          <p className="mt-1 text-xs text-faint">
            Local-first prompt testing and real-time generation benchmark for Ollama, LM Studio, and
            local AI models running on your hardware.
          </p>
        </div>

        {/* Server & Connection Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Pill */}
          <div
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : connectionStatus === 'simulation'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-danger/15 text-danger border-danger/30'
            }`}
          >
            {connectionStatus === 'connected' ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            ) : connectionStatus === 'simulation' ? (
              <Cpu className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-danger" />
            )}
            <span>
              {connectionStatus === 'connected'
                ? 'Local Daemon Online'
                : connectionStatus === 'simulation'
                  ? 'Simulation Sandbox'
                  : 'Daemon Offline'}
            </span>
          </div>

          {/* Endpoint Selector */}
          <div className="w-52">
            <Select
              aria-label="Local AI Endpoint"
              value={endpointId}
              onChange={(e) => setEndpointId(e.target.value)}
            >
              {DEFAULT_ENDPOINTS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>

          <Button size="sm" variant="ghost" onClick={refreshModels} title="Probe local endpoint">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Model Selection & Live Hardware Benchmark Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {/* Model Picker Card */}
        <Panel className="col-span-2 p-3 sm:col-span-2 space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted flex items-center justify-between">
            <span>Target Local Model</span>
            {currentModelInfo?.parameterSize && (
              <span className="font-mono text-accent text-[10px] bg-accent/10 px-1.5 py-0.2 rounded border border-accent/20">
                {currentModelInfo.parameterSize}
                {currentModelInfo.quantization ? ` • ${currentModelInfo.quantization}` : ''}
              </span>
            )}
          </div>
          <Select
            aria-label="Active Model"
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {m.sizeBytes ? `(${formatBytes(m.sizeBytes)})` : ''}
              </option>
            ))}
          </Select>
        </Panel>

        {/* Metric 1: Tokens / Second */}
        <Panel className="p-3 text-center">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted flex items-center justify-center gap-1">
            <Zap className="h-3 w-3 text-amber-400" />
            <span>Speed</span>
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-amber-400">
            {activeMetrics ? `${activeMetrics.tokensPerSecond}` : '—'}
            <span className="text-xs font-normal text-muted ml-0.5">tok/s</span>
          </div>
        </Panel>

        {/* Metric 2: Time to First Token (TTFT) */}
        <Panel className="p-3 text-center">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted flex items-center justify-center gap-1">
            <Gauge className="h-3 w-3 text-sky-400" />
            <span>TTFT</span>
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-ink">
            {activeMetrics ? `${activeMetrics.timeToFirstTokenMs}` : '—'}
            <span className="text-xs font-normal text-muted ml-0.5">ms</span>
          </div>
        </Panel>

        {/* Metric 3: Output Tokens */}
        <Panel className="p-3 text-center">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted flex items-center justify-center gap-1">
            <Cpu className="h-3 w-3 text-emerald-400" />
            <span>Generated</span>
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-ink">
            {activeMetrics ? `${activeMetrics.tokensGenerated}` : '—'}
            <span className="text-xs font-normal text-muted ml-0.5">tokens</span>
          </div>
        </Panel>
      </div>

      {/* Main Two-Column Playground Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Chat & Prompt Conversation Panel (lg:col-span-8) */}
        <div className="space-y-4 lg:col-span-8">
          <Panel className="flex flex-col h-[560px] p-4">
            {/* Messages Thread Container */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted space-y-3">
                  <div className="rounded-full bg-surface p-3 border border-line">
                    <Terminal className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Local LLM Playground Ready</h3>
                    <p className="text-xs text-faint max-w-sm mt-1">
                      Type a prompt below or pick a quick preset to benchmark inference speed and
                      test local model reasoning.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg border p-3.5 text-xs font-mono leading-relaxed transition-all ${
                      m.role === 'user'
                        ? 'bg-accent/10 border-accent/30 text-ink ml-8'
                        : 'bg-base border-line text-ink mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-line/60">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-muted">
                        {m.role === 'user' ? 'You (Prompt)' : `${selectedModelId}`}
                      </span>
                      <div className="flex items-center gap-2">
                        {m.metrics && (
                          <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                            ⚡ {m.metrics.tokensPerSecond} tok/s • {m.metrics.timeToFirstTokenMs}ms
                            TTFT
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyText(m.content, m.id)}
                          className="text-muted hover:text-ink transition-colors"
                          title="Copy message"
                        >
                          {copiedId === m.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="whitespace-pre-wrap font-sans text-xs text-ink/90">
                      {m.content}
                      {isGenerating && m.role === 'assistant' && !m.metrics && (
                        <span className="inline-block w-2 h-3.5 ml-1 bg-accent animate-pulse" />
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={scrollAnchorRef} />
            </div>

            {/* Quick Prompt Starters */}
            <div className="pt-3 border-t border-line">
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputPrompt(qp)
                      void handleSendPrompt(qp)
                    }}
                    disabled={isGenerating}
                    className="text-[11px] rounded-full bg-surface hover:bg-surface-hover border border-line px-2.5 py-1 text-muted hover:text-ink transition-colors truncate max-w-[280px]"
                    title={qp}
                  >
                    {qp}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <div className="flex gap-2">
                <TextArea
                  rows={2}
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      void handleSendPrompt()
                    }
                  }}
                  placeholder="Type a prompt (Ctrl+Enter to send)..."
                  className="resize-none font-sans text-xs"
                />

                <div className="flex flex-col gap-1.5">
                  {isGenerating ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={handleStop}
                      className="h-full px-4"
                      title="Stop inference"
                    >
                      <Square className="h-4 w-4 fill-current mr-1" /> Stop
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleSendPrompt()}
                      disabled={!inputPrompt.trim()}
                      className="h-full px-4"
                      title="Run model inference"
                    >
                      <Play className="h-4 w-4 fill-current mr-1" /> Run
                    </Button>
                  )}
                  {messages.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMessages([])
                        setActiveMetrics(null)
                      }}
                      title="Clear chat thread"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right Sidebar: Model Parameters & Helper (lg:col-span-4) */}
        <div className="space-y-4 lg:col-span-4">
          {/* Hyperparameters Configuration */}
          <Panel className="space-y-4 p-4">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <SectionHeading>
                <Sliders className="h-3.5 w-3.5 mr-1 text-accent inline" /> Parameters
              </SectionHeading>
              <span className="text-[10px] font-mono text-faint">Local VRAM / CPU</span>
            </div>

            {/* System Prompt Preset Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-ink">System Instructions</label>
              <Select
                aria-label="System Prompt Presets"
                value=""
                onChange={(e) => {
                  const p = SYSTEM_PROMPT_PRESETS.find((sp) => sp.id === e.target.value)
                  if (p) {
                    setOptions((prev) => ({ ...prev, systemPrompt: p.prompt }))
                    toastSuccess(`Applied preset: ${p.label}`)
                  }
                }}
              >
                <option value="" disabled>
                  Load System Preset…
                </option>
                {SYSTEM_PROMPT_PRESETS.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.label}
                  </option>
                ))}
              </Select>
              <TextArea
                rows={3}
                value={options.systemPrompt ?? ''}
                onChange={(e) => setOptions((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="Custom system instructions..."
                className="text-xs font-mono"
              />
            </div>

            {/* Temperature Slider */}
            <FieldRow
              label={`Temperature: ${options.temperature}`}
              hint="Controls randomness: lower is more deterministic, higher is more creative"
            >
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={options.temperature}
                onChange={(e) =>
                  setOptions((prev) =>
                    clampOptions({ ...prev, temperature: Number(e.target.value) })
                  )
                }
                className="w-full accent-accent cursor-pointer"
              />
            </FieldRow>

            {/* Top-P Slider */}
            <FieldRow
              label={`Top-P (Nucleus): ${options.topP}`}
              hint="Cumulative probability cutoff for token candidate pool"
            >
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={options.topP}
                onChange={(e) =>
                  setOptions((prev) => clampOptions({ ...prev, topP: Number(e.target.value) }))
                }
                className="w-full accent-accent cursor-pointer"
              />
            </FieldRow>

            {/* Max Output Tokens */}
            <FieldRow
              label={`Max Tokens: ${options.maxTokens}`}
              hint="Upper bound on response generation length"
            >
              <input
                type="range"
                min={128}
                max={4096}
                step={128}
                value={options.maxTokens}
                onChange={(e) =>
                  setOptions((prev) => clampOptions({ ...prev, maxTokens: Number(e.target.value) }))
                }
                className="w-full accent-accent cursor-pointer"
              />
            </FieldRow>
          </Panel>

          {/* Quick Helper Card if Ollama isn't active */}
          {connectionStatus !== 'connected' && (
            <Panel className="p-3.5 space-y-2 border-amber-500/30 bg-amber-500/5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                <span>Running Real Models Locally</span>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                To benchmark real models on your CPU/GPU, install and run <strong>Ollama</strong>:
              </p>
              <div className="rounded bg-base p-2 font-mono text-[10.5px] text-ink border border-line flex items-center justify-between">
                <code>ollama run llama3.2</code>
                <button
                  type="button"
                  onClick={() => handleCopyText('ollama run llama3.2', 'ollama-cmd')}
                  className="text-muted hover:text-ink"
                  title="Copy command"
                >
                  {copiedId === 'ollama-cmd' ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-faint">
                Currently running in <strong>Simulation Sandbox</strong> mode so you can preview
                speed gauges and token streaming offline.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
