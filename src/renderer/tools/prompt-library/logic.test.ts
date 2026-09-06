import { describe, expect, it } from 'vitest'
import { extractVariables, fillTemplate, parseLibraryImport, parseTagInput } from './logic'

describe('extractVariables', () => {
  it('finds unique variables in first-appearance order', () => {
    expect(extractVariables('Review {{lang}} code about {{topic}}, then rate {{lang}}.')).toEqual([
      'lang',
      'topic'
    ])
  })

  it('tolerates whitespace inside braces', () => {
    expect(extractVariables('{{  topic  }}')).toEqual(['topic'])
  })

  it('ignores malformed or empty tokens', () => {
    expect(extractVariables('{ not } {{ }} {{{a}}} {{b')).toEqual([])
  })

  it('returns empty for plain text', () => {
    expect(extractVariables('no variables here')).toEqual([])
  })
})

describe('fillTemplate', () => {
  const body = 'Summarize {{article}} for a {{audience}} audience.'

  it('substitutes every provided variable', () => {
    const out = fillTemplate(body, { article: 'the spec', audience: 'beginner' })
    expect(out).toEqual({ ok: true, output: 'Summarize the spec for a beginner audience.' })
  })

  it('fails listing nothing specific but keeps tokens when incomplete', () => {
    const out = fillTemplate(body, { article: 'the spec' })
    expect(out.ok).toBe(false)
    expect((out as { error: string }).error).toMatch(/every variable/)
  })

  it('rejects non-object values defensively', () => {
    expect(fillTemplate(body, null as never).ok).toBe(false)
  })
})

describe('parseTagInput', () => {
  it('splits, trims, lowercases and dedupes', () => {
    expect(parseTagInput('Writing, code review , CODE REVIEW,  blog ')).toEqual([
      'writing',
      'code review',
      'blog'
    ])
  })

  it('caps tag count at 12', () => {
    expect(parseTagInput(Array.from({ length: 20 }, (_, i) => `t${i}`).join(','))).toHaveLength(12)
  })
})

describe('parseLibraryImport', () => {
  const doc = JSON.stringify({
    prompts: [
      { title: 'Valid', body: 'Do {{thing}}.', tags: ['x'] },
      { title: '', body: 'missing title' },
      'junk',
      { title: 'No Tags', body: 'plain' }
    ]
  })

  it('accepts wrapped arrays, skipping invalid entries', () => {
    const out = parseLibraryImport(doc)
    expect(out.ok).toBe(true)
    expect(out.ok && out.value.prompts).toEqual([
      { title: 'Valid', body: 'Do {{thing}}.', tags: ['x'] },
      { title: 'No Tags', body: 'plain', tags: [] }
    ])
    expect(out.ok && out.value.skipped).toBe(2)
  })

  it('accepts bare arrays', () => {
    const out = parseLibraryImport('[{"title":"T","body":"B"}]')
    expect(out.ok && out.value.prompts).toEqual([{ title: 'T', body: 'B', tags: [] }])
  })

  it('rejects invalid JSON and wrong shapes', () => {
    expect(parseLibraryImport('{oops').ok).toBe(false)
    expect(parseLibraryImport('{"prompts": "nope"}').ok).toBe(false)
    expect(parseLibraryImport('"just a string"').ok).toBe(false)
  })
})

describe('PROMPT_PRESETS catalog integrity', () => {
  it('contains over 20 unique presets with valid categories and metadata', async () => {
    const { PROMPT_PRESETS, PRESET_CATEGORIES } = await import('./presets')
    expect(PROMPT_PRESETS.length).toBeGreaterThanOrEqual(20)

    const validCategoryIds = new Set(PRESET_CATEGORIES.map((c) => c.id))
    const seenIds = new Set<string>()

    for (const preset of PROMPT_PRESETS) {
      expect(seenIds.has(preset.id)).toBe(false)
      seenIds.add(preset.id)

      expect(preset.title.trim().length).toBeGreaterThan(3)
      expect(preset.description.trim().length).toBeGreaterThan(10)
      expect(preset.body.trim().length).toBeGreaterThan(20)
      expect(validCategoryIds.has(preset.category)).toBe(true)
      expect(preset.tags.length).toBeGreaterThan(0)

      // Variables extracted should be non-empty and properly formatted
      const vars = extractVariables(preset.body)
      expect(vars.length).toBeGreaterThan(0)
    }
  })
})
