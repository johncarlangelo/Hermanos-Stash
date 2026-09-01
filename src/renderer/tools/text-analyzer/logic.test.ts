import { describe, expect, it } from 'vitest'
import { analyzeText, countSyllables, getReadingEaseLabel } from './logic'

describe('text-analyzer logic', () => {
  it('handles empty text gracefully', () => {
    const res = analyzeText('')
    expect(res.wordCount).toBe(0)
    expect(res.charCount).toBe(0)
    expect(res.fleschGradeLevel).toBe(0)
  })

  it('counts syllables in words accurately', () => {
    expect(countSyllables('the')).toBe(1)
    expect(countSyllables('simple')).toBe(2)
    expect(countSyllables('complicated')).toBe(4)
  })

  it('calculates word, character, and sentence counts', () => {
    const text = 'The quick brown fox jumps over the lazy dog. It was a sunny afternoon!'
    const metrics = analyzeText(text)
    expect(metrics.wordCount).toBe(14)
    expect(metrics.sentenceCount).toBe(2)
    expect(metrics.charCount).toBe(text.length)
    expect(metrics.fleschReadingEase).toBeGreaterThan(60)
  })

  it('computes reading time and top keywords', () => {
    const text =
      'JavaScript and TypeScript are popular languages. TypeScript adds static types to JavaScript. Many developers use TypeScript.'
    const metrics = analyzeText(text)
    expect(metrics.readingTimeSeconds).toBeGreaterThanOrEqual(1)
    expect(metrics.topKeywords.some((k) => k.word === 'typescript')).toBe(true)
  })

  it('returns proper reading ease labels', () => {
    expect(getReadingEaseLabel(95)).toContain('Very Easy')
    expect(getReadingEaseLabel(65)).toContain('Standard')
    expect(getReadingEaseLabel(25)).toContain('Very Difficult')
  })
})
