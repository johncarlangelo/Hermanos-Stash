import { describe, expect, it } from 'vitest'
import { CATEGORIES, getCategory, isValidCategory } from './categories'
import type { ToolDefinition } from '../types/tool'
import { fuzzyMatchScore, scoreTool, ToolRegistry } from '../tool-registry/registry'

function def(
  overrides: Partial<ToolDefinition> & Pick<ToolDefinition, 'id' | 'name'>
): ToolDefinition {
  return {
    category: 'text',
    description: 'A test utility.',
    tags: [],
    icon: 'braces',
    version: '1.0.0',
    capabilities: {},
    ...overrides
  }
}

const jsonTool = def({
  id: 'json-format',
  name: 'JSON Formatter',
  description: 'Format, validate, and minify JSON.',
  tags: ['json', 'pretty', 'minify', 'validator']
})

const pdfTool = def({
  id: 'pdf-merge',
  name: 'Merge PDF',
  description: 'Combine multiple PDF files into one document.',
  tags: ['pdf', 'combine', 'documents'],
  category: 'documents'
})

describe('fuzzyMatchScore', () => {
  it('ranks prefix matches highest', () => {
    const prefix = fuzzyMatchScore('jso', 'JSON Formatter')
    const mid = fuzzyMatchScore('son', 'JSON Formatter')
    expect(prefix).toBeGreaterThan(mid!)
  })

  it('rewards word-boundary hits over mid-word hits', () => {
    expect(fuzzyMatchScore('pdf', 'Merge PDF')).toBeGreaterThan(fuzzyMatchScore('df', 'Merge PDF')!)
  })

  it('returns null for non-matches and low-but-nonzero for subsequences', () => {
    expect(fuzzyMatchScore('xyz', 'Merge PDF')).toBeNull()
    expect(fuzzyMatchScore('mgp', 'Merge PDF')).toBeGreaterThan(0)
  })
})

describe('scoreTool', () => {
  it('requires every token to match (AND semantics)', () => {
    expect(scoreTool(jsonTool, 'json format')).not.toBeNull()
    expect(scoreTool(jsonTool, 'json video')).toBeNull()
  })

  it('weights name matches above description matches', () => {
    const nameHit = scoreTool(jsonTool, 'formatter')
    const descOnly = scoreTool(
      def({ id: 'x-y', name: 'X Y', description: 'a formatter here' }),
      'formatter'
    )
    expect(nameHit!).toBeGreaterThan(descOnly!)
  })

  it('matches by category label', () => {
    expect(scoreTool(pdfTool, 'documents')).not.toBeNull()
  })
})

describe('ToolRegistry', () => {
  it('registers and retrieves tools, rejecting duplicates and invalid ids', () => {
    const registry = new ToolRegistry()
    registry.register(jsonTool)
    registry.register(pdfTool)
    expect(registry.get('json-format')?.name).toBe('JSON Formatter')
    expect(() => registry.register(jsonTool)).toThrow(/already registered/)
    expect(() => registry.register(def({ id: 'Bad Id!', name: 'Bad' }))).toThrow(/kebab-case/)
    expect(() =>
      registry.register({ ...jsonTool, id: 'ok-id', category: 'nope' as never })
    ).toThrow(/unknown category/)
  })

  it('sorts all() by category order then name', () => {
    const registry = new ToolRegistry()
    registry.register(pdfTool)
    registry.register(jsonTool)
    registry.register(def({ id: 'b64-codec', name: 'Base64 Codec' }))
    const ids = registry.all().map((t) => t.id)
    // documents comes before text in CATEGORIES order; alphabetical within.
    expect(ids.indexOf('pdf-merge')).toBeLessThan(ids.indexOf('b64-codec'))
    expect(ids.indexOf('b64-codec')).toBeLessThan(ids.indexOf('json-format'))
  })

  it('filters by category and exact tag (case-insensitive)', () => {
    const registry = new ToolRegistry()
    registry.register(jsonTool)
    registry.register(pdfTool)
    expect(registry.byCategory('documents')).toHaveLength(1)
    expect(registry.byTag('PDF').map((t) => t.id)).toEqual(['pdf-merge'])
    expect(registry.byTag('missing')).toHaveLength(0)
    expect(registry.byTag('   ')).toHaveLength(0)
  })

  it('searches across name, tags, category and description with ranking', () => {
    const registry = new ToolRegistry()
    registry.register(jsonTool)
    registry.register(pdfTool)
    expect(registry.search('').map((m) => m.tool.id)).toEqual([])
    expect(registry.search('zzz-no-match')).toEqual([])
    expect(registry.search('pretty')[0].tool.id).toBe('json-format')
    expect(registry.search('merge')[0].tool.id).toBe('pdf-merge')
  })

  it('reports categories with counts in canonical order', () => {
    const registry = new ToolRegistry()
    registry.register(jsonTool)
    registry.register(pdfTool)
    const cats = registry.categoriesWithCounts()
    expect(cats.map((c) => c.id)).toEqual(CATEGORIES.map((c) => c.id))
    expect(cats.find((c) => c.id === 'text')?.count).toBe(1)
    expect(cats.find((c) => c.id === 'video')?.count).toBe(0)
  })

  it('validates required metadata fields', () => {
    const registry = new ToolRegistry()
    expect(() => registry.register(def({ id: 'x', name: '', description: '' }))).toThrow(/"name"/)
    expect(() => registry.register({ ...jsonTool, id: 'v-bad', version: 'one' })).toThrow(/version/)
  })

  it('exposes a valid category guard', () => {
    expect(isValidCategory('text')).toBe(true)
    expect(isValidCategory('nope')).toBe(false)
    expect(getCategory('files')?.label).toBe('Files & Archives')
  })
})
