import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GRADIENT,
  generateCssGradient,
  generateSvgGradient,
  PRESET_GRADIENTS
} from './logic'

describe('gradient-studio logic', () => {
  it('generates valid CSS linear gradient syntax', () => {
    const css = generateCssGradient(DEFAULT_GRADIENT)
    expect(css).toContain('linear-gradient(135deg,')
    expect(css).toContain('#f59e0b 0%')
    expect(css).toContain('#8b5cf6 100%')
  })

  it('generates valid CSS radial gradient syntax', () => {
    const radialPreset = PRESET_GRADIENTS.find((p) => p.config.type === 'radial')!
    const css = generateCssGradient(radialPreset.config)
    expect(css).toContain('radial-gradient(')
  })

  it('generates valid SVG gradient markup', () => {
    const svg = generateSvgGradient(DEFAULT_GRADIENT, 'testGrad')
    expect(svg).toContain('<linearGradient id="testGrad"')
    expect(svg).toContain('stop-color="#f59e0b"')
    expect(svg).toContain('fill="url(#testGrad)"')
  })
})
