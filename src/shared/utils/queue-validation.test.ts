import { describe, it, expect } from 'vitest'
import {
  validateQueueChain,
  getCompatibleNextTools,
  getCompatiblePreviousTools
} from './queue-validation'
import type { ToolDefinition } from '../../shared/types/tool'

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    id: overrides.id ?? 'test',
    name: overrides.name ?? 'Test Tool',
    category: overrides.category ?? 'text',
    description: overrides.description ?? '',
    tags: overrides.tags ?? [],
    icon: overrides.icon ?? 'file',
    version: '1.0.0',
    capabilities: {
      acceptsFiles: false,
      acceptsMultipleFiles: false,
      acceptsText: false,
      producesFiles: false,
      producesText: false,
      supportsProgress: false,
      supportsCancellation: false,
      supportsBatch: false,
      ...overrides.capabilities
    }
  }
}

describe('validateQueueChain', () => {
  it('passes for empty chain', () => {
    const result = validateQueueChain([])
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('passes for single tool', () => {
    const result = validateQueueChain([makeTool({ id: 'a' })])
    expect(result.valid).toBe(true)
  })

  it('passes for compatible file chain', () => {
    const producer = makeTool({ id: 'producer', capabilities: { producesFiles: true } })
    const consumer = makeTool({ id: 'consumer', capabilities: { acceptsFiles: true } })
    const result = validateQueueChain([producer, consumer])
    expect(result.valid).toBe(true)
  })

  it('fails when consumer needs files but producer does not produce', () => {
    const noFiles = makeTool({ id: 'no-files' })
    const consumer = makeTool({ id: 'consumer', capabilities: { acceptsFiles: true } })
    const result = validateQueueChain([noFiles, consumer])
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('requires files')
  })

  it('fails when consumer needs text but producer does not produce', () => {
    const noText = makeTool({ id: 'no-text' })
    const consumer = makeTool({ id: 'consumer', capabilities: { acceptsText: true } })
    const result = validateQueueChain([noText, consumer])
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('requires text')
  })

  it('passes for compatible text chain', () => {
    const producer = makeTool({ id: 'producer', capabilities: { producesText: true } })
    const consumer = makeTool({ id: 'consumer', capabilities: { acceptsText: true } })
    const result = validateQueueChain([producer, consumer])
    expect(result.valid).toBe(true)
  })

  it('warns when chain consumes files but nothing produces', () => {
    const consumer = makeTool({ id: 'consumer', capabilities: { acceptsFiles: true } })
    const result = validateQueueChain([consumer])
    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].message).toContain('consumes files')
  })

  it('warns when chain consumes text but nothing produces', () => {
    const consumer = makeTool({ id: 'consumer', capabilities: { acceptsText: true } })
    const result = validateQueueChain([consumer])
    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].message).toContain('consumes text')
  })

  it('three-step chain validates each link', () => {
    const a = makeTool({ id: 'a', capabilities: { producesFiles: true } })
    const b = makeTool({ id: 'b', capabilities: { acceptsFiles: true, producesText: true } })
    const c = makeTool({ id: 'c', capabilities: { acceptsText: true } })
    const result = validateQueueChain([a, b, c])
    expect(result.valid).toBe(true)
  })

  it('three-step chain fails at second link', () => {
    const a = makeTool({ id: 'a', capabilities: { producesFiles: true } })
    const b = makeTool({ id: 'b', capabilities: { acceptsFiles: true } }) // no output
    const c = makeTool({ id: 'c', capabilities: { acceptsText: true } })
    const result = validateQueueChain([a, b, c])
    expect(result.valid).toBe(false)
    expect(result.errors[0].toolId).toBe('c')
  })
})

describe('getCompatibleNextTools', () => {
  const producer = makeTool({
    id: 'producer',
    capabilities: { producesFiles: true, producesText: true }
  })
  const fileConsumer = makeTool({ id: 'file-consumer', capabilities: { acceptsFiles: true } })
  const textConsumer = makeTool({ id: 'text-consumer', capabilities: { acceptsText: true } })
  const neither = makeTool({ id: 'neither' })

  it('returns tools that can follow the producer', () => {
    const result = getCompatibleNextTools(producer, [fileConsumer, textConsumer, neither])
    expect(result.map((t) => t.id)).toEqual(['file-consumer', 'text-consumer'])
  })

  it('excludes tools that cannot follow', () => {
    const result = getCompatibleNextTools(neither, [fileConsumer, textConsumer])
    expect(result).toHaveLength(0)
  })
})

describe('getCompatiblePreviousTools', () => {
  const fileProducer = makeTool({ id: 'file-producer', capabilities: { producesFiles: true } })
  const textProducer = makeTool({ id: 'text-producer', capabilities: { producesText: true } })
  const neither = makeTool({ id: 'neither' })
  const consumer = makeTool({
    id: 'consumer',
    capabilities: { acceptsFiles: true, acceptsText: true }
  })

  it('returns tools that can precede the consumer', () => {
    const result = getCompatiblePreviousTools(consumer, [fileProducer, textProducer, neither])
    expect(result.map((t) => t.id)).toEqual(['file-producer', 'text-producer'])
  })
})
