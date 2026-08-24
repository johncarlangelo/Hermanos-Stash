import { describe, expect, it } from 'vitest'
import { generateTypes, sanitizeTypeName } from './logic'

describe('generateTypes', () => {
  it('generates an interface for a flat object', () => {
    const result = generateTypes('{"name":"Ana","age":31,"active":true,"note":null}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output).toBe(
        [
          'export interface Root {',
          '  name: string',
          '  age: number',
          '  active: boolean',
          '  note: null',
          '}'
        ].join('\n')
      )
    }
  })

  it('names nested objects after their parent key, three levels deep', () => {
    const result = generateTypes('{"a":{"b":{"c":1}}}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output).toBe(
        [
          'export interface Root {',
          '  a: RootA',
          '}',
          '',
          'export interface RootA {',
          '  b: RootAB',
          '}',
          '',
          'export interface RootAB {',
          '  c: number',
          '}'
        ].join('\n')
      )
    }
  })

  it('marks keys missing from some array siblings as optional when enabled', () => {
    const json = '[{"id":1},{"id":2,"extra":"x"}]'
    const on = generateTypes(json, { optionalFields: true })
    expect(on.ok).toBe(true)
    if (on.ok) {
      expect(on.output).toContain('export interface RootItem {')
      expect(on.output).toContain('extra?: string')
      expect(on.output).toContain('id: number')
      expect(on.output).toMatch(/export type Root = RootItem\[\]$/)
    }
    const off = generateTypes(json)
    expect(off.ok).toBe(true)
    if (off.ok) {
      expect(off.output).not.toContain('?')
      expect(off.output).toContain('extra: string')
    }
  })

  it('collapses short uniform string arrays into a literal union', () => {
    const result = generateTypes('{"status":["a","b"]}')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toContain('status: "a" | "b"')
  })

  it('falls back to string[] beyond five distinct values', () => {
    const result = generateTypes('{"tags":["a","b","c","d","e","f"]}')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toContain('tags: string[]')
  })

  it('unions mixed primitive arrays and wraps them in parens', () => {
    const result = generateTypes('{"mixed":[1,"two",true]}')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toContain('mixed: (number | string | boolean)[]')
  })

  it('maps empty objects and empty arrays to never/unknown containers', () => {
    const result = generateTypes('{}')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toBe('export type Root = Record<string, never>')

    const emptyArray = generateTypes('[]')
    expect(emptyArray.ok).toBe(true)
    if (emptyArray.ok) expect(emptyArray.output).toBe('export type Root = unknown[]')
  })

  it('propagates the root name to every generated declaration', () => {
    const result = generateTypes('{"user":{"prefs":{"dark":true}}}', { rootName: 'AppConfig' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output).toContain('export interface AppConfig {')
      expect(result.output).toContain('user: AppConfigUser')
      expect(result.output).toContain('export interface AppConfigUserPrefs {')
      expect(result.output).not.toContain('Root')
    }
  })

  it('reports invalid JSON with message, line and column', () => {
    // Fails at position 14 — line 4, column 1 (same fixture as json-format).
    const bad = '{\n"a": 1,\n"b"\n}'
    const result = generateTypes(bad)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.line).toBe(4)
      expect(result.error.column).toBe(1)
      expect(result.error.message).toMatch(/Expected ':' after property name/i)
    }
  })

  it('reports empty input without throwing', () => {
    const result = generateTypes('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/empty/i)
  })

  it('accepts reserved-word keys like class without breaking output', () => {
    const result = generateTypes('{"class":"warrior","kind":{"class":"mage"}}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Property names keep the original key; only type identifiers escape.
      expect(result.output).toContain('class: string')
      expect(result.output).toContain('export interface RootKind {')
      expect(result.output).toContain('class: string')
    }
  })

  it('deduplicates colliding generated interface names with numeric suffixes', () => {
    // Keys "shape" and "Shape" both normalize to the same child identifier.
    const result = generateTypes('{"shape":{"deep":{"n":1}},"Shape":{"deep":{"m":2}}}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.output.match(/export interface RootShape \{/g)).toHaveLength(1)
      expect(result.output.match(/export interface RootShape2 \{/g)).toHaveLength(1)
      expect(result.output.match(/export interface RootShapeDeep \{/g)).toHaveLength(1)
      expect(result.output.match(/export interface RootShape2Deep \{/g)).toHaveLength(1)
      // The colliding branch references the suffixed name, not the original.
      expect(result.output).toContain('Shape: RootShape2')
      expect(result.output).toContain('deep: RootShape2Deep')
    }
  })

  it('emits type aliases instead of interfaces when requested', () => {
    const result = generateTypes('{"a":1}', { exportStyle: 'type' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.output).toBe('export type Root = {\n  a: number\n}')
  })
})

describe('sanitizeTypeName', () => {
  it('strips characters that are invalid in identifiers', () => {
    expect(sanitizeTypeName('my-type name!')).toBe('mytypename')
  })

  it('prefixes a leading digit with an underscore', () => {
    expect(sanitizeTypeName('42answer')).toBe('_42answer')
  })

  it('escapes reserved words with a trailing underscore', () => {
    expect(sanitizeTypeName('class')).toBe('class_')
    expect(sanitizeTypeName('interface')).toBe('interface_')
  })

  it('never returns an empty string', () => {
    expect(sanitizeTypeName('!!!')).toBe('_')
    expect(sanitizeTypeName('')).toBe('_')
  })
})
