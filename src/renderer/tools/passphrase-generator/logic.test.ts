import { describe, expect, it } from 'vitest'
import {
  entropyBits,
  generatePassphrase,
  generatePassword,
  strengthLabel,
  SYMBOL_SET,
  WORDLIST
} from './logic'

describe('WORDLIST', () => {
  it('contains exactly 256 unique words', () => {
    expect(WORDLIST.length).toBe(256)
    expect(new Set(WORDLIST).size).toBe(256)
  })

  it('keeps every word short, lowercase, and alphabetic', () => {
    for (const word of WORDLIST) {
      expect(word.length >= 3 && word.length <= 7, word).toBe(true)
      expect(word, word).toMatch(/^[a-z]+$/)
    }
  })
})

describe('generatePassphrase', () => {
  it('joins n words with the separator and appends two digits by default', () => {
    const pattern = /^([A-Z][a-z]+)(-[A-Z][a-z]+){3}\d{2}$/
    for (let i = 0; i < 50; i++) {
      const phrase = generatePassphrase({ words: 4 })
      expect(pattern.test(phrase), phrase).toBe(true)
    }
  })

  it('honors custom separators, casing, and number toggles across iterations', () => {
    const plainPattern = /^[a-z]+(\.[a-z]+)+$/
    for (let i = 0; i < 50; i++) {
      const phrase = generatePassphrase({
        words: 5,
        separator: '.',
        capitalize: false,
        appendNumber: false
      })
      expect(phrase.split('.').length, phrase).toBe(5)
      expect(plainPattern.test(phrase), phrase).toBe(true)
    }
  })

  it('produces only dictionary words it actually contains', () => {
    const known = new Set(WORDLIST.map((w) => w[0].toUpperCase() + w.slice(1)))
    for (let i = 0; i < 50; i++) {
      const parts = generatePassphrase({ words: 6, appendNumber: false }).split('-')
      for (const part of parts) expect(known.has(part), part).toBe(true)
    }
  })

  it('varies output between draws (CSPRNG is not stuck)', () => {
    const seen = new Set(Array.from({ length: 20 }, () => generatePassphrase()))
    expect(seen.size).toBeGreaterThan(10)
  })
})

describe('generatePassword', () => {
  it('always includes at least one char from every selected class', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword(24, { upper: true, digits: true, symbols: true })
      expect(pw.length).toBe(24)
      expect(/[a-z]/.test(pw)).toBe(true)
      expect(/[A-Z]/.test(pw)).toBe(true)
      expect(/[0-9]/.test(pw)).toBe(true)
      const symbolsRe = new RegExp(`[${SYMBOL_SET.replace(/[-^\\\]]/g, '\\$&')}]`)
      expect(symbolsRe.test(pw), pw).toBe(true)
    }
  })

  it('omits disabled classes entirely', () => {
    for (let i = 0; i < 20; i++) {
      const pw = generatePassword(30, { upper: false, digits: false, symbols: false })
      expect(/^[a-z]+$/.test(pw), pw).toBe(true)
    }
  })

  it('rejects lengths below the required class count', () => {
    expect(() => generatePassword(2)).toThrow(RangeError)
    expect(() => generatePassword(1.5)).toThrow(RangeError)
  })
})

describe('entropyBits', () => {
  it('uses log2(256)=8 per word', () => {
    expect(entropyBits({ mode: 'words', words: 4 })).toBeCloseTo(32)
    expect(entropyBits({ mode: 'words', words: 8 })).toBeCloseTo(64)
  })

  it('multiplies length by log2(alphabetSize) exactly', () => {
    expect(entropyBits({ mode: 'chars', length: 20, alphabetSize: 62 })).toBeCloseTo(
      20 * Math.log2(62)
    )
    expect(entropyBits({ mode: 'chars', length: 16, alphabetSize: 88 })).toBeCloseTo(
      16 * Math.log2(88)
    )
  })

  it('returns zero for degenerate alphabets', () => {
    expect(entropyBits({ mode: 'chars', length: 10, alphabetSize: 1 })).toBe(0)
  })
})

describe('strengthLabel', () => {
  it('sits on the documented thresholds', () => {
    expect(strengthLabel(44.9)).toBe('Weak')
    expect(strengthLabel(45)).toBe('Fair')
    expect(strengthLabel(59.9)).toBe('Fair')
    expect(strengthLabel(60)).toBe('Strong')
    expect(strengthLabel(79.9)).toBe('Strong')
    expect(strengthLabel(80)).toBe('Excellent')
    expect(strengthLabel(0)).toBe('Weak')
    expect(strengthLabel(128)).toBe('Excellent')
  })
})
