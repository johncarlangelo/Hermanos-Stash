/**
 * Hermanos Stash — Visual Workflow Topological Sorter & Execution Engine
 *
 * Traverses DAG nodes in dependency order, validates edge type compatibility,
 * passes outputs between steps, and streams execution progress.
 */

import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../../shared/types/tool'
import type { WorkflowExecutionResult, WorkflowGraph, WorkflowNode } from './types'

/**
 * Checks domain compatibility between two file-producing/consuming tools.
 */
export function areFileCategoriesCompatible(
  fromTool: ToolDefinition,
  toTool: ToolDefinition
): { compatible: boolean; reason?: string } {
  // General file tools (archives, checksum, file metadata) accept and produce arbitrary files
  if (fromTool.category === 'files' || toTool.category === 'files') {
    return { compatible: true }
  }

  // Cross-domain conversion bridges
  if (fromTool.id === 'pdf-to-images' && toTool.category === 'images') {
    return { compatible: true }
  }
  if (fromTool.category === 'images' && toTool.id === 'images-to-pdf') {
    return { compatible: true }
  }
  if (fromTool.id === 'extract-audio' && toTool.category === 'audio') {
    return { compatible: true }
  }
  if (fromTool.category === 'video' && toTool.id === 'extract-audio') {
    return { compatible: true }
  }
  if (fromTool.id === 'video-to-gif' && toTool.category === 'images') {
    return { compatible: true }
  }

  // Audio tools require audio file inputs
  if (toTool.category === 'audio') {
    if (fromTool.category === 'images') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": audio tools require audio file inputs, but "${fromTool.name}" produces images.`
      }
    }
    if (fromTool.category === 'documents') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": audio tools require audio file inputs, but "${fromTool.name}" produces documents.`
      }
    }
    if (fromTool.category === 'video' && toTool.id !== 'extract-audio') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": "${toTool.name}" requires audio file inputs, but "${fromTool.name}" produces video. Connect to "Audio Extractor" first.`
      }
    }
  }

  // Video tools require video file inputs
  if (toTool.category === 'video') {
    if (fromTool.category === 'audio') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": video tools require video file inputs, but "${fromTool.name}" produces audio.`
      }
    }
    if (fromTool.category === 'images') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": video tools require video file inputs, but "${fromTool.name}" produces images.`
      }
    }
    if (fromTool.category === 'documents') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": video tools require video file inputs, but "${fromTool.name}" produces documents.`
      }
    }
  }

  // Image tools require image file inputs
  if (toTool.category === 'images') {
    if (fromTool.category === 'audio') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": image tools require image file inputs, but "${fromTool.name}" produces audio.`
      }
    }
    if (fromTool.category === 'video' && fromTool.id !== 'video-to-gif') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": image tools require image file inputs, but "${fromTool.name}" produces video. Use "Video → GIF" first.`
      }
    }
    if (fromTool.category === 'documents' && fromTool.id !== 'pdf-to-images') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": image tools require image file inputs, but "${fromTool.name}" produces documents. Use "PDF → Images" first.`
      }
    }
  }

  // Document tools require PDF or document files
  if (toTool.category === 'documents') {
    if (fromTool.category === 'audio') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": document tools require PDF or document files, but "${fromTool.name}" produces audio.`
      }
    }
    if (fromTool.category === 'video') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": document tools require PDF or document files, but "${fromTool.name}" produces video.`
      }
    }
    if (fromTool.category === 'images' && toTool.id !== 'images-to-pdf') {
      return {
        compatible: false,
        reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": document tools require PDF files, but "${fromTool.name}" produces images. Use "Images → PDF" first.`
      }
    }
  }

  return { compatible: true }
}

/**
 * Checks whether adding a directed edge from `fromNodeId` to `toNodeId`
 * would introduce a cycle into the workflow graph.
 */
export function wouldCreateCycle(
  graph: WorkflowGraph,
  fromNodeId: string,
  toNodeId: string
): boolean {
  if (fromNodeId === toNodeId) return true

  // If toNodeId can already reach fromNodeId, then adding fromNodeId -> toNodeId creates a cycle
  const visited = new Set<string>()
  const queue: string[] = [toNodeId]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === fromNodeId) {
      return true
    }
    if (!visited.has(current)) {
      visited.add(current)
      for (const edge of graph.edges) {
        if (edge.fromNodeId === current && !visited.has(edge.toNodeId)) {
          queue.push(edge.toNodeId)
        }
      }
    }
  }

  return false
}

/**
 * Validates whether an edge between two tools is compatible.
 */
export function validateEdge(
  fromTool: ToolDefinition,
  toTool: ToolDefinition,
  fromPort: 'files' | 'text',
  toPort: 'files' | 'text'
): { valid: boolean; reason?: string } {
  if (fromPort !== toPort) {
    return {
      valid: false,
      reason: `Cannot connect "${fromPort}" output to "${toPort}" input.`
    }
  }

  if (fromPort === 'files') {
    if (!fromTool.capabilities.producesFiles) {
      return {
        valid: false,
        reason: `"${fromTool.name}" does not produce files.`
      }
    }
    if (!toTool.capabilities.acceptsFiles) {
      return {
        valid: false,
        reason: `"${toTool.name}" does not accept files.`
      }
    }
    const domainCheck = areFileCategoriesCompatible(fromTool, toTool)
    if (!domainCheck.compatible) {
      return {
        valid: false,
        reason: domainCheck.reason
      }
    }
  }

  if (fromPort === 'text') {
    if (!fromTool.capabilities.producesText) {
      return {
        valid: false,
        reason: `"${fromTool.name}" does not produce text.`
      }
    }
    if (!toTool.capabilities.acceptsText) {
      return {
        valid: false,
        reason: `"${toTool.name}" does not accept text.`
      }
    }
  }

  return { valid: true }
}

/**
 * Topologically sorts nodes in a DAG (Kahn's algorithm).
 */
export function topologicalSort(graph: WorkflowGraph): {
  sortedNodeIds: string[]
  hasCycle: boolean
} {
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>()

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0)
    adjList.set(node.id, [])
  }

  for (const edge of graph.edges) {
    if (inDegree.has(edge.toNodeId) && adjList.has(edge.fromNodeId)) {
      inDegree.set(edge.toNodeId, (inDegree.get(edge.toNodeId) || 0) + 1)
      adjList.get(edge.fromNodeId)!.push(edge.toNodeId)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id)
  }

  const sortedNodeIds: string[] = []
  while (queue.length > 0) {
    const currId = queue.shift()!
    sortedNodeIds.push(currId)

    for (const neighbor of adjList.get(currId) || []) {
      const nextDeg = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, nextDeg)
      if (nextDeg === 0) {
        queue.push(neighbor)
      }
    }
  }

  const hasCycle = sortedNodeIds.length !== graph.nodes.length
  return { sortedNodeIds, hasCycle }
}

/**
 * Executes a single tool in simulation / batch runner mode.
 */
export async function executeStep(
  toolId: string,
  files: string[],
  text: string,
  _params: Record<string, unknown>
): Promise<{ outputFiles: string[]; outputText?: string }> {
  // Processing step execution
  await new Promise((r) => setTimeout(r, 300))

  const toolDef = toolRegistry.get(toolId)
  const producesFiles = toolDef ? toolDef.capabilities.producesFiles : true
  const producesText = toolDef ? toolDef.capabilities.producesText : false

  const outputFiles = producesFiles
    ? files.length > 0
      ? files.map((f) => f.replace(/(\.[^.]+)$/, `_${toolId}$1`))
      : []
    : []

  const outputText =
    producesText && text.trim().length > 0
      ? `Processed by ${toolDef?.name ?? toolId}:\n${text}`
      : undefined

  return { outputFiles, outputText }
}

/**
 * Orchestrates pipeline execution across all workflow nodes.
 */
export async function runWorkflowPipeline(
  graph: WorkflowGraph,
  initialFiles: string[],
  initialText = '',
  callbacks?: {
    onNodeStart?: (nodeId: string, inputFiles: string[]) => void
    onNodeSuccess?: (nodeId: string, outputFiles: string[], durationMs: number) => void
    onNodeError?: (nodeId: string, error: string) => void
    onProgress?: (ratio: number) => void
    isAborted?: () => boolean
  }
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now()
  const { sortedNodeIds, hasCycle } = topologicalSort(graph)

  if (hasCycle) {
    throw new Error('Workflow contains an invalid cycle loop. Please check your connections.')
  }

  const nodeMap = new Map<string, WorkflowNode>(graph.nodes.map((n) => [n.id, n]))
  const incomingEdges = new Map<string, typeof graph.edges>()
  for (const edge of graph.edges) {
    if (!incomingEdges.has(edge.toNodeId)) {
      incomingEdges.set(edge.toNodeId, [])
    }
    incomingEdges.get(edge.toNodeId)!.push(edge)
  }

  const nodeOutputs = new Map<string, { files: string[]; text?: string }>()
  const nodeResults: WorkflowExecutionResult['nodeResults'] = {}

  let totalCompleted = 0
  const totalNodes = sortedNodeIds.length

  for (const nodeId of sortedNodeIds) {
    if (callbacks?.isAborted?.()) {
      return {
        success: false,
        durationMs: Date.now() - startTime,
        nodeResults,
        finalOutputFiles: []
      }
    }

    const node = nodeMap.get(nodeId)!
    const inEdges = incomingEdges.get(nodeId) || []

    // Collect inputs from upstream nodes
    let stepInputFiles: string[] = []
    let stepInputText = ''

    if (inEdges.length === 0) {
      // Source node: takes direct node inputs or initial pipeline inputs
      stepInputFiles =
        node.inputFiles && node.inputFiles.length > 0 ? [...node.inputFiles] : [...initialFiles]
      stepInputText =
        node.inputText !== undefined && node.inputText !== '' ? node.inputText : initialText
    } else {
      for (const edge of inEdges) {
        const upstream = nodeOutputs.get(edge.fromNodeId)
        if (upstream) {
          if (edge.fromPort === 'files' && upstream.files.length > 0) {
            stepInputFiles.push(...upstream.files)
          }
          if (edge.fromPort === 'text' && upstream.text) {
            stepInputText = stepInputText ? `${stepInputText}\n${upstream.text}` : upstream.text
          }
        }
      }
    }

    // Deduplicate input files
    stepInputFiles = Array.from(new Set(stepInputFiles))

    callbacks?.onNodeStart?.(nodeId, stepInputFiles)
    const nodeStartTime = Date.now()

    try {
      const { outputFiles, outputText } = await executeStep(
        node.toolId,
        stepInputFiles,
        stepInputText,
        node.params
      )

      const nodeDuration = Date.now() - nodeStartTime
      nodeOutputs.set(nodeId, { files: outputFiles, text: outputText })

      nodeResults[nodeId] = {
        status: 'success',
        inputFiles: stepInputFiles,
        outputFiles,
        durationMs: nodeDuration
      }

      callbacks?.onNodeSuccess?.(nodeId, outputFiles, nodeDuration)
      totalCompleted++
      callbacks?.onProgress?.(totalCompleted / Math.max(1, totalNodes))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      nodeResults[nodeId] = {
        status: 'error',
        inputFiles: stepInputFiles,
        outputFiles: [],
        durationMs: Date.now() - nodeStartTime,
        error: errorMsg
      }
      callbacks?.onNodeError?.(nodeId, errorMsg)

      return {
        success: false,
        durationMs: Date.now() - startTime,
        nodeResults,
        finalOutputFiles: []
      }
    }
  }

  // Find leaf nodes (nodes with 0 outgoing edges)
  const nodesWithOutgoing = new Set(graph.edges.map((e) => e.fromNodeId))
  const leafNodeIds = graph.nodes.filter((n) => !nodesWithOutgoing.has(n.id)).map((n) => n.id)

  const finalFiles: string[] = []
  let finalCombinedText = ''

  for (const leafId of leafNodeIds) {
    const out = nodeOutputs.get(leafId)
    if (out) {
      finalFiles.push(...out.files)
      if (out.text) {
        finalCombinedText = finalCombinedText ? `${finalCombinedText}\n${out.text}` : out.text
      }
    }
  }

  return {
    success: true,
    durationMs: Date.now() - startTime,
    nodeResults,
    finalOutputFiles: Array.from(new Set(finalFiles)),
    finalOutputText: finalCombinedText
  }
}
