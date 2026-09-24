import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import '../../tools'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../../shared/types/tool'
import type { StashBridge } from '../../../shared/ipc'
import { autoLayoutGraph, calculateBoundingBox, snapToGrid } from './layout'
import {
  areFileCategoriesCompatible,
  executeStep,
  runWorkflowPipeline,
  setCustomStepExecutor,
  topologicalSort,
  validateEdge,
  wouldCreateCycle
} from './execution'

import { BUILT_IN_WORKFLOW_TEMPLATES } from './presets'
import type { WorkflowGraph } from './types'
import { QUEUE_WORKFLOW_VERSION } from './version'
import { AUDIT_ROWS, expectedAuditPorts } from './compatibility-audit'
import { getToolParamFields, resolveParamValue } from './tool-params'

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

  it('detects wouldCreateCycle on direct and transitive circular connections', () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'node-a', toolId: 'image-compress', position: { x: 0, y: 0 }, params: {} },
        { id: 'node-b', toolId: 'image-convert', position: { x: 0, y: 0 }, params: {} },
        { id: 'node-c', toolId: 'image-resize', position: { x: 0, y: 0 }, params: {} }
      ],
      edges: [
        { id: 'e1', fromNodeId: 'node-a', fromPort: 'files', toNodeId: 'node-b', toPort: 'files' },
        { id: 'e2', fromNodeId: 'node-b', fromPort: 'files', toNodeId: 'node-c', toPort: 'files' }
      ]
    }

    // Direct self loop
    expect(wouldCreateCycle(graph, 'node-a', 'node-a')).toBe(true)

    // Direct reverse connection (b -> a when a -> b exists)
    expect(wouldCreateCycle(graph, 'node-b', 'node-a')).toBe(true)

    // Transitive reverse connection (c -> a when a -> b -> c exists)
    expect(wouldCreateCycle(graph, 'node-c', 'node-a')).toBe(true)

    // Valid forward connection (a -> c)
    expect(wouldCreateCycle(graph, 'node-a', 'node-c')).toBe(false)
  })

  it('validates directional domains using real catalog definitions', () => {
    const tool = (id: string) => toolRegistry.get(id)!
    expect(
      areFileCategoriesCompatible(tool('image-compress'), tool('hash-generator')).compatible
    ).toBe(true)
    for (const [a, b] of [
      ['image-compress', 'audio-normalize'],
      ['audio-normalize', 'image-compress'],
      ['audio-normalize', 'pdf-merge']
    ]) {
      const result = areFileCategoriesCompatible(tool(a), tool(b))
      expect(result.compatible).toBe(false)
      expect(result.reason).toContain(tool(a).name)
      expect(result.reason).toContain(tool(b).name)
    }
  })
})

describe('Workflow Pipeline Execution Engine', () => {
  it('rejects a legacy graph containing mixed-output wires before starting any node', async () => {
    const legacyGraph: WorkflowGraph = {
      nodes: [
        { id: 'node-1', toolId: 'id-photo-maker', position: { x: 0, y: 0 }, params: {} },
        { id: 'node-2', toolId: 'image-watermark', position: { x: 200, y: 0 }, params: {} }
      ],
      edges: [
        { id: 'e1', fromNodeId: 'node-1', fromPort: 'files', toNodeId: 'node-2', toPort: 'files' }
      ]
    }
    const started: string[] = []
    await expect(
      runWorkflowPipeline(legacyGraph, ['portrait.jpg'], '', {
        onNodeStart: (id) => started.push(id)
      })
    ).rejects.toThrow('requires image files')
    expect(started).toEqual([])
  })

  it('verifies built-in recipes array is cleared pending new verified recipes', () => {
    expect(BUILT_IN_WORKFLOW_TEMPLATES).toEqual([])
  })

  it.each(['icon-pack', 'qr-decoder'])(
    'rejects imported audio wires to %s before execution',
    async (toolId) => {
      const graph: WorkflowGraph = {
        nodes: [
          { id: 'a', toolId: 'extract-audio', params: {}, position: { x: 0, y: 0 } },
          { id: 'b', toolId, params: {}, position: { x: 300, y: 0 } }
        ],
        edges: [{ id: 'e', fromNodeId: 'a', toNodeId: 'b', fromPort: 'files', toPort: 'files' }]
      }
      const started: string[] = []
      await expect(
        runWorkflowPipeline(graph, ['clip.mp4'], '', {
          onNodeStart: (id) => started.push(id)
        })
      ).rejects.toThrow('requires image files')
      expect(started).toEqual([])
    }
  )

  it('rejects dangling saved wires before execution', async () => {
    const graph: WorkflowGraph = {
      nodes: [{ id: 'a', toolId: 'image-convert', params: {}, position: { x: 0, y: 0 } }],
      edges: [{ id: 'e', fromNodeId: 'missing', toNodeId: 'a', fromPort: 'files', toPort: 'files' }]
    }
    await expect(runWorkflowPipeline(graph, [])).rejects.toThrow('missing node')
  })

  it('rejects unknown saved tools before execution', async () => {
    const graph: WorkflowGraph = {
      nodes: [{ id: 'a', toolId: 'unregistered', params: {}, position: { x: 0, y: 0 } }],
      edges: []
    }
    await expect(runWorkflowPipeline(graph, [])).rejects.toThrow('Unknown workflow tool')
  })

  it('rejects unsupported imported port names', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'a', toolId: 'image-convert', params: {}, position: { x: 0, y: 0 } },
        { id: 'b', toolId: 'image-compress', params: {}, position: { x: 300, y: 0 } }
      ],
      edges: [
        {
          id: 'e',
          fromNodeId: 'a',
          toNodeId: 'b',
          fromPort: 'bogus',
          toPort: 'bogus'
        } as unknown as WorkflowGraph['edges'][number]
      ]
    }
    await expect(runWorkflowPipeline(graph, [])).rejects.toThrow('Unsupported workflow port')
  })

  it('rejects duplicate saved node identities', async () => {
    const node = { id: 'a', toolId: 'image-convert', params: {}, position: { x: 0, y: 0 } }
    await expect(
      runWorkflowPipeline({ nodes: [node, { ...node }], edges: [] }, [])
    ).rejects.toThrow('Duplicate workflow node')
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
      expect(QUEUE_WORKFLOW_VERSION).toBe('0.4.2')
    })
  })

  describe('Workflow Pipeline Intermediate Directory Cleanup', () => {
    function withMockStashCleanup(cleanupFn: (dir: string) => Promise<void>) {
      const g = globalThis as unknown as { window?: { stash?: StashBridge } }
      const originalWindow = g.window
      g.window = {
        ...originalWindow,
        stash: {
          temp: {
            cleanup: cleanupFn
          }
        } as unknown as StashBridge
      }
      return () => {
        g.window = originalWindow
      }
    }

    it('eagerly purges intermediate scratch directories once consumed, leaving only terminal outputs', async () => {
      const cleanedDirs: string[] = []
      const restoreStash = withMockStashCleanup(async (dir: string) => {
        cleanedDirs.push(dir)
      })

      setCustomStepExecutor(async (toolId, files) => {
        return {
          outputFiles: files.map((f) => `/scratch/${toolId}/${path.basename(f)}`),
          opDir: `/scratch/${toolId}`,
          isTemp: true
        }
      })

      try {
        const graph: WorkflowGraph = {
          nodes: [
            { id: 'node-1', toolId: 'image-compress', position: { x: 0, y: 0 }, params: {} },
            { id: 'node-2', toolId: 'image-convert', position: { x: 200, y: 0 }, params: {} },
            { id: 'node-3', toolId: 'social-resizer', position: { x: 400, y: 0 }, params: {} }
          ],
          edges: [
            {
              id: 'e1',
              fromNodeId: 'node-1',
              fromPort: 'files',
              toNodeId: 'node-2',
              toPort: 'files'
            },
            {
              id: 'e2',
              fromNodeId: 'node-2',
              fromPort: 'files',
              toNodeId: 'node-3',
              toPort: 'files'
            }
          ]
        }

        const result = await runWorkflowPipeline(graph, ['/input/photo.png'])
        expect(result.success).toBe(true)

        // Intermediate scratch directories for node-1 and node-2 must be cleaned up
        expect(cleanedDirs).toContain('/scratch/image-compress')
        expect(cleanedDirs).toContain('/scratch/image-convert')

        // Leaf/terminal node-3 scratch directory must NOT be cleaned up
        expect(cleanedDirs).not.toContain('/scratch/social-resizer')

        // Final output files belong to node-3
        expect(result.finalOutputFiles).toEqual(['/scratch/social-resizer/photo.png'])
      } finally {
        setCustomStepExecutor(null)
        restoreStash()
      }
    })

    it('purges all intermediate directories in finally block on pipeline failure', async () => {
      const cleanedDirs: string[] = []
      const restoreStash = withMockStashCleanup(async (dir: string) => {
        cleanedDirs.push(dir)
      })

      setCustomStepExecutor(async (toolId, files) => {
        if (toolId === 'image-convert') {
          throw new Error('Image conversion failed')
        }
        return {
          outputFiles: files.map((f) => `/scratch/${toolId}/${path.basename(f)}`),
          opDir: `/scratch/${toolId}`,
          isTemp: true
        }
      })

      try {
        const graph: WorkflowGraph = {
          nodes: [
            { id: 'node-1', toolId: 'image-compress', position: { x: 0, y: 0 }, params: {} },
            { id: 'node-2', toolId: 'image-convert', position: { x: 200, y: 0 }, params: {} }
          ],
          edges: [
            {
              id: 'e1',
              fromNodeId: 'node-1',
              fromPort: 'files',
              toNodeId: 'node-2',
              toPort: 'files'
            }
          ]
        }

        const result = await runWorkflowPipeline(graph, ['/input/photo.png'])
        expect(result.success).toBe(false)

        // Intermediate scratch directory from node-1 must be purged in finally
        expect(cleanedDirs).toContain('/scratch/image-compress')
      } finally {
        setCustomStepExecutor(null)
        restoreStash()
      }
    })

    it('never purges user-specified custom output directory', async () => {
      const cleanedDirs: string[] = []
      const restoreStash = withMockStashCleanup(async (dir: string) => {
        cleanedDirs.push(dir)
      })

      setCustomStepExecutor(async (_toolId, files, _text, _params, options) => {
        const isCustom = Boolean(options?.outputDir)
        return {
          outputFiles: files.map((f) => `${options?.outputDir ?? '/scratch'}/${path.basename(f)}`),
          opDir: options?.outputDir ?? '/scratch',
          isTemp: !isCustom
        }
      })

      try {
        const graph: WorkflowGraph = {
          nodes: [
            { id: 'node-1', toolId: 'image-compress', position: { x: 0, y: 0 }, params: {} },
            { id: 'node-2', toolId: 'image-convert', position: { x: 200, y: 0 }, params: {} }
          ],
          edges: [
            {
              id: 'e1',
              fromNodeId: 'node-1',
              fromPort: 'files',
              toNodeId: 'node-2',
              toPort: 'files'
            }
          ]
        }

        const result = await runWorkflowPipeline(graph, ['/input/photo.png'], '', {
          outputDir: 'D:/MyExport'
        })
        expect(result.success).toBe(true)
        expect(cleanedDirs).toHaveLength(0)
      } finally {
        setCustomStepExecutor(null)
        restoreStash()
      }
    })

    it('handles branching DAG: purges intermediate dir only when ALL downstream branches complete', async () => {
      const cleanLog: Array<{ action: string; id?: string; dir?: string }> = []
      const restoreStash = withMockStashCleanup(async (dir: string) => {
        cleanLog.push({ action: 'cleanup', dir })
      })

      setCustomStepExecutor(async (toolId, files) => {
        cleanLog.push({ action: 'execute', id: toolId })
        return {
          outputFiles: files.map((f) => `/scratch/${toolId}/${path.basename(f)}`),
          opDir: `/scratch/${toolId}`,
          isTemp: true
        }
      })

      try {
        // Node A -> Node B -> Node D
        // Node A -> Node C -> Node D
        const graph: WorkflowGraph = {
          nodes: [
            { id: 'node-A', toolId: 'image-compress', position: { x: 0, y: 0 }, params: {} },
            { id: 'node-B', toolId: 'image-convert', position: { x: 200, y: -100 }, params: {} },
            { id: 'node-C', toolId: 'social-resizer', position: { x: 200, y: 100 }, params: {} },
            { id: 'node-D', toolId: 'images-to-pdf', position: { x: 400, y: 0 }, params: {} }
          ],
          edges: [
            {
              id: 'e1',
              fromNodeId: 'node-A',
              fromPort: 'files',
              toNodeId: 'node-B',
              toPort: 'files'
            },
            {
              id: 'e2',
              fromNodeId: 'node-A',
              fromPort: 'files',
              toNodeId: 'node-C',
              toPort: 'files'
            },
            {
              id: 'e3',
              fromNodeId: 'node-B',
              fromPort: 'files',
              toNodeId: 'node-D',
              toPort: 'files'
            },
            {
              id: 'e4',
              fromNodeId: 'node-C',
              fromPort: 'files',
              toNodeId: 'node-D',
              toPort: 'files'
            }
          ]
        }

        const result = await runWorkflowPipeline(graph, ['/input/photo.png'])
        expect(result.success).toBe(true)

        // Find index in cleanLog where node-A was cleaned up
        const cleanupAIndex = cleanLog.findIndex(
          (e) => e.action === 'cleanup' && e.dir === '/scratch/image-compress'
        )
        // Both node-B (image-convert) and node-C (social-resizer) must have executed BEFORE node-A was cleaned up!
        const execBIndex = cleanLog.findIndex(
          (e) => e.action === 'execute' && e.id === 'image-convert'
        )
        const execCIndex = cleanLog.findIndex(
          (e) => e.action === 'execute' && e.id === 'social-resizer'
        )

        expect(cleanupAIndex).toBeGreaterThan(execBIndex)
        expect(cleanupAIndex).toBeGreaterThan(execCIndex)

        // Node D is the leaf; its output must NOT be cleaned up
        const cleanupDIndex = cleanLog.findIndex(
          (e) => e.action === 'cleanup' && e.dir === '/scratch/images-to-pdf'
        )
        expect(cleanupDIndex).toBe(-1)
      } finally {
        setCustomStepExecutor(null)
        restoreStash()
      }
    })

    it('safely handles multi-step document pipelines without premature deletion of upstream artifacts', async () => {
      const cleanedDirs: string[] = []
      const activeDirs = new Set<string>()
      const restoreStash = withMockStashCleanup(async (dir: string) => {
        cleanedDirs.push(dir)
        activeDirs.delete(dir)
      })

      setCustomStepExecutor(async (toolId, files) => {
        // Assert all input files exist in currently active dirs or external input
        for (const file of files) {
          const dir = path.dirname(file)
          if (dir.startsWith('/scratch/')) {
            expect(
              activeDirs.has(dir),
              `Input directory ${dir} must not be cleaned prematurely`
            ).toBe(true)
          }
        }
        const opDir = `/scratch/${toolId}`
        activeDirs.add(opDir)
        return {
          outputFiles: files.map((f) => `${opDir}/${path.basename(f)}`),
          opDir,
          isTemp: true
        }
      })

      try {
        const graph: WorkflowGraph = {
          nodes: [
            {
              id: 'node-1',
              toolId: 'pdf-split',
              position: { x: 0, y: 0 },
              params: { range: '1-5' }
            },
            {
              id: 'node-2',
              toolId: 'pdf-numberer',
              position: { x: 200, y: 0 },
              params: { prefix: 'DOC-' }
            },
            {
              id: 'node-3',
              toolId: 'pdf-watermark',
              position: { x: 400, y: 0 },
              params: { text: 'CONFIDENTIAL' }
            },
            { id: 'node-4', toolId: 'pdf-compress', position: { x: 600, y: 0 }, params: {} }
          ],
          edges: [
            {
              id: 'e1',
              fromNodeId: 'node-1',
              fromPort: 'files',
              toNodeId: 'node-2',
              toPort: 'files'
            },
            {
              id: 'e2',
              fromNodeId: 'node-2',
              fromPort: 'files',
              toNodeId: 'node-3',
              toPort: 'files'
            },
            {
              id: 'e3',
              fromNodeId: 'node-3',
              fromPort: 'files',
              toNodeId: 'node-4',
              toPort: 'files'
            }
          ]
        }

        const result = await runWorkflowPipeline(graph, ['/input/contract.pdf'])
        expect(result.success).toBe(true)
        expect(result.finalOutputFiles).toEqual(['/scratch/pdf-compress/contract.pdf'])

        // Intermediate scratch directories must be cleaned up
        expect(cleanedDirs).toContain('/scratch/pdf-split')
        expect(cleanedDirs).toContain('/scratch/pdf-numberer')
        expect(cleanedDirs).toContain('/scratch/pdf-watermark')
        // Terminal node output must NOT be cleaned up
        expect(cleanedDirs).not.toContain('/scratch/pdf-compress')
      } finally {
        setCustomStepExecutor(null)
        restoreStash()
      }
    })
  })

  describe('Workflow Node Stash Asset Payload Integration', () => {
    it('accumulates and deduplicates stash assets on a node input files payload', () => {
      const initialFiles = ['/stash/assets/photo1.png']
      const newStashAssets = [
        '/stash/assets/photo1.png',
        '/stash/assets/photo2.png',
        '/stash/assets/doc.pdf'
      ]
      const combined = Array.from(new Set([...initialFiles, ...newStashAssets]))

      expect(combined).toEqual([
        '/stash/assets/photo1.png',
        '/stash/assets/photo2.png',
        '/stash/assets/doc.pdf'
      ])
      expect(combined).toHaveLength(3)
    })
  })

  describe('Workflow Tool Parameters Schema & Workspace Parity', () => {
    it('defines rich parameter schemas matching workspace controls for transform tools', () => {
      const watermarkFields = getToolParamFields('pdf-watermark')
      expect(watermarkFields.length).toBeGreaterThan(0)
      const textField = watermarkFields.find((f) => f.key === 'text')
      expect(textField).toBeDefined()
      expect(textField?.type).toBe('text')
      expect(textField?.aliases).toContain('watermark')
      expect(textField?.aliases).toContain('watermarkText')

      const numbererFields = getToolParamFields('pdf-numberer')
      expect(numbererFields.length).toBeGreaterThan(0)
      const formatField = numbererFields.find((f) => f.key === 'format')
      expect(formatField?.type).toBe('select')
      const prefixField = numbererFields.find((f) => f.key === 'batesPrefix')
      expect(prefixField?.aliases).toContain('prefix')

      const videoFields = getToolParamFields('video-convert')
      expect(videoFields.some((f) => f.key === 'format')).toBe(true)
      expect(videoFields.some((f) => f.key === 'crfQuality' && f.aliases?.includes('crf'))).toBe(
        true
      )

      const socialFields = getToolParamFields('social-resizer')
      expect(socialFields.some((f) => f.key === 'presetId')).toBe(true)
    })

    it('returns empty fields for parameterless or standard automatic tools', () => {
      expect(getToolParamFields('pdf-compress')).toEqual([])
      expect(getToolParamFields('zip-extract')).toEqual([])
      expect(getToolParamFields('archive-inspect')).toEqual([])
      expect(getToolParamFields('file-metadata')).toEqual([])
    })

    it('resolves parameter values prioritizing canonical key over aliases, falling back to default', () => {
      const textField = getToolParamFields('pdf-watermark').find((f) => f.key === 'text')!

      // 1. Fallback to default
      expect(resolveParamValue({}, textField)).toBe('CONFIDENTIAL')

      // 2. Fallback to alias if canonical key is missing
      expect(resolveParamValue({ watermark: 'test output' }, textField)).toBe('test output')
      expect(resolveParamValue({ watermarkText: 'legacy text' }, textField)).toBe('legacy text')

      // 3. Prioritize canonical key when explicitly set
      expect(
        resolveParamValue({ text: 'canonical text', watermark: 'ignored alias' }, textField)
      ).toBe('canonical text')
    })

    it('prioritizes user-customized alias over default or recipe preset string', () => {
      const textField = getToolParamFields('pdf-watermark').find((f) => f.key === 'text')!

      // When canonical holds recipe preset 'STRICTLY PRIVATE' and alias holds user input 'test output'
      expect(
        resolveParamValue({ text: 'STRICTLY PRIVATE', watermark: 'test output' }, textField)
      ).toBe('test output')

      // When canonical holds default 'CONFIDENTIAL' and alias holds user input 'test output'
      expect(resolveParamValue({ text: 'CONFIDENTIAL', watermark: 'test output' }, textField)).toBe(
        'test output'
      )

      // When canonical was genuinely customized by user, canonical wins
      expect(
        resolveParamValue({ text: 'MY CUSTOM WATERMARK', watermark: 'old text' }, textField)
      ).toBe('MY CUSTOM WATERMARK')
    })

    it('executes text transformation tools end-to-end with configured parameters', async () => {
      // 1. Case Converter
      const caseUpper = await executeStep('case-converter', [], 'hello world', {
        caseMode: 'upper'
      })
      expect(caseUpper.outputText).toBe('HELLO WORLD')

      const caseSnake = await executeStep('case-converter', [], 'hello world', {
        caseMode: 'snake'
      })
      expect(caseSnake.outputText).toBe('hello_world')

      const caseCamel = await executeStep('case-converter', [], 'hello world', {
        caseMode: 'camel'
      })
      expect(caseCamel.outputText).toBe('helloWorld')

      // 2. JSON Formatter
      const jsonPretty = await executeStep('json-format', [], '{"a":1,"b":2}', { indent: 2 })
      expect(jsonPretty.outputText).toBe('{\n  "a": 1,\n  "b": 2\n}')

      const jsonMinify = await executeStep('json-format', [], '{\n  "a": 1\n}', { mode: 'minify' })
      expect(jsonMinify.outputText).toBe('{"a":1}')

      // 3. Base64 Codec
      const b64Encoded = await executeStep('base64-codec', [], 'Hello Hermanos', {
        direction: 'encode'
      })
      expect(b64Encoded.outputText).toBe(btoa('Hello Hermanos'))

      const b64Decoded = await executeStep('base64-codec', [], btoa('Hello Hermanos'), {
        direction: 'decode'
      })
      expect(b64Decoded.outputText).toBe('Hello Hermanos')

      // 4. YAML <-> JSON
      const yamlRes = await executeStep('yaml-json', [], 'name: Stash\ncount: 42', {
        direction: 'yaml-to-json'
      })
      expect(JSON.parse(yamlRes.outputText || '{}')).toEqual({ name: 'Stash', count: 42 })

      // 5. CSV <-> JSON
      const csvRes = await executeStep('csv-json', [], 'id,name\n1,Alpha\n2,Beta', {
        direction: 'csv-to-json'
      })
      expect(JSON.parse(csvRes.outputText || '[]')).toEqual([
        { id: '1', name: 'Alpha' },
        { id: '2', name: 'Beta' }
      ])
    })

    it('passes user watermark parameter correctly through execution pipeline', async () => {
      let capturedWatermarkText: string | undefined
      setCustomStepExecutor(async (toolId, files, _text, params) => {
        if (toolId === 'pdf-watermark') {
          const textField = getToolParamFields('pdf-watermark').find((f) => f.key === 'text')!
          capturedWatermarkText = String(resolveParamValue(params, textField))
        }
        return {
          outputFiles: files.map((f) => `/scratch/${toolId}/${path.basename(f)}`),
          opDir: `/scratch/${toolId}`,
          isTemp: true
        }
      })

      try {
        const graph: WorkflowGraph = {
          nodes: [
            {
              id: 'node-1',
              toolId: 'pdf-split',
              position: { x: 0, y: 0 },
              params: { range: '1-2' }
            },
            {
              id: 'node-2',
              toolId: 'pdf-watermark',
              position: { x: 200, y: 0 },
              params: { text: 'STRICTLY PRIVATE', watermark: 'test output' }
            }
          ],
          edges: [
            {
              id: 'e1',
              fromNodeId: 'node-1',
              fromPort: 'files',
              toNodeId: 'node-2',
              toPort: 'files'
            }
          ]
        }

        const result = await runWorkflowPipeline(graph, ['/input/document.pdf'])
        expect(result.success).toBe(true)
        expect(capturedWatermarkText).toBe('test output')
      } finally {
        setCustomStepExecutor(null)
      }
    })
  })
})

describe('catalog compatibility audit', () => {
  it('exports the verified N x N checklist on explicit request', () => {
    const rows = AUDIT_ROWS.flatMap((from) =>
      AUDIT_ROWS.map((to) => {
        const expected = expectedAuditPorts(from, to)
        const files = validateEdge(
          toolRegistry.get(from.id)!,
          toolRegistry.get(to.id)!,
          'files',
          'files'
        )
        const text = validateEdge(
          toolRegistry.get(from.id)!,
          toolRegistry.get(to.id)!,
          'text',
          'text'
        )
        expect([files.valid, text.valid], `${from.id} -> ${to.id}`).toEqual([
          expected.files,
          expected.text
        ])
        return {
          from: from.id,
          to: to.id,
          files: files.valid,
          text: text.valid,
          fileReason: files.reason ?? 'Compatible at media-domain level',
          textReason: text.reason ?? 'Compatible text ports; content validation still required'
        }
      })
    )
    expect(rows).toHaveLength(toolRegistry.all().length ** 2)
    if (process.env.STASH_EXPORT_COMPATIBILITY === '1') {
      const dir = path.resolve(process.env.STASH_COMPATIBILITY_OUTPUT_DIR ?? 'docs/workflow-audit')
      mkdirSync(dir, { recursive: true })
      const quote = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`
      const fields = ['from', 'to', 'files', 'text', 'fileReason', 'textReason'] as const
      writeFileSync(
        path.join(dir, 'compatibility.csv'),
        [fields.join(','), ...rows.map((r) => fields.map((f) => quote(r[f])).join(','))].join(
          '\n'
        ) + '\n'
      )
      writeFileSync(
        path.join(dir, 'tools.csv'),
        [
          'id,input,output,acceptsText,producesText',
          ...AUDIT_ROWS.map((r) =>
            [r.id, r.input, r.output, r.acceptsText, r.producesText].join(',')
          )
        ].join('\n') + '\n'
      )
      console.log(
        JSON.stringify({
          pairs: rows.length,
          fileLinks: rows.filter((r) => r.files).length,
          textLinks: rows.filter((r) => r.text).length
        })
      )
    }
  })
  it('covers each registered tool exactly once with matching port declarations', () => {
    expect(AUDIT_ROWS).toHaveLength(toolRegistry.all().length)
    expect(AUDIT_ROWS.map((r) => r.id).sort()).toEqual(
      toolRegistry
        .all()
        .map((t) => t.id)
        .sort()
    )
    for (const row of AUDIT_ROWS) {
      const caps = toolRegistry.get(row.id)!.capabilities
      expect(
        [!!caps.acceptsFiles, !!caps.producesFiles, !!caps.acceptsText, !!caps.producesText],
        row.id
      ).toEqual([row.input !== '-', row.output !== '-', row.acceptsText, row.producesText])
    }
  })

  it.each(AUDIT_ROWS)('checks every destination for $id (N x 4 port combinations)', (from) => {
    for (const to of AUDIT_ROWS) {
      const expected = expectedAuditPorts(from, to)
      for (const sourcePort of ['files', 'text'] as const) {
        for (const targetPort of ['files', 'text'] as const) {
          const result = validateEdge(
            toolRegistry.get(from.id)!,
            toolRegistry.get(to.id)!,
            sourcePort,
            targetPort
          )
          const label = `${from.id}:${sourcePort} -> ${to.id}:${targetPort}`
          expect(result.valid, label).toBe(sourcePort === targetPort && expected[sourcePort])
          if (!result.valid) expect(result.reason, label).toBeTruthy()
        }
      }
    }
  })
})

describe('Workflow semantic domain regressions', () => {
  const tool = (id: string) => toolRegistry.get(id)!

  it.each(['icon-pack', 'qr-decoder', 'image-ocr'])(
    'rejects audio into %s regardless of sidebar category',
    (id) => {
      expect(validateEdge(tool('extract-audio'), tool(id), 'files', 'files').valid).toBe(false)
      expect(validateEdge(tool('image-compress'), tool(id), 'files', 'files').valid).toBe(true)
    }
  )

  it('fails closed for an unclassified file tool even in a familiar category', () => {
    const unknown = { ...tool('image-compress'), id: 'unclassified' }
    expect(validateEdge(unknown, tool('image-compress'), 'files', 'files').valid).toBe(false)
    expect(validateEdge(tool('image-compress'), unknown, 'files', 'files').valid).toBe(false)
  })

  it('does not confuse an archive container with its contents', () => {
    expect(validateEdge(tool('zip-create'), tool('image-compress'), 'files', 'files').valid).toBe(
      false
    )
    expect(validateEdge(tool('image-compress'), tool('zip-extract'), 'files', 'files').valid).toBe(
      false
    )
    expect(validateEdge(tool('zip-create'), tool('zip-extract'), 'files', 'files').valid).toBe(true)
    expect(validateEdge(tool('zip-extract'), tool('image-compress'), 'files', 'files').valid).toBe(
      false
    )
    expect(validateEdge(tool('zip-extract'), tool('hash-generator'), 'files', 'files').valid).toBe(
      true
    )
  })
})
