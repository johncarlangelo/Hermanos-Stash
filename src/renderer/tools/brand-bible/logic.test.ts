import { describe, expect, it } from 'vitest'
import {
  buildMarkdown,
  DEFAULT_DRAFT,
  FONT_PAIRINGS,
  parseDraftJson,
  serializeDraft,
  typeScale,
  type BrandBibleDraft
} from './logic'

const FULL: BrandBibleDraft = {
  ...DEFAULT_DRAFT,
  brandName: 'Hermanos',
  tagline: 'Quietly capable tools.',
  description: 'A local-first utility suite.',
  primaryColor: '#2563eb',
  accentColor: '#f59e0b',
  neutralBase: '#1f2937',
  headingFont: 'georgia-verdana',
  bodyFont: 'segoe',
  baseSize: '16px',
  scaleRatio: '1.250',
  voiceWeAre: 'Precise\nWarm',
  voiceWeAreNot: 'Loud',
  voiceWeSoundLike: 'A trusted engineer',
  dos: 'Use the accent sparingly\nKeep contrast above AA',
  donts: 'Never stretch the logo',
  logoRules: 'Clear space: one logo-height on all sides.'
}

describe('buildMarkdown', () => {
  it('contains every section heading for a full draft', () => {
    const md = buildMarkdown(FULL)
    expect(md).toContain('# Hermanos')
    expect(md).toContain('> Quietly capable tools.')
    expect(md).toContain('## Colors')
    expect(md).toContain('## Typography')
    expect(md).toContain('## Voice')
    expect(md).toContain('## Usage')
  })

  it('includes hex values and computed contrast in the color table', () => {
    const md = buildMarkdown(FULL)
    expect(md).toContain('`#2563EB`')
    expect(md).toContain('`#F59E0B`')
    expect(md).toContain('`#1F2937`')
    expect(md).toMatch(/\| Primary \| `#2563EB` \| \d+\.\d{2}:1 \| (pass|fail) \|/)
  })

  it('renders typography pairing labels and a full type scale table', () => {
    const md = buildMarkdown(FULL)
    expect(md).toContain('- Headings: Georgia & Verdana')
    expect(md).toContain('- Body: Segoe UI Variable & Segoe UI')
    for (const label of ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl']) {
      expect(md).toContain(`| ${label} |`)
    }
    expect(md).toContain('| base | 16px (base) |')
  })

  it('lists voice and usage items line by line', () => {
    const md = buildMarkdown(FULL)
    expect(md).toContain('- Precise')
    expect(md).toContain('- Warm')
    expect(md).toContain('- Loud')
    expect(md).toContain('- Use the accent sparingly')
    expect(md).toContain('- Never stretch the logo')
    expect(md).toContain('Logo rules: Clear space: one logo-height on all sides.')
  })

  it('produces valid markdown for an empty draft', () => {
    const md = buildMarkdown(DEFAULT_DRAFT)
    expect(md.startsWith('# Brand Bible')).toBe(true)
    expect(md).toContain('## Colors')
    // Default colors are present even with no brand text.
    expect(md).toContain('`#2563EB`')
  })

  it('is deterministic', () => {
    expect(buildMarkdown(FULL)).toBe(buildMarkdown(FULL))
  })
})

describe('typeScale', () => {
  it('anchors base at the chosen size and grows monotonically', () => {
    const scale = typeScale('16px', 1.25)
    expect(scale.find((s) => s.label === 'base')?.sizePx).toBe(16)
    const sizes = scale.map((s) => s.sizePx)
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]!).toBeGreaterThan(sizes[i - 1]!)
    }
  })

  it('returns empty for unusable inputs', () => {
    expect(typeScale('nope', 1.25)).toEqual([])
    expect(typeScale('16px', NaN)).toEqual([])
  })
})

describe('autosave serialization round-trip', () => {
  it('serialize → parse returns an identical draft', () => {
    expect(parseDraftJson(serializeDraft(FULL))).toEqual(FULL)
    expect(parseDraftJson(serializeDraft(DEFAULT_DRAFT))).toEqual(DEFAULT_DRAFT)
  })

  it('merges partial saved drafts over defaults and rejects junk', () => {
    const partial = JSON.stringify({ version: 1, draft: { brandName: 'Only name' } })
    const parsed = parseDraftJson(partial)
    expect(parsed?.brandName).toBe('Only name')
    expect(parsed?.primaryColor).toBe(DEFAULT_DRAFT.primaryColor)
    expect(parseDraftJson('{oops')).toBeNull()
    expect(parseDraftJson(JSON.stringify({ version: 1 }))).toBeNull()
    expect(parseDraftJson(null)).toBeNull()
  })
})

describe('FONT_PAIRINGS', () => {
  it('offers at least a dozen unique, self-consistent pairings', () => {
    expect(FONT_PAIRINGS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(FONT_PAIRINGS.map((p) => p.id)).size).toBe(FONT_PAIRINGS.length)
    for (const pairing of FONT_PAIRINGS) {
      expect(pairing.label).toBeTruthy()
      expect(pairing.headingStack).toBeTruthy()
      expect(pairing.bodyStack).toBeTruthy()
    }
  })

  it('uses ids referenced by DEFAULT_DRAFT', () => {
    const ids = new Set(FONT_PAIRINGS.map((p) => p.id))
    expect(ids.has(DEFAULT_DRAFT.headingFont)).toBe(true)
    expect(ids.has(DEFAULT_DRAFT.bodyFont)).toBe(true)
  })
})
