import { describe, expect, it } from 'vitest'
import {
  MODEL_PROFILES,
  SAMPLE_PRESETS,
  calculateContextUtilization,
  calculateCostEstimate,
  calculateTextMetrics,
  formatDuration,
  formatNumber,
  formatUsd,
  segmentTokens
} from './logic'

describe('token-counter logic engine', () => {
  describe('segmentTokens', () => {
    it('returns empty array for empty string or nullish input', () => {
      expect(segmentTokens('')).toEqual([])
    })

    it('segments simple single-word tokens with sequential index and colorIndex', () => {
      const tokens = segmentTokens('Hello world')
      expect(tokens.length).toBeGreaterThanOrEqual(2)
      expect(tokens[0].index).toBe(1)
      expect(tokens[0].colorIndex).toBe(0)
      expect(tokens[1].index).toBe(2)
      expect(tokens[1].colorIndex).toBe(1)
    })

    it('splits contractions correctly', () => {
      const tokens = segmentTokens("don't we'll")
      const texts = tokens.map((t) => t.text)
      expect(texts.some((t) => t.includes("'t") || t.includes('t'))).toBe(true)
      expect(texts.some((t) => t.includes("'ll") || t.includes('ll'))).toBe(true)
    })

    it('chunks numbers into up to 3-digit blocks', () => {
      const tokens = segmentTokens('123456789')
      expect(tokens.length).toBe(3)
      expect(tokens[0].text).toBe('123')
      expect(tokens[1].text).toBe('456')
      expect(tokens[2].text).toBe('789')
    })

    it('handles multiple newlines and spaces as distinct tokens', () => {
      const text = 'Line 1\n\n    Line 2'
      const tokens = segmentTokens(text)
      expect(tokens.some((t) => t.text.includes('\n'))).toBe(true)
      expect(tokens.length).toBeGreaterThan(3)
    })

    it('handles CJK multilingual characters', () => {
      const tokens = segmentTokens('こんにちは世界')
      expect(tokens.length).toBe(7) // 5 hiragana + 2 kanji
    })
  })

  describe('calculateTextMetrics', () => {
    it('computes accurate characters, words, lines, and timing', () => {
      const sample = 'First line of text.\nSecond line of text with more words.'
      const tokens = segmentTokens(sample)
      const metrics = calculateTextMetrics(sample, tokens.length)

      expect(metrics.totalTokens).toBe(tokens.length)
      expect(metrics.characters).toBe(sample.length)
      expect(metrics.lines).toBe(2)
      expect(metrics.words).toBe(11)
      expect(metrics.charsPerToken).toBeGreaterThan(1)
      expect(metrics.readingTimeSec).toBeGreaterThan(0)
      expect(metrics.generationTimeSec).toBeGreaterThan(0)
    })

    it('handles zero-token / empty state gracefully', () => {
      const metrics = calculateTextMetrics('', 0)
      expect(metrics.totalTokens).toBe(0)
      expect(metrics.characters).toBe(0)
      expect(metrics.words).toBe(0)
      expect(metrics.lines).toBe(0)
      expect(metrics.charsPerToken).toBe(0)
    })
  })

  describe('calculateContextUtilization', () => {
    it('reports safe status under 75%', () => {
      const res = calculateContextUtilization(10_000, 128_000)
      expect(res.status).toBe('safe')
      expect(res.percentageUsed).toBe(7.81)
      expect(res.tokensRemaining).toBe(118_000)
    })

    it('reports warning status between 75% and 99%', () => {
      const res = calculateContextUtilization(100_000, 128_000)
      expect(res.status).toBe('warning')
      expect(res.percentageUsed).toBe(78.13)
    })

    it('reports exceeded status at or above 100%', () => {
      const res = calculateContextUtilization(130_000, 128_000)
      expect(res.status).toBe('exceeded')
      expect(res.tokensRemaining).toBe(0)
    })
  })

  describe('calculateCostEstimate', () => {
    it('calculates prompt and completion costs accurately', () => {
      const gpt4o = MODEL_PROFILES.find((m) => m.id === 'gpt-4o')!
      expect(gpt4o).toBeDefined()

      // 10,000 prompt tokens @ $2.50/M = $0.025
      // 1,000 completion tokens @ $10.00/M = $0.010
      // Total = $0.035
      const cost = calculateCostEstimate(10_000, 1_000, gpt4o)
      expect(cost.promptTokens).toBe(10_000)
      expect(cost.completionTokens).toBe(1_000)
      expect(cost.totalTokens).toBe(11_000)
      expect(cost.promptCost).toBeCloseTo(0.025, 4)
      expect(cost.completionCost).toBeCloseTo(0.01, 4)
      expect(cost.totalCost).toBeCloseTo(0.035, 4)
      expect(cost.costPerThousandRequests).toBeCloseTo(35.0, 2)
    })

    it('adjusts prompt tokens according to model ratio', () => {
      const claude = MODEL_PROFILES.find((m) => m.id === 'claude-3-5-sonnet')!
      expect(claude.ratioVsBase).toBe(1.04)
      const cost = calculateCostEstimate(10_000, 500, claude)
      expect(cost.promptTokens).toBe(10_400)
    })
  })

  describe('formatters', () => {
    it('formats USD cleanly across scales', () => {
      expect(formatUsd(0)).toBe('$0.00')
      expect(formatUsd(0.000025)).toBe('$0.000025')
      expect(formatUsd(0.0035)).toBe('$0.0035')
      expect(formatUsd(12.5)).toBe('$12.50')
    })

    it('formats durations into minutes and seconds', () => {
      expect(formatDuration(45)).toBe('45s')
      expect(formatDuration(125)).toBe('2m 5s')
    })

    it('formats numbers with thousand separators', () => {
      expect(formatNumber(128000)).toBe('128,000')
    })
  })

  describe('sample presets', () => {
    it('contains valid and diverse sample presets', () => {
      expect(SAMPLE_PRESETS.length).toBeGreaterThanOrEqual(4)
      for (const preset of SAMPLE_PRESETS) {
        expect(preset.id).toBeTruthy()
        expect(preset.label).toBeTruthy()
        expect(preset.text.length).toBeGreaterThan(20)
        const tokens = segmentTokens(preset.text)
        expect(tokens.length).toBeGreaterThan(10)
      }
    })
  })
})
