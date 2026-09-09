/**
 * Hermanos Stash — Offline Token Counter & Cost Estimator Logic Engine
 *
 * Provides 100% offline, local-first token estimation and BPE-style segmentation
 * without any external APIs, network calls, or heavy binary dependencies.
 */

export interface ModelProfile {
  id: string
  name: string
  provider: 'OpenAI' | 'Anthropic' | 'Meta' | 'Google' | 'Legacy'
  contextLimit: number
  inputPricePerMillion: number
  outputPricePerMillion: number
  ratioVsBase: number
  description: string
}

export const MODEL_PROFILES: readonly ModelProfile[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o / GPT-4 Turbo',
    provider: 'OpenAI',
    contextLimit: 128_000,
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10.0,
    ratioVsBase: 1.0,
    description: 'Flagship omni model with cl100k/o200k 128k context window.'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'OpenAI',
    contextLimit: 128_000,
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    ratioVsBase: 1.0,
    description: 'Ultra-fast, cost-efficient model for lightweight reasoning.'
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextLimit: 200_000,
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    ratioVsBase: 1.04,
    description: 'High-capability coding and writing model with 200k context.'
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    contextLimit: 200_000,
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4.0,
    ratioVsBase: 1.04,
    description: 'Blazing speed with near-Sonnet intelligence.'
  },
  {
    id: 'llama-3-1-70b',
    name: 'Llama 3.1 70B',
    provider: 'Meta',
    contextLimit: 128_000,
    inputPricePerMillion: 0.88,
    outputPricePerMillion: 0.88,
    ratioVsBase: 0.98,
    description: 'Open-weights 128k tokenizer (reference provider rate).'
  },
  {
    id: 'gemini-1-5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    contextLimit: 1_000_000,
    inputPricePerMillion: 3.5,
    outputPricePerMillion: 10.5,
    ratioVsBase: 1.02,
    description: 'Massive 1M token context window for huge repositories.'
  },
  {
    id: 'gemini-1-5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    contextLimit: 2_000_000,
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.3,
    ratioVsBase: 1.02,
    description: 'High-frequency 2M token context window.'
  },
  {
    id: 'gpt-3-5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'Legacy',
    contextLimit: 16_385,
    inputPricePerMillion: 0.5,
    outputPricePerMillion: 1.5,
    ratioVsBase: 1.06,
    description: 'Legacy standard 16k context window.'
  }
] as const

export interface TokenChunk {
  index: number
  text: string
  charStart: number
  charEnd: number
  colorIndex: number
}

export interface TokenMetrics {
  totalTokens: number
  characters: number
  charactersNoSpaces: number
  words: number
  lines: number
  charsPerToken: number
  readingTimeSec: number
  generationTimeSec: number
}

export interface ContextUtilization {
  contextLimit: number
  tokensUsed: number
  tokensRemaining: number
  percentageUsed: number
  status: 'safe' | 'warning' | 'exceeded'
}

export interface CostEstimate {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  promptCost: number
  completionCost: number
  totalCost: number
  costPerThousandRequests: number
}

/**
 * Standard BPE pre-tokenization regex pattern modeled after OpenAI cl100k_base.
 * Splits contractions, words, 1-3 digit number blocks, punctuation, and whitespace runs.
 */
const BPE_SPLIT_REGEX =
  /(?:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?[\p{L}]+|\p{N}{1,3}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/giu

/**
 * Sub-segments an individual match into realistic BPE token chunks.
 * In production BPE tokenizers:
 * - Common short words (<=5 chars) are single tokens.
 * - Longer words are decomposed into 3-4 character subwords.
 * - CJK characters are 1 token each.
 * - Whitespace runs are chunked in lengths of up to 4 spaces.
 */
function subsegmentMatch(match: string, startOffset: number): TokenChunk[] {
  const chunks: TokenChunk[] = []
  let offset = startOffset

  // Handle pure whitespace / indentation
  if (/^\s+$/.test(match)) {
    // Group spaces in chunks of up to 4
    let i = 0
    while (i < match.length) {
      const take = match[i] === '\n' ? 1 : Math.min(4, match.length - i)
      const part = match.slice(i, i + take)
      chunks.push({
        index: 0,
        text: part,
        charStart: offset,
        charEnd: offset + part.length,
        colorIndex: 0
      })
      offset += part.length
      i += take
    }
    return chunks
  }

  // Handle CJK characters (each ideograph is roughly 1 token)
  if (/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(match)) {
    for (const char of match) {
      chunks.push({
        index: 0,
        text: char,
        charStart: offset,
        charEnd: offset + char.length,
        colorIndex: 0
      })
      offset += char.length
    }
    return chunks
  }

  // Handle words with leading space
  const hasLeadingSpace = match.startsWith(' ')
  const core = hasLeadingSpace ? match.slice(1) : match

  // If word is short (<= 5 chars) or number <= 3 digits, it's 1 token
  if (core.length <= 5 || /^\d{1,3}$/.test(core)) {
    chunks.push({
      index: 0,
      text: match,
      charStart: startOffset,
      charEnd: startOffset + match.length,
      colorIndex: 0
    })
    return chunks
  }

  // Subsegment longer word into ~3-4 char morphemes
  let i = 0
  while (i < match.length) {
    // First chunk keeps leading space if present
    const isFirst = i === 0
    const chunkSize = isFirst && hasLeadingSpace ? 4 : Math.min(3 + (i % 2), match.length - i)
    const part = match.slice(i, i + chunkSize)
    chunks.push({
      index: 0,
      text: part,
      charStart: offset,
      charEnd: offset + part.length,
      colorIndex: 0
    })
    offset += part.length
    i += chunkSize
  }

  return chunks
}

/**
 * Segment full input text into visual token chunks with 6-color rotating tags.
 */
export function segmentTokens(text: string): TokenChunk[] {
  if (!text || text.length === 0) return []

  const rawChunks: TokenChunk[] = []
  let match: RegExpExecArray | null
  BPE_SPLIT_REGEX.lastIndex = 0

  while ((match = BPE_SPLIT_REGEX.exec(text)) !== null) {
    const matchedText = match[0]
    const subChunks = subsegmentMatch(matchedText, match.index)
    for (const sc of subChunks) {
      rawChunks.push(sc)
    }
  }

  // Fallback for any leftover or unhandled characters
  if (rawChunks.length === 0 && text.length > 0) {
    rawChunks.push({
      index: 0,
      text,
      charStart: 0,
      charEnd: text.length,
      colorIndex: 0
    })
  }

  // Assign sequential index and rotating color (0..5)
  return rawChunks.map((chunk, idx) => ({
    ...chunk,
    index: idx + 1,
    colorIndex: idx % 6
  }))
}

/**
 * Calculate comprehensive text and reading metrics.
 */
export function calculateTextMetrics(text: string, baseTokens: number): TokenMetrics {
  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length
  const words = text.trim().length > 0 ? (text.trim().match(/\S+/g) ?? []).length : 0
  const lines = text.length > 0 ? text.split(/\r?\n/).length : 0
  const charsPerToken = baseTokens > 0 ? Number((characters / baseTokens).toFixed(2)) : 0
  // Average human reading speed ~200-250 words per minute (3.5 words/sec)
  const readingTimeSec = words > 0 ? Math.max(1, Math.round(words / 3.6)) : 0
  // Average LLM generation speed ~80 tokens per second
  const generationTimeSec = baseTokens > 0 ? Number((baseTokens / 80).toFixed(1)) : 0

  return {
    totalTokens: baseTokens,
    characters,
    charactersNoSpaces,
    words,
    lines,
    charsPerToken,
    readingTimeSec,
    generationTimeSec
  }
}

/**
 * Calculate context window utilization for a specific model limit.
 */
export function calculateContextUtilization(
  tokens: number,
  contextLimit: number
): ContextUtilization {
  const used = Math.max(0, tokens)
  const remaining = Math.max(0, contextLimit - used)
  const percentage = Number(((used / contextLimit) * 100).toFixed(2))

  let status: ContextUtilization['status'] = 'safe'
  if (percentage >= 100) {
    status = 'exceeded'
  } else if (percentage >= 75) {
    status = 'warning'
  }

  return {
    contextLimit,
    tokensUsed: used,
    tokensRemaining: remaining,
    percentageUsed: percentage,
    status
  }
}

/**
 * Calculate estimated API cost for prompt + completion tokens.
 */
export function calculateCostEstimate(
  promptTokens: number,
  completionTokens: number,
  model: ModelProfile
): CostEstimate {
  const adjustedPromptTokens = Math.round(promptTokens * model.ratioVsBase)
  const total = adjustedPromptTokens + completionTokens
  const promptCost = (adjustedPromptTokens / 1_000_000) * model.inputPricePerMillion
  const completionCost = (completionTokens / 1_000_000) * model.outputPricePerMillion
  const totalCost = promptCost + completionCost
  const costPerThousandRequests = totalCost * 1_000

  return {
    promptTokens: adjustedPromptTokens,
    completionTokens,
    totalTokens: total,
    promptCost,
    completionCost,
    totalCost,
    costPerThousandRequests
  }
}

/**
 * Format currency to micro-cents or standard dollar amounts.
 */
export function formatUsd(amount: number): string {
  if (amount === 0) return '$0.00'
  if (amount < 0.0001) {
    return `$${amount.toFixed(6)}`
  }
  if (amount < 0.01) {
    return `$${amount.toFixed(4)}`
  }
  return `$${amount.toFixed(2)}`
}

/**
 * Format human-readable time (seconds to m:ss).
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}

/**
 * Format large numbers with commas.
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

/**
 * Preset sample texts for instant demonstration and testing.
 */
export const SAMPLE_PRESETS: { id: string; label: string; text: string }[] = [
  {
    id: 'system-prompt',
    label: 'System Prompt (Code Assistant)',
    text: `You are an expert full-stack TypeScript and React engineer specializing in local-first desktop applications.
Always write clean, modular, and fully-typed code adhering to the following strict rules:
1. Local-first: Never rely on paid APIs or external network services. All data must reside on the user's machine.
2. Architecture: Keep UI components separate from business logic. Always write comprehensive unit tests.
3. Design: Prioritize comfortable dark-theme aesthetics, WCAG AA contrast, and zero visual clutter.
4. Performance: Keep re-renders minimal and bundle size bounded. Ensure 60 FPS interaction feel.`
  },
  {
    id: 'react-component',
    label: 'TypeScript React Component',
    text: `import React, { useState, useMemo } from 'react'

export interface StatCardProps {
  label: string
  value: number
  unit?: string
  trend?: 'up' | 'down' | 'neutral'
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, unit, trend }) => {
  const [isHovered, setIsHovered] = useState(false)
  
  const formattedValue = useMemo(() => {
    return value.toLocaleString('en-US')
  }, [value])

  return (
    <div 
      className="p-4 rounded-lg bg-surface border border-border hover:border-amber-500/50 transition-all"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="text-xs text-muted-foreground uppercase font-mono">{label}</div>
      <div className="text-2xl font-bold font-mono mt-1 text-foreground">
        {formattedValue} {unit && <span className="text-sm font-normal text-muted-foreground">{unit}</span>}
      </div>
    </div>
  )
}`
  },
  {
    id: 'json-payload',
    label: 'JSON API Schema & Data',
    text: `{
  "status": "success",
  "data": {
    "organization": "Hermanos Stash",
    "version": "1.0.0",
    "environment": "production",
    "metrics": {
      "totalTools": 77,
      "categories": 8,
      "uptimeSeconds": 864200,
      "memoryUsageMb": 142.6,
      "localDatabaseSizeKb": 2048
    },
    "features": [
      { "id": "split_screen", "enabled": true, "maxPanes": 2 },
      { "id": "token_counter", "enabled": true, "offlineOnly": true },
      { "id": "batch_queue", "enabled": true, "concurrency": 4 }
    ]
  }
}`
  },
  {
    id: 'markdown-article',
    label: 'Markdown Documentation',
    text: `# Architectural Principles of Local-First Software

Modern applications often default to cloud-hosted infrastructure, creating unintended liabilities around privacy, latency, and subscription costs. 

### Core Tenets

- **No Remote Dependencies:** Applications must boot and function flawlessly without an active internet connection.
- **Data Sovereignty:** The user's files and database belong solely to their personal device.
- **Zero-Latency Execution:** Operations occur directly in memory or local storage, bypassing round-trip API latency.

> "A tool should feel like a sharp physical instrument: instant, reliable, and entirely in the user's hands."

\`\`\`bash
# Run local verification
npm run test && npm run typecheck
\`\`\`
`
  },
  {
    id: 'numbers-matrix',
    label: 'Numeric & Matrix Benchmark',
    text: `Matrix A (4x4):
[  104.25,   -45.10,    12.00,  1890.55 ]
[    0.05,  1250.80,   -98.75,     4.12 ]
[  -12.44,    78.90,  4500.00,  -320.10 ]
[  890.12,   -15.00,   123.45,   999.99 ]

Coordinates: (37.7749° N, 122.4194° W)
Timestamps: [1725849600, 1725853200, 1725856800, 1725860400]
Hex Hashes: 0x4f3a89e1b20c, 0x99a0bf21c45e, 0x112233445566`
  }
]
