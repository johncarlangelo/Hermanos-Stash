import { describe, expect, it } from 'vitest'
import { csvToJson, jsonToCsv, parseCsv, serializeCsv } from './logic'

const COMMA = { delimiter: ',' as const, headerRow: false }

describe('parseCsv', () => {
  it('parses simple rows and columns', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual({
      ok: true,
      rows: [
        ['a', 'b', 'c'],
        ['1', '2', '3']
      ]
    })
  })

  it('keeps quoted fields intact including delimiters', () => {
    expect(parseCsv('"a,b",c')).toEqual({ ok: true, rows: [['a,b', 'c']] })
  })

  it('unescapes doubled quotes inside quoted fields', () => {
    expect(parseCsv('"he said ""hi"""')).toEqual({ ok: true, rows: [['he said "hi"']] })
  })

  it('supports newlines embedded in quoted fields', () => {
    expect(parseCsv('a,"line1\nline2",c')).toEqual({
      ok: true,
      rows: [['a', 'line1\nline2', 'c']]
    })
  })

  it('normalizes CRLF line endings to LF', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual({
      ok: true,
      rows: [
        ['a', 'b'],
        ['c', 'd']
      ]
    })
  })

  it('tolerates a trailing final newline without an empty row', () => {
    expect(parseCsv('a,b\n')).toEqual({ ok: true, rows: [['a', 'b']] })
  })

  it('splits on tab when the delimiter is a tab', () => {
    expect(parseCsv('a\tb\nc\td', '\t')).toEqual({
      ok: true,
      rows: [
        ['a', 'b'],
        ['c', 'd']
      ]
    })
  })

  it('returns an empty row set for empty input (boundary)', () => {
    expect(parseCsv('')).toEqual({ ok: true, rows: [] })
  })

  it('reports an unclosed quote with its opening line', () => {
    const result = parseCsv('ok,line\n"starts here\nnever ends')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toMatch(/quoted field/i)
      expect(result.error.line).toBe(2)
    }
  })
})

describe('serializeCsv', () => {
  it('round-trips through the parser', () => {
    const rows = [
      ['a', 'b'],
      ['x,y', '"quoted"', 'multi\nline']
    ]
    const text = serializeCsv(rows)
    expect(parseCsv(text)).toEqual({ ok: true, rows })
  })

  it('quotes fields containing the delimiter, quotes or newlines', () => {
    expect(serializeCsv([['p,q']])).toBe('"p,q"')
    expect(serializeCsv([['say "hi"']])).toBe('"say ""hi"""')
    expect(serializeCsv([['l1\nl2']])).toBe('"l1\nl2"')
  })

  it('quotes fields with leading or trailing whitespace', () => {
    expect(serializeCsv([[' padded ']])).toBe('" padded "')
  })

  it('leaves plain fields untouched', () => {
    expect(serializeCsv([['plain', '123']])).toBe('plain,123')
  })

  it('round-trips TSV delimiters', () => {
    const rows = [['a', 'b\tc']]
    expect(parseCsv(serializeCsv(rows, '\t'), '\t')).toEqual({ ok: true, rows })
  })
})

describe('csvToJson', () => {
  it('produces an array of arrays when header mode is off', () => {
    const result = csvToJson('a,b\n1,2', COMMA)
    expect(result).toEqual({
      ok: true,
      output: JSON.stringify(
        [
          ['a', 'b'],
          ['1', '2']
        ],
        null,
        2
      )
    })
  })

  it('uses the first row as keys when header mode is on', () => {
    const result = csvToJson('name,qty\nbolt,12', { ...COMMA, headerRow: true })
    expect(result).toEqual({
      ok: true,
      output: JSON.stringify([{ name: 'bolt', qty: '12' }], null, 2)
    })
  })

  it('propagates parser errors unchanged', () => {
    const result = csvToJson('"unterminated', COMMA)
    expect(result.ok).toBe(false)
  })

  it('rejects empty input with an actionable message', () => {
    const result = csvToJson('', COMMA)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/empty/i)
  })
})

describe('jsonToCsv', () => {
  it('converts an array of arrays directly', () => {
    expect(jsonToCsv('[["a","b"],["1","2"]]', COMMA)).toEqual({ ok: true, output: 'a,b\n1,2' })
  })

  it('builds a union header from object keys when header mode is on', () => {
    const result = jsonToCsv('[{"name":"bolt","qty":12},{"name":"nut","note":"fine"}]', {
      ...COMMA,
      headerRow: true
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.split('\n')[0]).toBe('name,qty,note')
    }
  })

  it('refuses objects while header mode is off instead of dropping data', () => {
    const result = jsonToCsv('[{"a":1}]', COMMA)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/header/i)
  })

  it('reports structured errors for malformed JSON', () => {
    const result = jsonToCsv('{broken', COMMA)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message.length).toBeGreaterThan(0)
      expect(typeof result.error.line).toBe('number')
    }
  })

  it('rejects non-array top-level values', () => {
    const result = jsonToCsv('{"not":"an array"}', COMMA)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/array/i)
  })

  it('rejects empty input (boundary)', () => {
    expect(jsonToCsv('  ', COMMA).ok).toBe(false)
  })

  it('full round-trip CSV → JSON → CSV is lossless for tricky fields', () => {
    const original = 'name,note\nbolt,"has, comma"\nnut,"line1\nline2"'
    const json = csvToJson(original, { ...COMMA, headerRow: true })
    expect(json.ok).toBe(true)
    if (json.ok) {
      const back = jsonToCsv(json.output, { ...COMMA, headerRow: true })
      expect(back.ok).toBe(true)
      if (back.ok) expect(back.output).toBe(original)
    }
  })
})
