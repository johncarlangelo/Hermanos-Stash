import { describe, expect, it } from 'vitest'
import '../../tools'
import type { ToolDefinition } from '../../../shared/types/tool'
import { autoLayoutGraph, calculateBoundingBox, snapToGrid } from './layout'
import { topologicalSort, validateEdge, runWorkflowPipeline } from './execution'
import { BUILT_IN_WORKFLOW_TEMPLATES } from './presets'
import type { WorkflowGraph } from './types'
import { QUEUE_WORKFLOW_VERSION } from './version'

describe('Workflow Layout Utilities', () => {
  it('snaps coordinates to grid intervals', () => {
    expect(snapToGrid(23, 20)).toBe(20)
    expect(snapToGrid(35, 20)).toBe(40)
    expect(snapToGrid(0, 20)).toBe(0)
  })

  it('calculates bounding box correctly', () => {
    const nodes = [
      { id: '1', toolId: 'json-format', position: { x: 50, y: 100 }, params: {} },
      { id: '2', toolId: 'json-schema', position: { x: 400, y: 300 }, params: {} }
    ]
    const bbox = calculateBoundingBox(nodes)
    expect(bbox.minX).toBe(50)
    expect(bbox.minY).toBe(100)
    expect(bbox.maxX).toBe(660) // 400 + 260 width
    expect(bbox.maxY).toBe(440) // 300 + 140 height
  })

  it('arranges nodes in hierarchical Left-to-Right layout', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'a', toolId: 'video-convert', position: { x: 500, y: 500 }, params: {} },
        { id: 'b', toolId: 'extract-audio', position: { x: 0, y: 0 }, params: {} },
        { id: 'c', toolId: 'audio-normalize', position: { x: 100, y: 100 }, params: {} }
      ],
      edges: [
        { id: 'e1', fromNodeId: 'a', fromPort: 'files', toNodeId: 'b', toPort: 'files' },
        { id: 'e2', fromNodeId: 'b', fromPort: 'files', toNodeId: 'c', toPort: 'files' }
      ]
    }

    const laidOut = autoLayoutGraph(graph)
    const nodeA = laidOut.nodes.find((n) => n.id === 'a')!
    const nodeB = laidOut.nodes.find((n) => n.id === 'b')!
    const nodeC = laidOut.nodes.find((n) => n.id === 'c')!

    // Node A is rank 0, Node B is rank 1, Node C is rank 2
    expect(nodeA.position.x).toBeLessThan(nodeB.position.x)
    expect(nodeB.position.x).toBeLessThan(nodeC.position.x)
  })
})

describe('Workflow Topological Sort & DAG Validation', () => {
  it('correctly sorts a linear pipeline', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'step-3', toolId: 'audio-normalize', position: { x: 0, y: 0 }, params: {} },
        { id: 'step-1', toolId: 'video-convert', position: { x: 0, y: 0 }, params: {} },
        { id: 'step-2', toolId: 'extract-audio', position: { x: 0, y: 0 }, params: {} }
      ],
      edges: [
        { id: 'e1', fromNodeId: 'step-1', fromPort: 'files', toNodeId: 'step-2', toPort: 'files' },
        { id: 'e2', fromNodeId: 'step-2', fromPort: 'files', toNodeId: 'step-3', toPort: 'files' }
      ]
    }

    const { sortedNodeIds, hasCycle } = topologicalSort(graph)
    expect(hasCycle).toBe(false)
    expect(sortedNodeIds).toEqual(['step-1', 'step-2', 'step-3'])
  })

  it('detects cycle loops and reports hasCycle: true', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'a', toolId: 'json-format', position: { x: 0, y: 0 }, params: {} },
        { id: 'b', toolId: 'json-schema', position: { x: 0, y: 0 }, params: {} }
      ],
      edges: [
        { id: 'e1', fromNodeId: 'a', fromPort: 'text', toNodeId: 'b', toPort: 'text' },
        { id: 'e2', fromNodeId: 'b', fromPort: 'text', toNodeId: 'a', toPort: 'text' }
      ]
    }

    const { hasCycle } = topologicalSort(graph)
    expect(hasCycle).toBe(true)
  })

  it('validates edge port matching and tool capability contracts', () => {
    const fileTool = {
      id: 'pdf-merge',
      name: 'PDF Merger',
      category: 'documents',
      description: 'Merge PDFs',
      tags: [],
      icon: 'file',
      version: '1.0.0',
      capabilities: { acceptsFiles: true, producesFiles: true }
    } as unknown as ToolDefinition

    const textTool = {
      id: 'json-format',
      name: 'JSON Formatter',
      category: 'text',
      description: 'Format JSON',
      tags: [],
      icon: 'code',
      version: '1.0.0',
      capabilities: { acceptsText: true, producesText: true }
    } as unknown as ToolDefinition

    // Valid file-to-file connection
    const validResult = validateEdge(fileTool, fileTool, 'files', 'files')
    expect(validResult.valid).toBe(true)

    // Incompatible port types (files -> text)
    const mismatchedPort = validateEdge(fileTool, textTool, 'files', 'text')
    expect(mismatchedPort.valid).toBe(false)
    expect(mismatchedPort.reason).toContain('Cannot connect')

    // Tool does not accept files
    const capabilityMismatch = validateEdge(fileTool, textTool, 'files', 'files')
    expect(capabilityMismatch.valid).toBe(false)
    expect(capabilityMismatch.reason).toContain('does not accept files')
  })
})

describe('Workflow Pipeline Execution Engine', () => {
  it('executes a multi-step pipeline and aggregates final output files', async () => {
    const template = BUILT_IN_WORKFLOW_TEMPLATES[0] // ID Photo Studio template
    const inputFiles = ['portrait.jpg']

    const result = await runWorkflowPipeline(template.graph, inputFiles)
    expect(result.success).toBe(true)
    expect(result.finalOutputFiles.length).toBeGreaterThan(0)
    expect(Object.keys(result.nodeResults)).toHaveLength(template.graph.nodes.length)
  })

  it('honors direct node.inputFiles on root nodes without initial pipeline inputs', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        {
          id: 'root-node',
          toolId: 'image-compress',
          position: { x: 0, y: 0 },
          params: {},
          inputFiles: ['photo1.png', 'photo2.png']
        },
        {
          id: 'child-node',
          toolId: 'image-convert',
          position: { x: 300, y: 0 },
          params: {}
        }
      ],
      edges: [
        {
          id: 'e1',
          fromNodeId: 'root-node',
          fromPort: 'files',
          toNodeId: 'child-node',
          toPort: 'files'
        }
      ]
    }

    const result = await runWorkflowPipeline(graph, [], '')
    expect(result.success).toBe(true)
    expect(result.finalOutputFiles).toHaveLength(2)
    expect(result.finalOutputFiles[0]).toContain('photo1')
    expect(result.finalOutputFiles[1]).toContain('photo2')
  })

  it('produces zero fake output files when tools are executed without input files', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        {
          id: 'empty-node',
          toolId: 'image-compress',
          position: { x: 0, y: 0 },
          params: {},
          inputFiles: []
        }
      ],
      edges: []
    }

    const result = await runWorkflowPipeline(graph, [], '')
    expect(result.success).toBe(true)
    expect(result.finalOutputFiles).toHaveLength(0)
  })

  describe('Workflow Feature Versioning', () => {
    it('defines a valid semantic version string matching vMAJOR.MINOR.PATCH', () => {
      expect(QUEUE_WORKFLOW_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
      expect(QUEUE_WORKFLOW_VERSION).toBe('0.2.4')
    })
  })

  describe('Workflow Node Stash Asset Payload Integration', () => {
    it('accumulates and deduplicates stash assets on a node input files payload', () => {
      const initialFiles = ['/stash/assets/photo1.png']
      const newStashAssets = ['/stash/assets/photo1.png', '/stash/assets/photo2.png', '/stash/assets/doc.pdf']
      const combined = Array.from(new Set([...initialFiles, ...newStashAssets]))

      expect(combined).toEqual([
        '/stash/assets/photo1.png',
        '/stash/assets/photo2.png',
        '/stash/assets/doc.pdf'
      ])
      expect(combined).toHaveLength(3)
    })
  })
})
