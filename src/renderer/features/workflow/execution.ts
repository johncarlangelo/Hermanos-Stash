/**
 * Hermanos Stash — Visual Workflow Topological Sorter & Execution Engine
 *
 * Traverses DAG nodes in dependency order, validates edge type compatibility,
 * passes outputs between steps, and streams execution progress.
 */

import type { WatermarkPosition } from '../../../shared/ipc'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../../shared/types/tool'
import { fileInputDomain, fileOutputDomain } from '../../../shared/utils/tool-domains'
import type { WorkflowExecutionResult, WorkflowGraph, WorkflowNode } from './types'

/** Directional media compatibility, independent of sidebar categories. */
export function areFileCategoriesCompatible(
  fromTool: ToolDefinition,
  toTool: ToolDefinition
): { compatible: boolean; reason?: string } {
  const output = fileOutputDomain(fromTool.id)
  const input = fileInputDomain(toTool.id)
  if (
    !fromTool.capabilities.producesFiles ||
    !toTool.capabilities.acceptsFiles ||
    !output ||
    !input
  ) {
    return {
      compatible: false,
      reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": missing file capability or audited media domain.`
    }
  }
  // Universal CONSUMERS can inspect any file. Unknown/mixed outputs cannot
  // safely feed a specialized processor without inspecting actual artifacts.
  if (input === 'any' || (output !== 'any' && output === input)) {
    return { compatible: true }
  }
  return {
    compatible: false,
    reason: `Cannot connect "${fromTool.name}" to "${toTool.name}": produces ${output} files; requires ${input} files. Select or extract compatible artifacts first.`
  }
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

export type StepExecutor = (
  toolId: string,
  files: string[],
  text: string,
  params: Record<string, unknown>,
  options?: { outputDir?: string }
) => Promise<{ outputFiles: string[]; outputText?: string }>

let customExecutor: StepExecutor | null = null

/** Allows headless test runners or custom engines to register a direct processor. */
export function setCustomStepExecutor(executor: StepExecutor | null): void {
  customExecutor = executor
}

/**
 * Executes a tool using the real Electron IPC bridge (window.stash).
 */
async function executeWithStash(
  toolId: string,
  files: string[],
  text: string,
  params: Record<string, unknown>,
  options?: { outputDir?: string }
): Promise<{ outputFiles: string[]; outputText?: string }> {
  const toolDef = toolRegistry.get(toolId)
  const producesFiles = toolDef ? toolDef.capabilities.producesFiles : true
  const producesText = toolDef ? toolDef.capabilities.producesText : false

  // Analysis / inspection / text-producing tools that consume files but output text
  if (!producesFiles) {
    if (toolId === 'file-metadata' && files[0]) {
      const stat = await window.stash.fs.stat(files[0])
      return {
        outputFiles: [],
        outputText: `File: ${stat.name}\nSize: ${stat.sizeBytes} bytes\nExtension: ${stat.extension}\nModified: ${new Date(stat.modifiedAtMs).toLocaleString()}`
      }
    }
    if (toolId === 'hash-generator' && files[0]) {
      const res = await window.stash.crypto.hashFile({ path: files[0], algorithm: 'sha256' })
      return {
        outputFiles: [],
        outputText: `SHA-256: ${res.hex}\nFile: ${files[0]}`
      }
    }
    if (toolId === 'image-ocr' && files[0]) {
      const res = await window.stash.processing.ocrImage({ path: files[0] })
      return {
        outputFiles: [],
        outputText: res.text
      }
    }
    const outputText =
      producesText && text.trim().length > 0
        ? `Processed by ${toolDef?.name ?? toolId}:\n${text}`
        : undefined
    return { outputFiles: [], outputText }
  }

  // File-producing tool without inputs
  if (files.length === 0) {
    return { outputFiles: [], outputText: undefined }
  }

  // Acquire isolated workspace directory for this operation
  const opDir = options?.outputDir ?? (await window.stash.temp.createOperation(`wf-${toolId}`))

  switch (toolId) {
    case 'image-convert': {
      const format = (params.format as 'png' | 'jpeg' | 'webp' | 'avif' | 'tiff') || 'png'
      const quality = typeof params.quality === 'number' ? params.quality : 85
      const res = await window.stash.processing.convertImages({
        paths: files,
        outputDir: opDir,
        format,
        quality
      })
      return { outputFiles: res.succeeded.map((s) => s.output) }
    }
    case 'image-compress': {
      const quality = typeof params.quality === 'number' ? params.quality : 75
      const res = await window.stash.processing.compressImages({
        paths: files,
        outputDir: opDir,
        quality
      })
      return { outputFiles: res.succeeded.map((s) => s.output) }
    }
    case 'image-watermark': {
      const res = await window.stash.processing.watermarkImages({
        paths: files,
        outputDir: opDir,
        text: String(params.watermarkText || 'Hermanos Stash'),
        position: (params.position as WatermarkPosition) || 'bottom-right',
        opacity: typeof params.opacity === 'number' ? params.opacity : 0.6,
        fontSize: typeof params.fontSize === 'number' ? params.fontSize : 28
      })
      return { outputFiles: res.succeeded.map((s) => s.output) }
    }
    case 'social-resizer': {
      const res = await window.stash.processing.socialResize({
        paths: files,
        outputDir: opDir,
        presets: [(params.presetId as string) || 'instagram-square']
      })
      return { outputFiles: res.succeeded.map((s) => s.output) }
    }
    case 'icon-pack': {
      const res = await window.stash.icons.generatePack({
        path: files[0],
        outputDir: opDir
      })
      return { outputFiles: res.succeeded.map((s) => s.path) }
    }
    case 'images-to-pdf': {
      const targetPdf = `${opDir}/images-to-pdf.pdf`
      await window.stash.pdfs.imagesToPdf({ paths: files, targetPdf })
      return { outputFiles: [targetPdf] }
    }
    case 'pdf-merge': {
      const targetPdf = `${opDir}/merged.pdf`
      await window.stash.pdfs.merge({ paths: files, targetPdf })
      return { outputFiles: [targetPdf] }
    }
    case 'pdf-split': {
      const res = await window.stash.pdfs.split({
        path: files[0],
        outputDir: opDir,
        pageSpec: (params.pageSpec as string) || '1'
      })
      return { outputFiles: res.succeeded.map((s) => s.output) }
    }
    case 'pdf-rotate': {
      const targetPdf = `${opDir}/rotated.pdf`
      await window.stash.pdfs.rotate({
        path: files[0],
        targetPdf,
        angle: (params.angle as 90 | 180 | 270) || 90,
        pageSpec: (params.pageSpec as string) || 'all'
      })
      return { outputFiles: [targetPdf] }
    }
    case 'pdf-compress': {
      const targetPdf = `${opDir}/compressed.pdf`
      await window.stash.pdfs.compress({ path: files[0], targetPdf })
      return { outputFiles: [targetPdf] }
    }
    case 'pdf-reorder': {
      const targetPdf = `${opDir}/reordered.pdf`
      await window.stash.pdfs.reorder({
        path: files[0],
        targetPdf,
        pageSpec: (params.pageSpec as string) || '1'
      })
      return { outputFiles: [targetPdf] }
    }
    case 'video-convert': {
      const res = await window.stash.media.convertVideo({
        path: files[0],
        outputDir: opDir,
        format: (params.format as 'mp4' | 'webm' | 'mkv') || 'mp4'
      })
      return { outputFiles: res.succeeded.map((s) => s.output) }
    }
    case 'video-compress': {
      const res = await window.stash.media.compressVideo({
        path: files[0],
        outputDir: opDir,
        crfQuality: typeof params.crfQuality === 'number' ? params.crfQuality : 28
      })
      return { outputFiles: res.succeeded.map((s) => s.output) }
    }
    case 'video-to-gif': {
      const res = await window.stash.media.videoToGif({
        path: files[0],
        outputDir: opDir,
        fps: typeof params.fps === 'number' ? params.fps : 15,
        maxWidth: typeof params.maxWidth === 'number' ? params.maxWidth : 640
      })
      return { outputFiles: res.succeeded.map((s) => s.output) }
    }
    case 'extract-audio': {
      const res = await window.stash.media.extractAudio({
        path: files[0],
        outputDir: opDir,
        codec: (params.codec as 'aac' | 'mp3' | 'wav' | 'flac' | 'opus') || 'mp3'
      })
      return { outputFiles: res.succeeded.map((s) => s.output) }
    }
    case 'audio-convert': {
      const res = await window.stash.media.convertAudio({
        path: files[0],
        outputDir: opDir,
        codec: (params.codec as 'aac' | 'mp3' | 'wav' | 'flac' | 'opus') || 'mp3'
      })
      return { outputFiles: res.succeeded.map((s) => s.output) }
    }
    case 'zip-create': {
      const targetZip = `${opDir}/archive.zip`
      await window.stash.archives.createZip({ paths: files, targetZip })
      return { outputFiles: [targetZip] }
    }
    case 'zip-extract': {
      await window.stash.archives.extractZip({ zipPath: files[0], outputDir: opDir })
      const list = await window.stash.files.listDir(opDir)
      const extractedPaths = list.entries.map((e) => `${opDir}/${e.name}`)
      return { outputFiles: extractedPaths }
    }
    default: {
      return {
        outputFiles: files,
        outputText: producesText ? text : undefined
      }
    }
  }
}

/**
 * Executes a single tool in workflow execution mode.
 * Invokes real backend processing via window.stash in desktop mode,
 * custom registered executor, or fallback in unit test environments.
 */
export async function executeStep(
  toolId: string,
  files: string[],
  text: string,
  params: Record<string, unknown>,
  options?: { outputDir?: string }
): Promise<{ outputFiles: string[]; outputText?: string }> {
  if (typeof window !== 'undefined' && window.stash) {
    return executeWithStash(toolId, files, text, params, options)
  }

  if (customExecutor) {
    return customExecutor(toolId, files, text, params, options)
  }

  // Fallback for headless environments without StashBridge or registered executor
  await new Promise((r) => setTimeout(r, 10))
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
    outputDir?: string
  }
): Promise<WorkflowExecutionResult> {
  const startTime = Date.now()
  // Saved/imported graphs bypass wire gestures: validate before any callbacks
  // or processing. Never silently run a connection the canvas would reject.
  const auditedNodes = new Map<string, ToolDefinition>()
  for (const node of graph.nodes) {
    if (auditedNodes.has(node.id)) throw new Error(`Duplicate workflow node: ${node.id}`)
    const tool = toolRegistry.get(node.toolId)
    if (!tool) throw new Error(`Unknown workflow tool: ${node.toolId}`)
    auditedNodes.set(node.id, tool)
  }
  for (const edge of graph.edges) {
    const from = auditedNodes.get(edge.fromNodeId)
    const to = auditedNodes.get(edge.toNodeId)
    if (!from || !to) throw new Error(`Workflow edge ${edge.id} references a missing node.`)
    if (!['files', 'text'].includes(edge.fromPort) || !['files', 'text'].includes(edge.toPort)) {
      throw new Error(`Unsupported workflow port on edge ${edge.id}.`)
    }
    const validation = validateEdge(from, to, edge.fromPort, edge.toPort)
    if (!validation.valid) throw new Error(validation.reason ?? 'Incompatible workflow edge.')
  }
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
        node.params,
        { outputDir: callbacks?.outputDir }
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
