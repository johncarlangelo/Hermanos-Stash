import { describe, expect, it } from 'vitest'
import { formatJson, positionToLineColumn, validateJson } from './logic'

describe('formatJson', () => {
  it('pretty-prints a simple object with the requested indent', () => {
    const result = formatJson('{"a":1}', 2)
    expect(result).toEqual({ ok: true, output: '{\n  "a": 1\n}' })
  })

  it('supports a four-space indent', () => {
    const result = formatJson('{"a":{"b":2}}', 4)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toBe('{\n    "a": {\n        "b": 2\n    }\n}')
  })

  it('supports tab indentation for nested structures', () => {
    const result = formatJson('[{"k":[1,2]}]', '\t')
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.output).toBe('[\n\t{\n\t\t"k": [\n\t\t\t1,\n\t\t\t2\n\t\t]\n\t}\n]')
  })

  it('minifies to a single line without whitespace', () => {
    const result = formatJson('{\n  "a": 1,\n  "b": [true, null]\n}', 'minify')
    expect(result).toEqual({ ok: true, output: '{"a":1,"b":[true,null]}' })
  })

  it('round-trips deeply nested structures unchanged', () => {
    const value = { a: { b: { c: [1, { d: 'x' }, [2, 3]] } } }
    const result = formatJson(JSON.stringify(value), 2)
    expect(result.ok).toBe(true)
    if (result.ok) expect(JSON.parse(result.output)).toEqual(value)
  })

  it('preserves unicode escapes in string values', () => {
    const result = formatJson('{"emoji":"\\u00e9\\u4e2d"}', 2)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toContain('"é中"')
  })

  it('reports empty input as an error rather than throwing', () => {
    expect(formatJson('', 2)).toEqual({
      ok: false,
      error: { message: 'Nothing to format — the input is empty.' }
    })
    expect(formatJson('   \n  ', 2).ok).toBe(false)
  })

  it('extracts line/column from an invalid token mid-document', () => {
    // V8 reports this failure at position 14 — line 4, column 1.
    const bad = '{\n"a": 1,\n"b"\n}'
    const result = formatJson(bad, 2)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.line).toBe(4)
      expect(result.error.column).toBe(1)
      expect(result.error.message).toMatch(/Expected ':' after property name/i)
    }
  })

  it('reports unterminated JSON without fabricating a position', () => {
    const result = formatJson('{"a": ', 2)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.line).toBeUndefined()
  })

  it('rejects top-level primitives that are not valid JSON documents', () => {
    const result = formatJson('hello world', 2)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toBeTruthy()
  })

  it('clamps absurd indent sizes instead of producing malformed output', () => {
    expect(formatJson('{"a":1}', 999)).toEqual({ ok: true, output: '{\n          "a": 1\n}' })
    expect(formatJson('{"a":1}', -3)).toEqual({ ok: true, output: '{"a":1}' })
  })
})

describe('validateJson', () => {
  it('accepts valid documents including scalars and arrays', () => {
    expect(validateJson('[]')).toEqual({ valid: true })
    expect(validateJson('"text"')).toEqual({ valid: true })
    expect(validateJson('42')).toEqual({ valid: true })
  })

  it('flags invalid input with line and column information', () => {
    // Missing ':' after "bad" fails at position 24 — line 3, column 9.
    const result = validateJson('{\n  "ok": true,\n  "bad" 42\n}')
    expect(result.valid).toBe(false)
    expect(result.error?.line).toBe(3)
    expect(result.error?.column).toBe(9)
    expect(result.error?.message).toMatch(/Expected ':' after property name/i)
  })

  it('treats whitespace-only input as invalid with guidance', () => {
    const result = validateJson(' \t ')
    expect(result.valid).toBe(false)
    expect(result.error?.message).toMatch(/empty/i)
  })
})

describe('positionToLineColumn', () => {
  it('counts newlines and columns from character offsets (1-based)', () => {
    expect(positionToLineColumn('abc', 0)).toEqual({ line: 1, column: 1 })
    expect(positionToLineColumn('a\nb\ncd', 4)).toEqual({ line: 3, column: 1 })
    expect(positionToLineColumn('a\nb\ncd', 5)).toEqual({ line: 3, column: 2 })
  })

  it('clamps out-of-range positions', () => {
    expect(positionToLineColumn('ab', 99)).toEqual({ line: 1, column: 3 })
    expect(positionToLineColumn('ab', -5)).toEqual({ line: 1, column: 1 })
  })
})
