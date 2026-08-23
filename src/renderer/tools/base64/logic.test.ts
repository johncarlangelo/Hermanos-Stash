import { describe, expect, it } from 'vitest'
import { decodeBase64Utf8, encodeBase64Utf8 } from './logic'

describe('encodeBase64Utf8', () => {
  it('round-trips plain ASCII', () => {
    const encoded = encodeBase64Utf8('Hello, world!')
    expect(encoded).toEqual({ ok: true, output: 'SGVsbG8sIHdvcmxkIQ==' })
    expect(decodeBase64Utf8(encoded.ok ? encoded.output : '')).toEqual({
      ok: true,
      output: 'Hello, world!'
    })
  })

  it('round-trips emoji without mangling code points', () => {
    const text = 'stash 🚀🔥 done'
    const result = encodeBase64Utf8(text)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(decodeBase64Utf8(result.output)).toEqual({ ok: true, output: text })
    }
  })

  it('round-trips CJK and mixed-script text', () => {
    const text = '中文テスト한국어 mixed with latin'
    const result = encodeBase64Utf8(text)
    expect(result.ok).toBe(true)
    if (result.ok) expect(decodeBase64Utf8(result.output)).toEqual({ ok: true, output: text })
  })

  it('encodes the empty string to an empty payload', () => {
    expect(encodeBase64Utf8('')).toEqual({ ok: true, output: '' })
  })

  it('handles multi-kilobyte input beyond the chunk boundary', () => {
    const text = 'x'.repeat(100_000)
    const result = encodeBase64Utf8(text)
    expect(result.ok).toBe(true)
    if (result.ok) expect(decodeBase64Utf8(result.output)).toEqual({ ok: true, output: text })
  })
})

describe('decodeBase64Utf8 — tolerance decisions', () => {
  it('tolerates missing padding ("QQ" decodes like "QQ==")', () => {
    expect(decodeBase64Utf8('QQ')).toEqual({ ok: true, output: 'A' })
    expect(decodeBase64Utf8('QUI')).toEqual({ ok: true, output: 'AB' })
  })

  it('tolerates embedded whitespace and line breaks', () => {
    expect(decodeBase64Utf8('SGVs\nbG8g\nd29ybGQh')).toEqual({ ok: true, output: 'Hello world!' })
    expect(decodeBase64Utf8('  SGVsbG8= ')).toEqual({ ok: true, output: 'Hello' })
  })

  it('rejects illegal characters like "!!"', () => {
    const result = decodeBase64Utf8('!!')
    expect(result.ok).toBe(false)
    expect((result as { error: string }).error).toMatch(/not valid Base64/i)
  })

  it('rejects impossible lengths (remainder of 1)', () => {
    expect(decodeBase64Utf8('ABCDE').ok).toBe(false)
  })

  it('rejects bytes that are not valid UTF-8 instead of emitting replacement junk', () => {
    // Base64 of a lone 0xFF byte.
    const result = decodeBase64Utf8('/w==')
    expect(result.ok).toBe(false)
    expect((result as { error: string }).error).toMatch(/UTF-8/i)
  })

  it('decodes an empty or whitespace-only payload to an empty string', () => {
    expect(decodeBase64Utf8('')).toEqual({ ok: true, output: '' })
    expect(decodeBase64Utf8(' \n ')).toEqual({ ok: true, output: '' })
  })

  it('decodes standard padded payloads produced by other encoders', () => {
    expect(decodeBase64Utf8('5Lit5paH')).toEqual({ ok: true, output: '中文' })
  })
})
