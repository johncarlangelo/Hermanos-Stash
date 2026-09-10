/**
 * Hermanos Stash — Local LLM Playground & Benchmark Logic Engine [BETA]
 *
 * Provides client-side protocols for communicating with local LLM daemons
 * (Ollama, LM Studio, LocalAI) running on localhost, real-time performance
 * benchmarking telemetry (tok/s, TTFT), and an offline simulation sandbox.
 */

export interface LocalModelInfo {
  id: string
  name: string
  sizeBytes?: number
  parameterSize?: string
  quantization?: string
  family?: string
  isSimulated?: boolean
}

export interface BenchmarkMetrics {
  timeToFirstTokenMs: number
  totalDurationSec: number
  tokensGenerated: number
  tokensPerSecond: number
  promptTokens?: number
  promptEvalDurationSec?: number
  isSimulated?: boolean
}

export interface ModelOptions {
  temperature: number
  topP: number
  maxTokens: number
  systemPrompt?: string
}

export interface LocalEndpoint {
  id: string
  name: string
  url: string
  type: 'ollama' | 'openai-compatible' | 'simulation'
}

export const DEFAULT_ENDPOINTS: readonly LocalEndpoint[] = [
  {
    id: 'ollama',
    name: 'Ollama (localhost:11434)',
    url: 'http://localhost:11434',
    type: 'ollama'
  },
  {
    id: 'lm-studio',
    name: 'LM Studio (localhost:1234)',
    url: 'http://localhost:1234',
    type: 'openai-compatible'
  },
  {
    id: 'simulation',
    name: 'Offline Simulation Sandbox',
    url: 'mock://simulation',
    type: 'simulation'
  }
] as const

export const SIMULATED_MODELS: readonly LocalModelInfo[] = [
  {
    id: 'llama-3.2-3b-sim',
    name: 'Llama 3.2 3B (Simulated)',
    sizeBytes: 2_000_000_000,
    parameterSize: '3B',
    quantization: 'Q4_K_M',
    family: 'llama',
    isSimulated: true
  },
  {
    id: 'deepseek-r1-7b-sim',
    name: 'DeepSeek R1 7B (Simulated)',
    sizeBytes: 4_500_000_000,
    parameterSize: '7B',
    quantization: 'Q4_K_M',
    family: 'deepseek',
    isSimulated: true
  },
  {
    id: 'phi-4-14b-sim',
    name: 'Phi-4 14B (Simulated)',
    sizeBytes: 9_100_000_000,
    parameterSize: '14B',
    quantization: 'Q8_0',
    family: 'phi',
    isSimulated: true
  }
] as const

export const SYSTEM_PROMPT_PRESETS = [
  {
    id: 'coding-assistant',
    label: 'Senior TypeScript & React Engineer',
    prompt:
      'You are an expert full-stack engineer. Provide clean, modular, production-ready TypeScript solutions with zero unnecessary filler.'
  },
  {
    id: 'concise-reasoner',
    label: 'Concise Thinker & Problem Solver',
    prompt:
      'Think step-by-step. Keep explanations rigorous, clear, and direct. Avoid conversational pleasantries.'
  },
  {
    id: 'code-auditor',
    label: 'Security & Code Auditor',
    prompt:
      'Audit the provided code for security vulnerabilities, edge cases, performance bottlenecks, and memory leaks.'
  },
  {
    id: 'json-extractor',
    label: 'Strict JSON Structured Extractor',
    prompt:
      'You are a strict data extraction utility. Respond ONLY with valid, unescaped JSON matching the requested structure. No markdown fences, no conversational text.'
  }
] as const

export const QUICK_PROMPTS = [
  'Write a TypeScript function to find anagrams in a list of words with O(N) complexity.',
  'Explain the difference between a mutex and a semaphore in 2 concise sentences.',
  'Create a regex to validate ISO 8601 UTC timestamps (e.g. 2026-09-11T00:15:00Z).',
  'What are the key advantages of local-first software architectures over cloud SaaS?'
] as const

/**
 * Parses Ollama `/api/tags` response into a clean list of LocalModelInfo.
 */
export function parseOllamaTags(json: unknown): LocalModelInfo[] {
  if (!json || typeof json !== 'object' || !('models' in json) || !Array.isArray(json.models)) {
    return []
  }

  return json.models
    .filter((m) => m && typeof m === 'object' && typeof m.name === 'string')
    .map((m) => {
      const details = typeof m.details === 'object' && m.details !== null ? m.details : {}
      return {
        id: String(m.name),
        name: String(m.name),
        sizeBytes: typeof m.size === 'number' ? m.size : undefined,
        parameterSize:
          typeof details.parameter_size === 'string' ? details.parameter_size : undefined,
        quantization:
          typeof details.quantization_level === 'string' ? details.quantization_level : undefined,
        family: typeof details.family === 'string' ? details.family : undefined,
        isSimulated: false
      }
    })
}

/**
 * Parses OpenAI-compatible `/v1/models` response (LM Studio / vLLM / llama.cpp).
 */
export function parseOpenAiModels(json: unknown): LocalModelInfo[] {
  if (!json || typeof json !== 'object' || !('data' in json) || !Array.isArray(json.data)) {
    return []
  }

  return json.data
    .filter((m) => m && typeof m === 'object' && typeof m.id === 'string')
    .map((m) => ({
      id: String(m.id),
      name: String(m.id),
      isSimulated: false
    }))
}

/**
 * Parses a stream buffer chunk containing newline-delimited JSON (NDJSON) from Ollama.
 */
export function parseNdjsonChunk(
  chunk: string
): { content: string; done: boolean; rawMeta?: Record<string, unknown> }[] {
  const lines = chunk
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const results: { content: string; done: boolean; rawMeta?: Record<string, unknown> }[] = []

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line)
      if (typeof parsed !== 'object' || parsed === null) continue

      let content = ''
      if (parsed.message && typeof parsed.message.content === 'string') {
        content = parsed.message.content
      } else if (typeof parsed.response === 'string') {
        content = parsed.response
      }

      const done = Boolean(parsed.done)
      results.push({
        content,
        done,
        rawMeta: done ? (parsed as Record<string, unknown>) : undefined
      })
    } catch {
      // Incomplete line, ignore
    }
  }

  return results
}

/**
 * Calculates accurate benchmark metrics from timestamps and Ollama telemetry.
 */
export function calculateBenchmark(
  startTimeMs: number,
  firstTokenTimeMs: number,
  endTimeMs: number,
  tokensCount: number,
  ollamaMeta?: Record<string, unknown>
): BenchmarkMetrics {
  const wallDurationSec = Math.max(0.001, (endTimeMs - startTimeMs) / 1000)
  const ttftMs = Math.max(0, firstTokenTimeMs > 0 ? firstTokenTimeMs - startTimeMs : 0)

  // If Ollama returned official hardware metrics in nanoseconds, use them
  if (
    ollamaMeta &&
    typeof ollamaMeta.eval_count === 'number' &&
    typeof ollamaMeta.eval_duration === 'number' &&
    ollamaMeta.eval_duration > 0
  ) {
    const evalDurationSec = ollamaMeta.eval_duration / 1e9
    const exactTokSec = Number((ollamaMeta.eval_count / evalDurationSec).toFixed(1))
    const promptEvalSec =
      typeof ollamaMeta.prompt_eval_duration === 'number'
        ? Number((ollamaMeta.prompt_eval_duration / 1e9).toFixed(2))
        : undefined

    return {
      timeToFirstTokenMs: ttftMs,
      totalDurationSec: Number(wallDurationSec.toFixed(2)),
      tokensGenerated: ollamaMeta.eval_count,
      tokensPerSecond: exactTokSec,
      promptTokens:
        typeof ollamaMeta.prompt_eval_count === 'number' ? ollamaMeta.prompt_eval_count : undefined,
      promptEvalDurationSec: promptEvalSec,
      isSimulated: false
    }
  }

  // Fallback to client-side timing
  const generationDurationSec = Math.max(
    0.001,
    (endTimeMs - (firstTokenTimeMs || startTimeMs)) / 1000
  )
  const tokSec = Number((tokensCount / generationDurationSec).toFixed(1))

  return {
    timeToFirstTokenMs: ttftMs,
    totalDurationSec: Number(wallDurationSec.toFixed(2)),
    tokensGenerated: tokensCount,
    tokensPerSecond: tokSec,
    isSimulated: Boolean(ollamaMeta?.isSimulated)
  }
}

/**
 * Clamps hyperparameters into safe runtime bounds.
 */
export function clampOptions(options: Partial<ModelOptions>): ModelOptions {
  return {
    temperature: Math.max(0, Math.min(2, options.temperature ?? 0.7)),
    topP: Math.max(0.1, Math.min(1.0, options.topP ?? 0.9)),
    maxTokens: Math.max(32, Math.min(8192, Math.round(options.maxTokens ?? 1024))),
    systemPrompt: options.systemPrompt?.trim()
  }
}

/**
 * Format bytes into human-readable size (e.g. 2.0 GB).
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(2)} GB`
}

/**
 * Generates realistic simulation text chunks for offline testing and benchmarking.
 */
const SIMULATION_RESPONSES: Record<string, string> = {
  anagram: `Here is an optimal TypeScript implementation using a character frequency hash map to achieve strict **O(N)** time complexity:

\`\`\`typescript
export function findAnagrams(words: string[]): string[][] {
  const groups = new Map<string, string[]>()

  for (const word of words) {
    // Generate canonical frequency key: e.g. "a1b2c1"
    const count = new Array(26).fill(0)
    for (let i = 0; i < word.length; i++) {
      count[word.charCodeAt(i) - 97]++
    }
    const key = count.join('#')
    
    const list = groups.get(key)
    if (list) {
      list.push(word)
    } else {
      groups.set(key, [word])
    }
  }

  return Array.from(groups.values())
}
\`\`\`

### Complexity
- **Time Complexity:** \`O(N * K)\` where \`N\` is word count and \`K\` is max word length.
- **Space Complexity:** \`O(N * K)\` to store the output clusters.`,

  default: `Here is a breakdown of the requested solution:

1. **Architecture & Principles:**
   - Designed for local execution with zero cloud network overhead.
   - Preserves state in memory with immediate reactive UI rendering.

2. **Core Implementation:**
   - Validated against edge cases (empty buffers, boundary values, UTF-8 strings).
   - High throughput and low memory footprint.

\`\`\`json
{
  "status": "success",
  "engine": "local-llm",
  "mode": "offline-benchmark",
  "verified": true
}
\`\`\`

Feel free to refine the parameters or test another prompt.`
}

/**
 * Runs an offline simulation stream that yields realistic token pacing and benchmarks.
 */
export async function simulateStreamCompletion(
  modelId: string,
  prompt: string,
  onChunk: (text: string) => void,
  onDone: (metrics: BenchmarkMetrics) => void,
  signal?: AbortSignal
): Promise<void> {
  const startTime = Date.now()

  // Choose appropriate response
  const lower = prompt.toLowerCase()
  const textToStream = lower.includes('anagram')
    ? SIMULATION_RESPONSES.anagram
    : SIMULATION_RESPONSES.default

  // Word/token-based chunks
  const tokens = textToStream.match(/\S+\s*|\n+/g) ?? [textToStream]

  // Simulate initial pre-fill / TTFT delay (80-140ms)
  await new Promise((r) => setTimeout(r, 100))
  if (signal?.aborted) return

  const firstTokenTime = Date.now()

  // Stream chunks at ~65-90 tokens/sec (approx 12-16ms per token)
  let streamedTokens = 0
  for (const token of tokens) {
    if (signal?.aborted) return
    onChunk(token)
    streamedTokens++
    await new Promise((r) => setTimeout(r, 14))
  }

  const endTime = Date.now()
  const benchmark = calculateBenchmark(startTime, firstTokenTime, endTime, streamedTokens, {
    isSimulated: true,
    modelId
  })

  onDone(benchmark)
}
