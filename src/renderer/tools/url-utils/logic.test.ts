import { describe, expect, it } from 'vitest'
import { decodeComponent, encodeComponent, parseQuery, parseUrlComponents } from './logic'

describe('parseUrlComponents — full URLs', () => {
  it('splits every component of a complete URL', () => {
    const r = parseUrlComponents(
      'https://user:pw@api.example.com:8443/v1/items?page=2&sort=desc#frag'
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.parts.protocol).toBe('https:')
    expect(r.parts.hostname).toBe('api.example.com')
    expect(r.parts.port).toBe('8443')
    expect(r.parts.host).toBe('api.example.com:8443')
    expect(r.parts.pathname).toBe('/v1/items')
    expect(r.parts.search).toBe('?page=2&sort=desc')
    expect(r.parts.hash).toBe('#frag')
    expect(r.parts.origin).toBe('https://api.example.com:8443')
    expect(r.parts.searchParams).toEqual([
      { key: 'page', value: '2' },
      { key: 'sort', value: 'desc' }
    ])
  })

  it('omits port when it is the default', () => {
    const r = parseUrlComponents('https://example.com/x')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.parts.port).toBeUndefined()
  })
})

describe('parseUrlComponents — protocol auto-prepend', () => {
  it('prepends https:// when the scheme is missing (documented behavior)', () => {
    const r = parseUrlComponents('example.com/path?q=1')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.parts.href.startsWith('https://example.com/path')).toBe(true)
    expect(r.parts.searchParams).toEqual([{ key: 'q', value: '1' }])
  })

  it('keeps explicit http and custom schemes untouched', () => {
    const http = parseUrlComponents('http://example.com/')
    expect(http.ok && http.parts.protocol).toBe('http:')
    const custom = parseUrlComponents('myapp+scheme://host/x')
    expect(custom.ok && custom.parts.hostname).toBe('host')
  })
})

describe('parseUrlComponents — edge cases and errors', () => {
  it('rejects empty input', () => {
    expect(parseUrlComponents('   ').ok).toBe(false)
  })

  it('rejects malformed URLs like "http://" with an error message', () => {
    const r = parseUrlComponents('http://')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.length).toBeGreaterThan(0)
  })

  it('handles empty query and hash gracefully', () => {
    const r = parseUrlComponents('https://example.com/a/b')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.parts.search).toBe('')
    expect(r.parts.hash).toBe('')
    expect(r.parts.searchParams).toEqual([])
  })

  it('decodes plus-encoded spaces through searchParams semantics', () => {
    const r = parseUrlComponents('https://e.com/?a=%20b')
    expect(r.ok && r.parts.searchParams[0]?.value).toBe(' b')
  })
})

describe('encode/decode components', () => {
  it('round-trips arbitrary unicode text', () => {
    const text = 'héllo wörld / 你好 & ?=#%'
    const enc = encodeComponent(text)
    expect(enc.ok).toBe(true)
    if (!enc.ok) return
    const dec = decodeComponent(enc.output)
    expect(dec.ok && dec.output).toBe(text)
  })

  it('leaves unreserved characters alone', () => {
    expect(encodeComponent("abc123-_.!~*'()")).toEqual({
      ok: true,
      output: "abc123-_.!~*'()"
    })
  })

  it('rejects a lone % as invalid percent-encoding', () => {
    const dec = decodeComponent('%')
    expect(dec.ok).toBe(false)
    if (dec.ok) return
    expect(dec.error).toContain('%')
  })

  it('rejects truncated escapes', () => {
    expect(decodeComponent('%E0%A4').ok).toBe(false)
  })

  it('passes plain text through decode unchanged', () => {
    expect(decodeComponent('plain')).toEqual({ ok: true, output: 'plain' })
  })
})

describe('parseQuery', () => {
  it('parses with or without the leading question mark', () => {
    expect(parseQuery('?a=1&b=2')).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' }
    ])
    expect(parseQuery('a=1&b=2')).toEqual(parseQuery('?a=1&b=2'))
  })

  it('returns nothing for empty input', () => {
    expect(parseQuery('')).toEqual([])
    expect(parseQuery('?')).toEqual([])
  })

  it('preserves empty values and percent-decodes keys/values', () => {
    expect(parseQuery('flag=&q=a%20b')).toEqual([
      { key: 'flag', value: '' },
      { key: 'q', value: 'a b' }
    ])
  })
})
