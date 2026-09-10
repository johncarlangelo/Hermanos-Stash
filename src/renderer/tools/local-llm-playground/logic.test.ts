import { describe, expect, it } from 'vitest'
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
  simulateStreamCompletion
} from './logic'

describe('local-llm-playground logic engine [BETA]', () => {
  describe('parseOllamaTags', () => {
    it('parses valid Ollama /api/tags payload into model profiles', () => {
      const sample = {
        models: [
          {
            name: 'llama3.2:latest',
            size: 2019393152,
            details: {
              parameter_size: '3B',
              quantization_level: 'Q4_K_M',
              family: 'llama'
            }
          },
          {
            name: 'deepseek-r1:7b',
            size: 4700000000,
            details: {
              parameter_size: '7B',
              quantization_level: 'Q4_K_M',
              family: 'deepseek'
            }
          }
        ]
      }

      const models = parseOllamaTags(sample)
      expect(models.length).toBe(2)
      expect(models[0].id).toBe('llama3.2:latest')
      expect(models[0].parameterSize).toBe('3B')
      expect(models[0].quantization).toBe('Q4_K_M')
      expect(models[0].isSimulated).toBe(false)
    })

    it('handles empty or malformed tags gracefully', () => {
      expect(parseOllamaTags(null)).toEqual([])
      expect(parseOllamaTags({})).toEqual([])
      expect(parseOllamaTags({ models: 'not-an-array' })).toEqual([])
    })
  })

  describe('parseOpenAiModels', () => {
    it('parses OpenAI-compatible model list format', () => {
      const sample = {
        data: [{ id: 'qwen2.5-coder-7b' }, { id: 'mistral-nemo' }]
      }

      const models = parseOpenAiModels(sample)
      expect(models.length).toBe(2)
      expect(models[0].id).toBe('qwen2.5-coder-7b')
    })
  })

  describe('parseNdjsonChunk', () => {
    it('extracts streaming message content and done flag', () => {
      const chunk = `{"message":{"role":"assistant","content":"Hello"},"done":false}\n{"message":{"role":"assistant","content":" world"},"done":false}\n{"message":{"role":"assistant","content":"!"},"done":true,"eval_count":3,"eval_duration":30000000}`
      const parsed = parseNdjsonChunk(chunk)

      expect(parsed.length).toBe(3)
      expect(parsed[0].content).toBe('Hello')
      expect(parsed[0].done).toBe(false)
      expect(parsed[2].content).toBe('!')
      expect(parsed[2].done).toBe(true)
      expect(parsed[2].rawMeta).toBeDefined()
    })

    it('handles legacy response field format', () => {
      const chunk = `{"response":"Test","done":true}`
      const parsed = parseNdjsonChunk(chunk)
      expect(parsed.length).toBe(1)
      expect(parsed[0].content).toBe('Test')
      expect(parsed[0].done).toBe(true)
    })
  })

  describe('calculateBenchmark', () => {
    it('computes exact tokens/second using Ollama nanosecond metadata', () => {
      const startTime = 1000
      const firstTokenTime = 1200 // 200ms TTFT
      const endTime = 3000
      const ollamaMeta = {
        eval_count: 90,
        eval_duration: 1_000_000_000, // 1.0 second = 90 tok/s
        prompt_eval_count: 20,
        prompt_eval_duration: 150_000_000
      }

      const bench = calculateBenchmark(startTime, firstTokenTime, endTime, 90, ollamaMeta)
      expect(bench.timeToFirstTokenMs).toBe(200)
      expect(bench.tokensGenerated).toBe(90)
      expect(bench.tokensPerSecond).toBe(90.0)
      expect(bench.promptTokens).toBe(20)
      expect(bench.promptEvalDurationSec).toBe(0.15)
    })

    it('computes client-side fallback speed when meta is missing', () => {
      const startTime = 1000
      const firstTokenTime = 1100
      const endTime = 2100 // 1000ms generation duration
      const bench = calculateBenchmark(startTime, firstTokenTime, endTime, 50)

      expect(bench.timeToFirstTokenMs).toBe(100)
      expect(bench.tokensGenerated).toBe(50)
      expect(bench.tokensPerSecond).toBe(50.0)
    })
  })

  describe('clampOptions', () => {
    it('clamps temperatures and tokens within valid ranges', () => {
      const clamped = clampOptions({
        temperature: 2.5,
        topP: 1.5,
        maxTokens: 10_000,
        systemPrompt: '  Be brief.  '
      })

      expect(clamped.temperature).toBe(2.0)
      expect(clamped.topP).toBe(1.0)
      expect(clamped.maxTokens).toBe(8192)
      expect(clamped.systemPrompt).toBe('Be brief.')
    })
  })

  describe('formatBytes', () => {
    it('formats bytes into KB, MB, and GB', () => {
      expect(formatBytes(500)).toBe('500 B')
      expect(formatBytes(1024 * 500)).toBe('500.0 KB')
      expect(formatBytes(1024 * 1024 * 750)).toBe('750.0 MB')
      expect(formatBytes(1024 * 1024 * 1024 * 3.5)).toBe('3.50 GB')
    })
  })

  describe('simulateStreamCompletion', () => {
    it('streams simulated tokens and reports benchmark on finish', async () => {
      const chunks: string[] = []
      let finalMetrics: unknown = null

      await simulateStreamCompletion(
        'llama-3.2-3b-sim',
        'Hello test prompt',
        (chunk) => chunks.push(chunk),
        (metrics) => {
          finalMetrics = metrics
        }
      )

      expect(chunks.length).toBeGreaterThan(5)
      expect(chunks.join('').length).toBeGreaterThan(20)
      expect(finalMetrics).toBeDefined()
      expect((finalMetrics as { tokensPerSecond: number }).tokensPerSecond).toBeGreaterThan(0)
    })

    it('respects AbortSignal for cooperative cancellation', async () => {
      const controller = new AbortController()
      const chunks: string[] = []

      setTimeout(() => controller.abort(), 20)

      await simulateStreamCompletion(
        'llama-3.2-3b-sim',
        'Quick test',
        (c) => chunks.push(c),
        () => {},
        controller.signal
      )

      // Should abort early with few or no chunks
      expect(controller.signal.aborted).toBe(true)
    })
  })

  describe('presets integrity', () => {
    it('contains default endpoints, models, and presets', () => {
      expect(DEFAULT_ENDPOINTS.length).toBeGreaterThanOrEqual(3)
      expect(SIMULATED_MODELS.length).toBeGreaterThanOrEqual(3)
      expect(SYSTEM_PROMPT_PRESETS.length).toBeGreaterThanOrEqual(3)
      expect(QUICK_PROMPTS.length).toBeGreaterThanOrEqual(3)
    })
  })
})
