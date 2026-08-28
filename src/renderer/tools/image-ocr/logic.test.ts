import { describe, expect, it } from 'vitest'
import { cleanOcrText, computeTextStats, formatConfidence, PSM_OPTIONS } from './logic'

describe('Image OCR Logic', () => {
  describe('computeTextStats', () => {
    it('handles empty text correctly', () => {
      const stats = computeTextStats('')
      expect(stats).toEqual({
        words: 0,
        characters: 0,
        charactersNoSpaces: 0,
        lines: 0,
        paragraphs: 0
      })
    })

    it('computes words, characters, and line counts correctly', () => {
      const sample = 'Hello world!\nThis is Hermanos Stash OCR.'
      const stats = computeTextStats(sample)
      expect(stats.words).toBe(7)
      expect(stats.characters).toBe(40)
      expect(stats.charactersNoSpaces).toBe(34)
      expect(stats.lines).toBe(2)
      expect(stats.paragraphs).toBe(1)
    })

    it('computes multiple paragraphs separated by blank lines', () => {
      const sample = 'Paragraph one text.\n\nParagraph two with more words.\n\nParagraph three.'
      const stats = computeTextStats(sample)
      expect(stats.paragraphs).toBe(3)
      expect(stats.lines).toBe(5)
      expect(stats.words).toBe(10)
    })
  })

  describe('formatConfidence', () => {
    it('classifies confidence >= 85 as High', () => {
      expect(formatConfidence(95)).toEqual({ score: 95, label: 'High', percentString: '95%' })
      expect(formatConfidence(85)).toEqual({ score: 85, label: 'High', percentString: '85%' })
    })

    it('classifies confidence 70-84 as Good', () => {
      expect(formatConfidence(78)).toEqual({ score: 78, label: 'Good', percentString: '78%' })
      expect(formatConfidence(70)).toEqual({ score: 70, label: 'Good', percentString: '70%' })
    })

    it('classifies confidence 50-69 as Moderate', () => {
      expect(formatConfidence(62)).toEqual({ score: 62, label: 'Moderate', percentString: '62%' })
      expect(formatConfidence(50)).toEqual({ score: 50, label: 'Moderate', percentString: '50%' })
    })

    it('classifies confidence < 50 as Low', () => {
      expect(formatConfidence(42)).toEqual({ score: 42, label: 'Low', percentString: '42%' })
      expect(formatConfidence(0)).toEqual({ score: 0, label: 'Low', percentString: '0%' })
    })

    it('clamps out of bound scores into 0-100', () => {
      expect(formatConfidence(120)).toEqual({ score: 100, label: 'High', percentString: '100%' })
      expect(formatConfidence(-10)).toEqual({ score: 0, label: 'Low', percentString: '0%' })
    })
  })

  describe('cleanOcrText', () => {
    it('returns empty string for empty input', () => {
      expect(cleanOcrText('')).toBe('')
    })

    it('trims line ends when requested', () => {
      const noisy = 'Line one   \nLine two  \t\nLine three'
      expect(cleanOcrText(noisy, { trimLines: true })).toBe('Line one\nLine two\nLine three')
    })

    it('normalizes multiple spaces to single spaces', () => {
      const noisy = 'Total   Amount:   $12.50\nTax:   $1.00'
      expect(cleanOcrText(noisy, { normalizeSpaces: true })).toBe(
        'Total Amount: $12.50\nTax: $1.00'
      )
    })

    it('collapses 3+ newlines into 2', () => {
      const noisy = 'Section 1\n\n\n\n\nSection 2'
      expect(cleanOcrText(noisy, { collapseBlankLines: true })).toBe('Section 1\n\nSection 2')
    })
  })

  describe('PSM Options', () => {
    it('contains valid page segmentation modes', () => {
      expect(PSM_OPTIONS.length).toBeGreaterThanOrEqual(4)
      const ids = PSM_OPTIONS.map((p) => p.id)
      expect(ids).toContain('auto')
      expect(ids).toContain('single_block')
      expect(ids).toContain('sparse_text')
      expect(ids).toContain('single_line')
    })
  })
})
