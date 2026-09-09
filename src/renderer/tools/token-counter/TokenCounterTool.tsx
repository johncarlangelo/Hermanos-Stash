import { useMemo, useState } from 'react'
import {
  BarChart3,
  Check,
  Coins,
  Copy,
  Cpu,
  Gauge,
  Info,
  Sparkles,
  Trash2,
  UploadCloud
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FieldRow, Select, TextArea } from '../../components/ui/Inputs'
import { Panel, SectionHeading } from '../../components/ui/Feedback'
import { DropZone } from '../../components/ui/DropZone'
import { toastError, toastSuccess } from '../../stores/toasts'
import {
  MODEL_PROFILES,
  SAMPLE_PRESETS,
  calculateContextUtilization,
  calculateCostEstimate,
  calculateTextMetrics,
  formatDuration,
  formatNumber,
  formatUsd,
  segmentTokens,
  type ModelProfile,
  type TokenChunk
} from './logic'

type ActiveTab = 'metrics' | 'visualizer' | 'comparison'

const TOKEN_COLOR_STYLES = [
  'bg-amber-500/15 text-amber-200 border-amber-500/30 hover:bg-amber-500/30',
  'bg-cyan-500/15 text-cyan-200 border-cyan-500/30 hover:bg-cyan-500/30',
  'bg-emerald-500/15 text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/30',
  'bg-purple-500/15 text-purple-200 border-purple-500/30 hover:bg-purple-500/30',
  'bg-rose-500/15 text-rose-200 border-rose-500/30 hover:bg-rose-500/30',
  'bg-sky-500/15 text-sky-200 border-sky-500/30 hover:bg-sky-500/30'
]

export default function TokenCounterTool() {
  const [text, setText] = useState<string>(SAMPLE_PRESETS[0].text)
  const [selectedModelId, setSelectedModelId] = useState<string>('gpt-4o')
  const [completionTokens, setCompletionTokens] = useState<number>(1000)
  const [activeTab, setActiveTab] = useState<ActiveTab>('metrics')
  const [showWhitespace, setShowWhitespace] = useState<boolean>(true)
  const [hoveredToken, setHoveredToken] = useState<TokenChunk | null>(null)
  const [copiedBreakdown, setCopiedBreakdown] = useState<boolean>(false)
  const [copiedText, setCopiedText] = useState<boolean>(false)
  const [showDropZone, setShowDropZone] = useState<boolean>(false)

  const tokens = useMemo(() => segmentTokens(text), [text])
  const metrics = useMemo(() => calculateTextMetrics(text, tokens.length), [text, tokens.length])

  const currentModel = useMemo<ModelProfile>(() => {
    return MODEL_PROFILES.find((m) => m.id === selectedModelId) ?? MODEL_PROFILES[0]
  }, [selectedModelId])

  const contextUtil = useMemo(
    () => calculateContextUtilization(tokens.length, currentModel.contextLimit),
    [tokens.length, currentModel.contextLimit]
  )

  const costEstimate = useMemo(
    () => calculateCostEstimate(tokens.length, completionTokens, currentModel),
    [tokens.length, completionTokens, currentModel]
  )

  const modelComparisons = useMemo(() => {
    return MODEL_PROFILES.map((model) => {
      const estimate = calculateCostEstimate(tokens.length, completionTokens, model)
      const util = calculateContextUtilization(estimate.promptTokens, model.contextLimit)
      return { model, estimate, util }
    })
  }, [tokens.length, completionTokens])

  const handleCopyBreakdown = async () => {
    const summary = [
      `--- Token & Prompt Summary (${currentModel.name}) ---`,
      `Estimated Tokens: ${formatNumber(tokens.length)}`,
      `Characters: ${formatNumber(metrics.characters)} (${formatNumber(metrics.charactersNoSpaces)} without spaces)`,
      `Words: ${formatNumber(metrics.words)} | Lines: ${formatNumber(metrics.lines)}`,
      `Chars / Token: ${metrics.charsPerToken}`,
      `Context Used: ${contextUtil.percentageUsed}% (${formatNumber(contextUtil.tokensRemaining)} tokens remaining)`,
      `Estimated Prompt Cost: ${formatUsd(costEstimate.promptCost)}`,
      `Projected Total Cost (+${formatNumber(completionTokens)} output): ${formatUsd(costEstimate.totalCost)}`
    ].join('\n')

    try {
      await navigator.clipboard.writeText(summary)
      setCopiedBreakdown(true)
      toastSuccess('Copied token breakdown to clipboard')
      setTimeout(() => setCopiedBreakdown(false), 2000)
    } catch (err) {
      toastError(err)
    }
  }

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(true)
      toastSuccess('Copied text to clipboard')
      setTimeout(() => setCopiedText(false), 2000)
    } catch (err) {
      toastError(err)
    }
  }

  const handleRawFiles = async (files: File[]) => {
    if (files.length === 0) return
    try {
      const file = files[0]
      const content = await file.text()
      setText(content)
      setShowDropZone(false)
      toastSuccess(`Loaded "${file.name}" (${formatNumber(content.length)} characters)`)
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Top Workstation Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Token & Context Studio</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent border border-accent/20">
              <Cpu className="h-3 w-3" /> Offline BPE
            </span>
          </div>
          <p className="mt-1 text-xs text-faint">
            Accurate client-side token counting, BPE token segmentation, context window limits, and
            local API cost projections.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Selector */}
          <div className="w-56">
            <Select
              aria-label="Load preset sample text"
              value=""
              onChange={(e) => {
                const found = SAMPLE_PRESETS.find((p) => p.id === e.target.value)
                if (found) {
                  setText(found.text)
                  toastSuccess(`Loaded preset: ${found.label}`)
                }
              }}
            >
              <option value="" disabled>
                Load Sample Preset…
              </option>
              {SAMPLE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDropZone(!showDropZone)}
            title="Drop file from disk"
          >
            <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
            {showDropZone ? 'Hide Drop' : 'Load File'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setText('')
              toastSuccess('Cleared editor')
            }}
            disabled={!text}
            title="Clear text"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>

          <Button size="sm" variant="ghost" onClick={handleCopyText} disabled={!text}>
            {copiedText ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="mr-1.5 h-3.5 w-3.5" />
            )}
            Copy Text
          </Button>

          <Button size="sm" variant="secondary" onClick={handleCopyBreakdown} disabled={!text}>
            {copiedBreakdown ? (
              <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Copy Stats
          </Button>
        </div>
      </div>

      {/* Optional DropZone Drawer */}
      {showDropZone && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <DropZone
            label="Drop any prompt, code, markdown, or JSON file"
            hint="Supports .txt, .md, .json, .ts, .py, .csv, and source code files"
            accept={[
              '.txt',
              '.md',
              '.json',
              '.ts',
              '.tsx',
              '.js',
              '.jsx',
              '.py',
              '.csv',
              '.yaml',
              '.yml',
              '.html',
              '.css',
              '.sql'
            ]}
            onRawFiles={handleRawFiles}
          />
        </div>
      )}

      {/* Main Grid: Left Editor & Right / Bottom Analysis */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Input Text Area (lg:col-span-7) */}
        <div className="space-y-4 lg:col-span-7">
          <Panel className="space-y-3 p-4">
            <div className="flex items-center justify-between text-xs text-faint">
              <span className="font-medium text-ink">Prompt / Document Input</span>
              <div className="flex items-center gap-3 font-mono">
                <span>{formatNumber(metrics.characters)} chars</span>
                <span>•</span>
                <span>{formatNumber(metrics.words)} words</span>
                <span>•</span>
                <span>{formatNumber(metrics.lines)} lines</span>
              </div>
            </div>

            <TextArea
              mono
              rows={18}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste or type your text here to calculate tokens, context usage, and cost estimates..."
              className="min-h-[420px] font-mono text-[13px] leading-relaxed"
            />
          </Panel>
        </div>

        {/* Right Column: Workstation Analysis (lg:col-span-5) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Tab Navigation */}
          <div className="flex rounded-lg border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => setActiveTab('metrics')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'metrics'
                  ? 'bg-accent/15 text-accent shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Gauge className="h-3.5 w-3.5" />
              Metrics & Cost
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('visualizer')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'visualizer'
                  ? 'bg-accent/15 text-accent shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Token Visualizer
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comparison')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'comparison'
                  ? 'bg-accent/15 text-accent shadow-xs'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Coins className="h-3.5 w-3.5" />
              Models & Rates
            </button>
          </div>

          {/* TAB 1: Metrics & Cost */}
          {activeTab === 'metrics' && (
            <div className="space-y-4">
              {/* Primary Token & Metric Counters */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Panel className="p-3 text-center">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                    Total Tokens
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-accent">
                    {formatNumber(tokens.length)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-faint">{currentModel.name}</div>
                </Panel>

                <Panel className="p-3 text-center">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                    Characters
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold text-ink">
                    {formatNumber(metrics.characters)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-faint">
                    {formatNumber(metrics.charactersNoSpaces)} no space
                  </div>
                </Panel>

                <Panel className="p-3 text-center">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                    Chars / Token
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold text-ink">
                    {metrics.charsPerToken || '—'}
                  </div>
                  <div className="mt-0.5 text-[10px] text-faint">density ratio</div>
                </Panel>

                <Panel className="p-3 text-center">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                    Word Count
                  </div>
                  <div className="mt-1 font-mono text-xl font-semibold text-ink">
                    {formatNumber(metrics.words)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-faint">
                    ~{formatDuration(metrics.readingTimeSec)} read
                  </div>
                </Panel>

                <Panel className="p-3 text-center">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                    Generation Time
                  </div>
                  <div className="mt-1 font-mono text-xl font-semibold text-ink">
                    {formatDuration(metrics.generationTimeSec)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-faint">@ ~80 tok/sec</div>
                </Panel>

                <Panel className="p-3 text-center">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                    Input Cost
                  </div>
                  <div className="mt-1 font-mono text-xl font-semibold text-emerald-400">
                    {formatUsd(costEstimate.promptCost)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-faint">
                    ${currentModel.inputPricePerMillion}/M
                  </div>
                </Panel>
              </div>

              {/* Context Window Utilization Gauge */}
              <Panel className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <SectionHeading>Context Window Gauge</SectionHeading>
                  <div className="w-44">
                    <Select
                      aria-label="Target model for context window"
                      value={selectedModelId}
                      onChange={(e) => setSelectedModelId(e.target.value)}
                    >
                      {MODEL_PROFILES.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({formatNumber(m.contextLimit / 1000)}k)
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted">
                      Used: <strong className="text-ink">{formatNumber(tokens.length)}</strong> /{' '}
                      {formatNumber(contextUtil.contextLimit)} tokens
                    </span>
                    <span
                      className={`font-semibold ${
                        contextUtil.status === 'exceeded'
                          ? 'text-danger'
                          : contextUtil.status === 'warning'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                      }`}
                    >
                      {contextUtil.percentageUsed}%
                    </span>
                  </div>

                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-base border border-line">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        contextUtil.status === 'exceeded'
                          ? 'bg-danger'
                          : contextUtil.status === 'warning'
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, contextUtil.percentageUsed)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-faint">
                    <span>
                      Remaining:{' '}
                      <strong className="text-ink">
                        {formatNumber(contextUtil.tokensRemaining)}
                      </strong>{' '}
                      tokens
                    </span>
                    <span>Max: {formatNumber(currentModel.contextLimit)}</span>
                  </div>
                </div>
              </Panel>

              {/* Local Cost Projection Calculator */}
              <Panel className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <SectionHeading>API Cost Projection</SectionHeading>
                  <span className="text-xs font-mono text-muted">{currentModel.provider}</span>
                </div>

                <div className="space-y-2">
                  <FieldRow
                    label={`Projected Output Tokens: ${formatNumber(completionTokens)}`}
                    hint="Simulated response length from the model"
                  >
                    <div className="space-y-2">
                      <input
                        type="range"
                        min={0}
                        max={8000}
                        step={100}
                        value={completionTokens}
                        onChange={(e) => setCompletionTokens(Number(e.target.value))}
                        className="w-full accent-accent cursor-pointer"
                      />
                      <div className="flex justify-between gap-1 text-[11px] font-mono">
                        <button
                          type="button"
                          onClick={() => setCompletionTokens(250)}
                          className="px-2 py-0.5 rounded bg-surface hover:bg-surface-hover border border-line text-muted"
                        >
                          250
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompletionTokens(500)}
                          className="px-2 py-0.5 rounded bg-surface hover:bg-surface-hover border border-line text-muted"
                        >
                          500
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompletionTokens(1000)}
                          className="px-2 py-0.5 rounded bg-surface hover:bg-surface-hover border border-line text-muted"
                        >
                          1,000
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompletionTokens(2048)}
                          className="px-2 py-0.5 rounded bg-surface hover:bg-surface-hover border border-line text-muted"
                        >
                          2,048
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompletionTokens(4096)}
                          className="px-2 py-0.5 rounded bg-surface hover:bg-surface-hover border border-line text-muted"
                        >
                          4,096
                        </button>
                      </div>
                    </div>
                  </FieldRow>

                  <div className="mt-3 rounded-lg border border-line bg-base p-3 font-mono text-xs space-y-1.5">
                    <div className="flex justify-between text-muted">
                      <span>Prompt Input Cost:</span>
                      <span className="text-ink">{formatUsd(costEstimate.promptCost)}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Projected Output Cost:</span>
                      <span className="text-ink">{formatUsd(costEstimate.completionCost)}</span>
                    </div>
                    <div className="flex justify-between border-t border-line pt-1.5 font-bold text-ink">
                      <span>Total Cost per Request:</span>
                      <span className="text-emerald-400">{formatUsd(costEstimate.totalCost)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-faint pt-0.5">
                      <span>1,000 Requests:</span>
                      <span>{formatUsd(costEstimate.costPerThousandRequests)}</span>
                    </div>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* TAB 2: Token Visualizer */}
          {activeTab === 'visualizer' && (
            <Panel className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                <div>
                  <SectionHeading>BPE Token Visualizer</SectionHeading>
                  <p className="text-[11px] text-faint">
                    Hover over any token to inspect byte offsets and character boundaries.
                  </p>
                </div>

                <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showWhitespace}
                    onChange={(e) => setShowWhitespace(e.target.checked)}
                    className="accent-accent"
                  />
                  <span>Show Symbols</span>
                </label>
              </div>

              {/* Hover Details Card */}
              <div className="min-h-12 rounded-md border border-line bg-base p-2.5 text-xs font-mono">
                {hoveredToken ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-accent/15 px-1.5 py-0.5 text-accent font-bold">
                        #{hoveredToken.index}
                      </span>
                      <span className="text-ink">
                        Chars {hoveredToken.charStart}–{hoveredToken.charEnd} (
                        {hoveredToken.charEnd - hoveredToken.charStart} char
                        {hoveredToken.charEnd - hoveredToken.charStart > 1 ? 's' : ''})
                      </span>
                    </div>
                    <span className="text-faint truncate max-w-[200px]">
                      Literal: &quot;{hoveredToken.text.replace(/\n/g, '\\n')}&quot;
                    </span>
                  </div>
                ) : (
                  <div className="text-faint flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    <span>Hover over any colored token pill below for detailed metrics.</span>
                  </div>
                )}
              </div>

              {/* Visualized Token Container */}
              <div className="max-h-[360px] overflow-y-auto rounded-md border border-line bg-base p-3 font-mono text-[12.5px] leading-relaxed">
                {tokens.length === 0 ? (
                  <div className="py-8 text-center text-sm text-faint">
                    No text entered. Paste or type text to view token segmentation.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {tokens.map((token) => {
                      const colorClass = TOKEN_COLOR_STYLES[token.colorIndex]
                      let display = token.text
                      if (showWhitespace) {
                        display = display.replace(/ /g, '·').replace(/\n/g, '↵\n')
                      }

                      return (
                        <span
                          key={token.index}
                          onMouseEnter={() => setHoveredToken(token)}
                          onMouseLeave={() => setHoveredToken(null)}
                          className={`inline-block rounded px-1.5 py-0.5 border cursor-pointer transition-all duration-150 ${colorClass}`}
                        >
                          {display}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* TAB 3: Models & Pricing Comparison Table */}
          {activeTab === 'comparison' && (
            <Panel className="space-y-3 p-4">
              <div>
                <SectionHeading>Model & Cost Matrix</SectionHeading>
                <p className="text-[11px] text-faint">
                  Estimated token counts and prompt costs across official model tokenizers.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className="pb-2 font-medium">Model</th>
                      <th className="pb-2 font-medium">Context</th>
                      <th className="pb-2 font-medium text-right">Est. Tokens</th>
                      <th className="pb-2 font-medium text-right">Prompt Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {modelComparisons.map(({ model, estimate, util }) => (
                      <tr
                        key={model.id}
                        className={`hover:bg-surface-hover transition-colors ${
                          model.id === selectedModelId ? 'bg-accent/5 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2.5">
                          <div className="font-sans font-medium text-ink">{model.name}</div>
                          <div className="text-[10px] text-faint">
                            ${model.inputPricePerMillion} / ${model.outputPricePerMillion} per 1M
                          </div>
                        </td>
                        <td className="py-2.5 text-muted">
                          {formatNumber(model.contextLimit / 1000)}k
                        </td>
                        <td className="py-2.5 text-right text-ink">
                          {formatNumber(estimate.promptTokens)}
                          <div
                            className={`text-[10px] ${
                              util.status === 'exceeded'
                                ? 'text-danger'
                                : util.status === 'warning'
                                  ? 'text-amber-400'
                                  : 'text-faint'
                            }`}
                          >
                            {util.percentageUsed}% of limit
                          </div>
                        </td>
                        <td className="py-2.5 text-right text-emerald-400 font-semibold">
                          {formatUsd(estimate.promptCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
