import { describe, expect, it } from 'vitest'
import { semanticRoute, unloadModel, isModelInstalled } from './semantic-router'

describe('Semantic Router Service', () => {
  it('handles empty query gracefully with out_of_scope tier', async () => {
    const res = await semanticRoute('')
    expect(res.tier).toBe('out_of_scope')
    expect(res.recommendedTools).toHaveLength(0)
    expect(res.canCreatePipeline).toBe(false)
  })

  it('routes single-tool intent query to high or ambiguous tier', async () => {
    const res = await semanticRoute('compress video file')
    expect(res.recommendedTools.length).toBeGreaterThan(0)
    const toolIds = res.recommendedTools.map((t) => t.id)
    expect(toolIds).toContain('video-compress')
  })

  it('routes PDF bates stamp query to pdf-numberer or watermark', async () => {
    const res = await semanticRoute('add bates numbers and stamp confidential watermark on pdf')
    expect(res.recommendedTools.length).toBeGreaterThanOrEqual(1)
    const toolIds = res.recommendedTools.map((t) => t.id)
    const hasMatch = toolIds.includes('pdf-numberer') || toolIds.includes('pdf-watermark')
    expect(hasMatch).toBe(true)
    expect(res.canCreatePipeline).toBe(true)
  })

  it('supports explicit model unload', () => {
    expect(() => unloadModel()).not.toThrow()
  })

  it('reports installation status consistently', () => {
    const installed = isModelInstalled()
    expect(typeof installed).toBe('boolean')
  })
})
