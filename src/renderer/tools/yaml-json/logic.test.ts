import { describe, expect, it } from 'vitest'
import { jsonToYaml, yamlToJson } from './logic'

describe('yamlToJson', () => {
  it('converts nested maps and arrays', () => {
    const result = yamlToJson('name: stash\nitems:\n  - a\n  - b')
    expect(result).toEqual({
      ok: true,
      output: JSON.stringify({ name: 'stash', items: ['a', 'b'] }, null, 2)
    })
  })

  it('keeps quoted scalars as strings', () => {
    const result = yamlToJson("version: '1.0'")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(JSON.parse(result.output)).toEqual({ version: '1.0' })
    }
  })

  it('reports structured line/column for invalid YAML', () => {
    const result = yamlToJson('a: 1\n  bad: indent')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message.length).toBeGreaterThan(0)
      expect(typeof result.error.line).toBe('number')
      expect(typeof result.error.column).toBe('number')
    }
  })

  it('rejects empty input with an actionable message', () => {
    const result = yamlToJson('')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/empty/i)
  })
})

describe('jsonToYaml', () => {
  it('converts objects to two-space-indented YAML', () => {
    const result = jsonToYaml(JSON.stringify({ name: 'stash', items: ['a', 'b'] }))
    expect(result).toEqual({ ok: true, output: 'name: stash\nitems:\n  - a\n  - b\n' })
  })

  it('round-trips back through YAML → JSON losslessly', () => {
    const value = { deep: { list: [1, 'two', true] }, n: 42 }
    const first = jsonToYaml(JSON.stringify(value))
    expect(first.ok).toBe(true)
    if (first.ok) {
      const back = yamlToJson(first.output)
      expect(back.ok).toBe(true)
      if (back.ok) expect(JSON.parse(back.output)).toEqual(value)
    }
  })

  it('reports an error shape for invalid JSON', () => {
    const result = jsonToYaml('{broken')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message.length).toBeGreaterThan(0)
  })

  it('rejects empty input with an actionable message', () => {
    const result = jsonToYaml('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/empty/i)
  })
})
