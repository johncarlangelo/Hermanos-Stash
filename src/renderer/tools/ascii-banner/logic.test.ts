import { describe, expect, it } from 'vitest'
import { generateAsciiBanner, renderRawBanner, frameBanner, DEFAULT_BANNER_OPTIONS } from './logic'

describe('ascii-banner logic', () => {
  it('returns empty string for empty input', () => {
    expect(generateAsciiBanner('', DEFAULT_BANNER_OPTIONS)).toBe('')
    expect(generateAsciiBanner('   ', DEFAULT_BANNER_OPTIONS)).toBe('')
  })

  it('renders raw letters in standard font', () => {
    const lines = renderRawBanner('HI', 'standard')
    expect(lines.length).toBe(6)
    expect(lines[0]).toContain('██')
  })

  it('renders raw letters in slant font', () => {
    const lines = renderRawBanner('DEV', 'slant')
    expect(lines.length).toBe(5)
  })

  it('renders raw letters in block font', () => {
    const lines = renderRawBanner('OK', 'block')
    expect(lines.length).toBe(3)
  })

  it('frames banner with single border', () => {
    const banner = generateAsciiBanner('A', {
      ...DEFAULT_BANNER_OPTIONS,
      border: 'single'
    })
    expect(banner.startsWith('┌')).toBe(true)
    expect(banner.endsWith('┘')).toBe(true)
    expect(banner).toContain('│')
  })

  it('frames banner with double border', () => {
    const banner = generateAsciiBanner('B', {
      ...DEFAULT_BANNER_OPTIONS,
      border: 'double'
    })
    expect(banner.startsWith('╔')).toBe(true)
    expect(banner.endsWith('╝')).toBe(true)
    expect(banner).toContain('║')
  })

  it('frames banner with no border', () => {
    const banner = generateAsciiBanner('C', {
      ...DEFAULT_BANNER_OPTIONS,
      border: 'none'
    })
    expect(banner).not.toContain('┌')
    expect(banner).not.toContain('★')
    expect(banner).not.toContain('#')
  })

  it('handles multi-line text', () => {
    const full = generateAsciiBanner('HERMANOS', {
      ...DEFAULT_BANNER_OPTIONS,
      border: 'double'
    })
    expect(full).toContain('╔')
    expect(full).toContain('╝')
  })

  it('frames lines with unicode borders', () => {
    const framed = frameBanner(['HELLO'], {
      ...DEFAULT_BANNER_OPTIONS,
      border: 'single'
    })
    expect(framed).toContain('┌')
    expect(framed).toContain('└')
  })
})
