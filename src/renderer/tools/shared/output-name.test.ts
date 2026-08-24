import { describe, expect, it } from 'vitest'
import {
  applyNamePattern,
  ensureExtension,
  sanitizeFileName,
  validateOutputName,
  validateOutputStem
} from './output-name'

describe('sanitizeFileName', () => {
  it('strips characters Windows forbids in file names', () => {
    expect(sanitizeFileName('a<b>c:d"e/f\\g|h?i*j')).toBe('abcdefghij')
  })

  it('strips control characters', () => {
    expect(sanitizeFileName(`re${String.fromCharCode(0)}port`)).toBe('report')
    expect(sanitizeFileName('re\u001fport')).toBe('report')
  })

  it('collapses runs of whitespace into single spaces', () => {
    expect(sanitizeFileName('my   report\t  file')).toBe('my report file')
  })

  it('trims trailing dots and spaces', () => {
    expect(sanitizeFileName('report.. ')).toBe('report')
  })

  it('caps the result at 120 characters', () => {
    const cleaned = sanitizeFileName('x'.repeat(300))
    expect(cleaned.length).toBe(120)
    expect(cleaned).toBe('x'.repeat(120))
  })
})

describe('ensureExtension', () => {
  it('keeps a matching extension untouched', () => {
    expect(ensureExtension('photo.png', '.png')).toBe('photo.png')
  })

  it('matches extensions case-insensitively while preserving user casing', () => {
    expect(ensureExtension('Photo.PNG', '.png')).toBe('Photo.PNG')
    expect(ensureExtension('scan.Png', '.png')).toBe('scan.Png')
  })

  it('appends the extension when missing', () => {
    expect(ensureExtension('report', '.pdf')).toBe('report.pdf')
  })

  it('appends when a different extension is present', () => {
    expect(ensureExtension('photo.jpg', '.png')).toBe('photo.jpg.png')
  })
})

describe('validateOutputName', () => {
  it('rejects empty and whitespace-only input', () => {
    expect(validateOutputName('', '.png')).toEqual({ ok: false, error: 'Enter a file name.' })
    expect(validateOutputName('   ', '.png')).toEqual({ ok: false, error: 'Enter a file name.' })
  })

  it('rejects names that sanitize to nothing', () => {
    expect(validateOutputName('<>?:"/\\|*', '.png')).toEqual({
      ok: false,
      error: 'That name contains only invalid characters.'
    })
  })

  it('sanitizes and appends the extension on success', () => {
    expect(validateOutputName('my report!', '.pdf')).toEqual({ ok: true, value: 'my report!.pdf' })
  })

  it('rejects reserved Windows device names with or without an extension', () => {
    for (const raw of ['CON', 'con.txt', 'PRN', 'AUX', 'NUL', 'COM1', 'com4.zip', 'LPT9']) {
      expect(validateOutputName(raw, '.pdf'), raw).toEqual({
        ok: false,
        error: 'That name is reserved by Windows.'
      })
    }
  })

  it('allows ordinary stems that merely start with a reserved word', () => {
    expect(validateOutputName('conference notes', '.md')).toEqual({
      ok: true,
      value: 'conference notes.md'
    })
  })

  it('does not double-append when the extension already matches', () => {
    expect(validateOutputName('qrcode.png', '.png')).toEqual({ ok: true, value: 'qrcode.png' })
  })
})

describe('validateOutputStem', () => {
  it('validates without forcing any extension', () => {
    expect(validateOutputStem('clip')).toEqual({ ok: true, value: 'clip' })
    expect(validateOutputStem('clip.mp4')).toEqual({ ok: true, value: 'clip.mp4' })
    expect(validateOutputStem('')).toEqual({ ok: false, error: 'Enter a file name.' })
  })

  it('rejects reserved device names too', () => {
    expect(validateOutputStem('NUL')).toEqual({
      ok: false,
      error: 'That name is reserved by Windows.'
    })
  })
})

describe('applyNamePattern', () => {
  it('substitutes the {name} token with the sanitized source stem', () => {
    expect(applyNamePattern('{name}-small', 'photo')).toEqual({ ok: true, value: 'photo-small' })
  })

  it('replaces every occurrence of the token', () => {
    expect(applyNamePattern('{name}-{name}', 'shot')).toEqual({ ok: true, value: 'shot-shot' })
  })

  it('sanitizes the substituted stem and the surrounding pattern', () => {
    expect(applyNamePattern('{name}-v2', 'im/port ant')).toEqual({
      ok: true,
      value: 'import ant-v2'
    })
    expect(applyNamePattern('{name}?', 'report')).toEqual({ ok: true, value: 'report' })
  })

  it('rejects patterns without the {name} token', () => {
    expect(applyNamePattern('-min', 'photo')).toEqual({
      ok: false,
      error: 'Pattern must include {name}.'
    })
  })

  it('rejects an empty pattern', () => {
    expect(applyNamePattern('', 'photo')).toEqual({
      ok: false,
      error: 'Pattern must include {name}.'
    })
  })
})
