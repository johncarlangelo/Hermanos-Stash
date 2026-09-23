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

  it('handles greeting queries with friendly copilot introduction', async () => {
    const res = await semanticRoute('hello')
    expect(res.tier).toBe('out_of_scope')
    expect(res.recommendedTools).toHaveLength(0)
    expect(res.explanation).toContain("Hey there! 👋 I'm Hermano")
  })

  it('handles test/system-check queries with helpful guidance', async () => {
    const res = await semanticRoute('test')
    expect(res.tier).toBe('out_of_scope')
    expect(res.recommendedTools).toHaveLength(0)
    expect(res.explanation).toContain('All systems go! ⚡')
  })

  it('handles gibberish and keyboard mash queries with catch-that message', async () => {
    const res = await semanticRoute('dfsdagfdg')
    expect(res.tier).toBe('out_of_scope')
    expect(res.recommendedTools).toHaveLength(0)
    expect(res.explanation).toContain("I didn't quite catch that!")
  })

  it('supports explicit model unload', () => {
    expect(() => unloadModel()).not.toThrow()
  })

  it('reports installation status consistently', () => {
    const installed = isModelInstalled()
    expect(typeof installed).toBe('boolean')
  })

  it('routes format-specific queries to high confidence without false ambiguity', async () => {
    const pngJpg = await semanticRoute('i want to convert my png to jpg')
    expect(pngJpg.tier).toBe('high')
    expect(pngJpg.recommendedTools[0]?.id).toBe('image-convert')

    const mp4Webm = await semanticRoute('convert mp4 to webm')
    expect(mp4Webm.tier).toBe('high')
    expect(mp4Webm.recommendedTools[0]?.id).toBe('video-convert')

    const pdfCompress = await semanticRoute('compress this pdf document')
    expect(pdfCompress.tier).toBe('high')
    expect(pdfCompress.recommendedTools[0]?.id).toBe('pdf-compress')
  })

  it('routes broad verb queries without domains to ambiguity clusters', async () => {
    const compressBroad = await semanticRoute('make my file smaller')
    expect(compressBroad.tier).toBe('ambiguous')
    expect(compressBroad.clarifyingQuestion).toContain('compress a PDF document, an image, a video clip')

    const watermarkBroad = await semanticRoute('watermark')
    expect(watermarkBroad.tier).toBe('ambiguous')
    expect(watermarkBroad.clarifyingQuestion).toContain('watermark to images, stamping a confidential notice')
  })

  it('detects multi-step composite pipelines for chained operations', async () => {
    const pipeline = await semanticRoute('split pdf and compress each page')
    expect(pipeline.canCreatePipeline).toBe(true)
    const toolIds = pipeline.recommendedTools.map((t) => t.id)
    expect(toolIds).toContain('pdf-split')
    expect(toolIds).toContain('pdf-compress')
  })

  it('maintains 100% parity across tool registry, routing spec, and precomputed embeddings', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const { toolRegistry } = await import('../../shared/tool-registry/registry')
    // Trigger tool registration if needed
    await import('../../renderer/tools')

    const allRegisteredTools = toolRegistry.all()
    expect(allRegisteredTools.length).toBeGreaterThanOrEqual(78)

    const routingPath = path.resolve('TOOL_ROUTING.md')
    const routingContent = fs.readFileSync(routingPath, 'utf8')
    const embeddingsPath = path.resolve('src/shared/assets/tool-embeddings.json')
    const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf8'))

    for (const tool of allRegisteredTools) {
      // 1. Must be documented in TOOL_ROUTING.md
      const hasDoc = routingContent.includes(`#### \`${tool.id}\``)
      expect(hasDoc, `Tool ${tool.id} must be documented in TOOL_ROUTING.md`).toBe(true)

      // 2. Must be embedded in tool-embeddings.json
      const emb = embeddings[tool.id]
      expect(emb, `Tool ${tool.id} must have precomputed vector in tool-embeddings.json`).toBeDefined()
      expect(emb.vector).toHaveLength(384)
    }
  })
})
