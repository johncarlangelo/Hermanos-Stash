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
import {
  DEFAULT_NUMBERING_CONFIG,
  stampPdfPageNumbers,
  type NumberPosition,
  type NumberingFormat,
  type PdfNumberingConfig
} from '../../tools/pdf-numberer/logic'
import {
  DEFAULT_WATERMARK_CONFIG,
  stampPdfWatermark,
  type PdfWatermarkConfig
} from '../../tools/pdf-watermark/logic'
import { formatJson, type JsonIndent } from '../../tools/json-format/logic'
import { convertCase, type CaseKind } from '../../tools/case-converter/logic'
import { encodeBase64Utf8, decodeBase64Utf8 } from '../../tools/base64/logic'
import { yamlToJson, jsonToYaml } from '../../tools/yaml-json/logic'
import { csvToJson, jsonToCsv, type CsvDelimiter } from '../../tools/csv-json/logic'

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
) => Promise<{ outputFiles: string[]; outputText?: string; opDir?: string; isTemp?: boolean }>

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
): Promise<{ outputFiles: string[]; outputText?: string; opDir?: string; isTemp?: boolean }> {
  const toolDef = toolRegistry.get(toolId)
  const producesFiles = toolDef ? toolDef.capabilities.producesFiles : true
  const producesText = toolDef ? toolDef.capabilities.producesText : false

  // Analysis / inspection / text-producing tools that consume files or text but output text
  if (!producesFiles) {
    if (toolId === 'file-metadata' && files[0]) {
      const stat = await window.stash.fs.stat(files[0])
      return {
        outputFiles: [],
        outputText: `File: ${stat.name}\nSize: ${stat.sizeBytes} bytes\nExtension: ${stat.extension}\nModified: ${new Date(stat.modifiedAtMs).toLocaleString()}`,
        isTemp: false
      }
    }
    if (toolId === 'hash-generator') {
      const algo =
        ((params.algorithm ?? params.algo) as 'sha256' | 'sha512' | 'md5' | 'sha1') || 'sha256'
      if (files.length > 0) {
        const lines: string[] = []
        for (const file of files) {
          const res = await window.stash.crypto.hashFile({ path: file, algorithm: algo })
          const name = file.split(/[\\/]/).pop() || file
          lines.push(`${res.hex}  ${name}`)
        }
        return {
          outputFiles: [],
          outputText: lines.join('\n'),
          isTemp: false
        }
      }
      if (text) {
        const res = await window.stash.crypto.hashText({ text, algorithm: algo })
        return {
          outputFiles: [],
          outputText: res.hex,
          isTemp: false
        }
      }
    }
    if (toolId === 'image-ocr' && files[0]) {
      const res = await window.stash.processing.ocrImage({ path: files[0] })
      return {
        outputFiles: [],
        outputText: res.text,
        isTemp: false
      }
    }
    if ((toolId === 'case-converter' || toolId === 'text-cases') && text) {
      let mode = ((params.caseMode ?? params.mode ?? params.casing) as string) || 'upper'
      if (mode === 'uppercase') mode = 'upper'
      if (mode === 'lowercase') mode = 'lower'
      return { outputFiles: [], outputText: convertCase(text, mode as CaseKind), isTemp: false }
    }
    if (toolId === 'json-format' && text) {
      const mode = (params.mode as string) || 'pretty'
      const rawIndent = params.indent ?? params.indentChoice
      const indent: JsonIndent =
        mode === 'minify'
          ? 'minify'
          : rawIndent === 1 || rawIndent === '\t'
            ? '\t'
            : typeof rawIndent === 'number'
              ? rawIndent
              : 2
      const res = formatJson(text, indent)
      return {
        outputFiles: [],
        outputText: res.ok ? res.output : text,
        isTemp: false
      }
    }
    if (toolId === 'base64-codec' && text) {
      const mode = (params.direction ?? params.mode) === 'decode' ? 'decode' : 'encode'
      const res = mode === 'decode' ? decodeBase64Utf8(text) : encodeBase64Utf8(text)
      return {
        outputFiles: [],
        outputText: res.ok ? res.output : text,
        isTemp: false
      }
    }
    if (toolId === 'yaml-json' && text) {
      const dir = (params.direction as string) || 'yaml-to-json'
      const res = dir === 'json-to-yaml' ? jsonToYaml(text) : yamlToJson(text)
      return {
        outputFiles: [],
        outputText: res.ok ? res.output : text,
        isTemp: false
      }
    }
    if (toolId === 'csv-json' && text) {
      const dir = (params.direction as string) || 'csv-to-json'
      const delimiter = ((params.delimiter as string) || ',') as CsvDelimiter
      const headerRow = params.headerRow !== false
      const res =
        dir === 'json-to-csv'
          ? jsonToCsv(text, { delimiter, headerRow })
          : csvToJson(text, { delimiter, headerRow })
      return {
        outputFiles: [],
        outputText: res.ok ? res.output : text,
        isTemp: false
      }
    }
    const outputText =
      producesText && text.trim().length > 0
        ? `Processed by ${toolDef?.name ?? toolId}:\n${text}`
        : undefined
    return { outputFiles: [], outputText, isTemp: false }
  }

  // File-producing tool without inputs
  if (files.length === 0) {
    return { outputFiles: [], outputText: undefined, isTemp: false }
  }

  const isCustomDir = Boolean(options?.outputDir)
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
      return { outputFiles: res.succeeded.map((s) => s.output), opDir, isTemp: !isCustomDir }
    }
    case 'image-compress': {
      const quality = typeof params.quality === 'number' ? params.quality : 75
      const maxDimension =
        typeof params.maxDimension === 'number' && params.maxDimension > 0
          ? params.maxDimension
          : undefined
      const res = await window.stash.processing.compressImages({
        paths: files,
        outputDir: opDir,
        quality,
        maxDimension
      })
      return { outputFiles: res.succeeded.map((s) => s.output), opDir, isTemp: !isCustomDir }
    }
    case 'image-watermark': {
      const text = String(
        params.text ??
        params.watermarkText ??
        params.watermark ??
        'Hermanos Stash'
      )
      const position = (params.position as WatermarkPosition) || 'bottom-right'
      const opacity = typeof params.opacity === 'number' ? params.opacity : 0.6
      const fontSize = typeof params.fontSize === 'number' ? params.fontSize : 28
      const color = (params.color as string) || (params.colorHex as string) || undefined
      const res = await window.stash.processing.watermarkImages({
        paths: files,
        outputDir: opDir,
        text,
        position,
        opacity,
        fontSize,
        color
      })
      return { outputFiles: res.succeeded.map((s) => s.output), opDir, isTemp: !isCustomDir }
    }
    case 'social-resizer': {
      const res = await window.stash.processing.socialResize({
        paths: files,
        outputDir: opDir,
        presets: [(params.presetId as string) || 'instagram-square']
      })
      return { outputFiles: res.succeeded.map((s) => s.output), opDir, isTemp: !isCustomDir }
    }
    case 'icon-pack': {
      const res = await window.stash.icons.generatePack({
        path: files[0],
        outputDir: opDir
      })
      return { outputFiles: res.succeeded.map((s) => s.path), opDir, isTemp: !isCustomDir }
    }
    case 'images-to-pdf': {
      const targetPdf = `${opDir}/images-to-pdf.pdf`
      await window.stash.pdfs.imagesToPdf({ paths: files, targetPdf })
      return { outputFiles: [targetPdf], opDir, isTemp: !isCustomDir }
    }
    case 'pdf-merge': {
      const targetPdf = `${opDir}/merged.pdf`
      await window.stash.pdfs.merge({ paths: files, targetPdf })
      return { outputFiles: [targetPdf], opDir, isTemp: !isCustomDir }
    }
    case 'pdf-split': {
      let pageSpec =
        (params.pageSpec as string) ||
        (params.range as string) ||
        (params.pageRanges as string) ||
        '1'
      try {
        const info = await window.stash.pdfs.getInfo(files[0])
        if (pageSpec.includes('-')) {
          const parts = pageSpec.split('-')
          const start = parseInt(parts[0], 10) || 1
          const end = parseInt(parts[1], 10) || info.pageCount
          const clampedStart = Math.min(Math.max(1, start), info.pageCount)
          const clampedEnd = Math.min(Math.max(clampedStart, end), info.pageCount)
          pageSpec =
            clampedStart === clampedEnd ? `${clampedStart}` : `${clampedStart}-${clampedEnd}`
        } else {
          const single = parseInt(pageSpec, 10) || 1
          pageSpec = `${Math.min(Math.max(1, single), info.pageCount)}`
        }
      } catch {
        // Fall back to original pageSpec if getInfo fails
      }
      const res = await window.stash.pdfs.split({
        path: files[0],
        outputDir: opDir,
        pageSpec
      })
      return { outputFiles: res.succeeded.map((s) => s.output), opDir, isTemp: !isCustomDir }
    }
    case 'pdf-numberer': {
      const outputFiles: string[] = []
      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx]
        const base = file.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '') || `numbered-${idx + 1}`
        const targetPdf = `${opDir}/${base}-numbered.pdf`
        const { bytes } = await window.stash.fs.readFileBytes({ path: file })
        const prefix =
          typeof params.batesPrefix === 'string'
            ? params.batesPrefix
            : typeof params.prefix === 'string'
              ? params.prefix
              : 'DOC-'
        const format =
          (params.format as NumberingFormat) ||
          (params.batesPrefix || params.prefix ? 'bates' : DEFAULT_NUMBERING_CONFIG.format)
        const position = (params.position as NumberPosition) || 'bottom-center'
        const batesDigits =
          typeof params.batesDigits === 'number'
            ? params.batesDigits
            : DEFAULT_NUMBERING_CONFIG.batesDigits
        const startNumber =
          typeof params.startNumber === 'number'
            ? params.startNumber
            : typeof params.startingNumber === 'number'
              ? params.startingNumber
              : DEFAULT_NUMBERING_CONFIG.startNumber
        const fontSize =
          typeof params.fontSize === 'number'
            ? params.fontSize
            : DEFAULT_NUMBERING_CONFIG.fontSize
        const colorHex =
          typeof params.colorHex === 'string'
            ? params.colorHex
            : DEFAULT_NUMBERING_CONFIG.colorHex
        const pageRangeText =
          (params.pageRangeText as string) ||
          (params.pageRanges as string) ||
          (params.range as string) ||
          'all'
        const stampedBytes = await stampPdfPageNumbers(bytes, {
          ...DEFAULT_NUMBERING_CONFIG,
          ...(params as Partial<PdfNumberingConfig>),
          format,
          batesPrefix: prefix,
          batesDigits,
          position,
          startNumber,
          fontSize,
          colorHex,
          pageRangeText
        })
        await window.stash.fs.writeFileBytes(
          targetPdf,
          stampedBytes.buffer.slice(
            stampedBytes.byteOffset,
            stampedBytes.byteOffset + stampedBytes.byteLength
          ) as ArrayBuffer
        )
        outputFiles.push(targetPdf)
      }
      return { outputFiles, opDir, isTemp: !isCustomDir }
    }
    case 'pdf-watermark': {
      const outputFiles: string[] = []
      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx]
        const base = file.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '') || `watermarked-${idx + 1}`
        const targetPdf = `${opDir}/${base}-watermarked.pdf`
        const { bytes } = await window.stash.fs.readFileBytes({ path: file })
        const watermarkAlias =
          typeof params.watermark === 'string'
            ? params.watermark
            : typeof params.watermarkText === 'string'
              ? params.watermarkText
              : undefined
        const canonicalText = typeof params.text === 'string' ? params.text : undefined
        const text =
          watermarkAlias &&
          watermarkAlias !== '' &&
          canonicalText &&
          watermarkAlias !== canonicalText &&
          (canonicalText === 'CONFIDENTIAL' || canonicalText === 'STRICTLY PRIVATE')
            ? watermarkAlias
            : canonicalText ?? watermarkAlias ?? 'CONFIDENTIAL'
        const rotationDegrees =
          typeof params.rotationDegrees === 'number'
            ? params.rotationDegrees
            : typeof params.rotation === 'number'
              ? params.rotation
              : DEFAULT_WATERMARK_CONFIG.rotationDegrees
        const fontSize =
          typeof params.fontSize === 'number'
            ? params.fontSize
            : DEFAULT_WATERMARK_CONFIG.fontSize
        const opacity =
          typeof params.opacity === 'number'
            ? params.opacity
            : DEFAULT_WATERMARK_CONFIG.opacity
        const colorHex =
          typeof params.colorHex === 'string'
            ? params.colorHex
            : DEFAULT_WATERMARK_CONFIG.colorHex
        const tiled = Boolean(params.tiled)
        const pageRangeText =
          (params.pageRangeText as string) ||
          (params.pageRanges as string) ||
          (params.range as string) ||
          'all'
        const stampedBytes = await stampPdfWatermark(bytes, {
          ...DEFAULT_WATERMARK_CONFIG,
          ...(params as Partial<PdfWatermarkConfig>),
          text,
          rotationDegrees,
          fontSize,
          opacity,
          colorHex,
          tiled,
          pageRangeText
        })
        await window.stash.fs.writeFileBytes(
          targetPdf,
          stampedBytes.buffer.slice(
            stampedBytes.byteOffset,
            stampedBytes.byteOffset + stampedBytes.byteLength
          ) as ArrayBuffer
        )
        outputFiles.push(targetPdf)
      }
      return { outputFiles, opDir, isTemp: !isCustomDir }
    }
    case 'pdf-rotate': {
      const outputFiles: string[] = []
      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx]
        const base = file.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '') || `rotated-${idx + 1}`
        const targetPdf = `${opDir}/${base}-rotated.pdf`
        const angle =
          (params.angle as 90 | 180 | 270) ||
          (params.rotation as 90 | 180 | 270) ||
          90
        const pageSpec =
          (params.pageSpec as string) ||
          (params.pageRanges as string) ||
          (params.range as string) ||
          'all'
        await window.stash.pdfs.rotate({
          path: file,
          targetPdf,
          angle,
          pageSpec
        })
        outputFiles.push(targetPdf)
      }
      return { outputFiles, opDir, isTemp: !isCustomDir }
    }
    case 'pdf-compress': {
      const outputFiles: string[] = []
      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx]
        const base = file.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '') || `compressed-${idx + 1}`
        const targetPdf = `${opDir}/${base}-compressed.pdf`
        await window.stash.pdfs.compress({ path: file, targetPdf })
        outputFiles.push(targetPdf)
      }
      return { outputFiles, opDir, isTemp: !isCustomDir }
    }
    case 'pdf-reorder': {
      const outputFiles: string[] = []
      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx]
        const base = file.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '') || `reordered-${idx + 1}`
        const targetPdf = `${opDir}/${base}-reordered.pdf`
        await window.stash.pdfs.reorder({
          path: file,
          targetPdf,
          pageSpec: (params.pageSpec as string) || '1'
        })
        outputFiles.push(targetPdf)
      }
      return { outputFiles, opDir, isTemp: !isCustomDir }
    }
    case 'video-convert': {
      const outputFiles: string[] = []
      const crf =
        typeof params.crfQuality === 'number'
          ? params.crfQuality
          : typeof params.crf === 'number'
            ? params.crf
            : 23
      const format = (params.format as 'mp4' | 'webm' | 'mkv') || 'mp4'
      for (const file of files) {
        const res = await window.stash.media.convertVideo({
          path: file,
          outputDir: opDir,
          format,
          crfQuality: crf
        })
        outputFiles.push(...res.succeeded.map((s) => s.output))
      }
      return { outputFiles, opDir, isTemp: !isCustomDir }
    }
    case 'video-compress': {
      const outputFiles: string[] = []
      const crfQuality =
        typeof params.crfQuality === 'number'
          ? params.crfQuality
          : typeof params.crf === 'number'
            ? params.crf
            : 28
      const maxDimension =
        typeof params.maxDimension === 'number' && params.maxDimension > 0
          ? params.maxDimension
          : undefined
      for (const file of files) {
        const res = await window.stash.media.compressVideo({
          path: file,
          outputDir: opDir,
          crfQuality,
          maxDimension
        })
        outputFiles.push(...res.succeeded.map((s) => s.output))
      }
      return { outputFiles, opDir, isTemp: !isCustomDir }
    }
    case 'video-to-gif': {
      const outputFiles: string[] = []
      const fps = typeof params.fps === 'number' ? params.fps : 15
      const maxWidth = typeof params.maxWidth === 'number' ? params.maxWidth : 640
      for (const file of files) {
        const res = await window.stash.media.videoToGif({
          path: file,
          outputDir: opDir,
          fps,
          maxWidth
        })
        outputFiles.push(...res.succeeded.map((s) => s.output))
      }
      return { outputFiles, opDir, isTemp: !isCustomDir }
    }
    case 'extract-audio': {
      const outputFiles: string[] = []
      const codec =
        ((params.format ?? params.codec) as 'aac' | 'mp3' | 'wav' | 'flac' | 'opus') || 'mp3'
      const bitrateKbps = typeof params.bitrateKbps === 'number' ? params.bitrateKbps : undefined
      for (const file of files) {
        const res = await window.stash.media.extractAudio({
          path: file,
          outputDir: opDir,
          codec,
          bitrateKbps
        })
        outputFiles.push(...res.succeeded.map((s) => s.output))
      }
      return { outputFiles, opDir, isTemp: !isCustomDir }
    }
    case 'audio-convert': {
      const outputFiles: string[] = []
      const codec =
        ((params.codec ?? params.format) as 'aac' | 'mp3' | 'wav' | 'flac' | 'opus') || 'mp3'
      const bitrateKbps = typeof params.bitrateKbps === 'number' ? params.bitrateKbps : undefined
      for (const file of files) {
        const res = await window.stash.media.convertAudio({
          path: file,
          outputDir: opDir,
          codec,
          bitrateKbps
        })
        outputFiles.push(...res.succeeded.map((s) => s.output))
      }
      return { outputFiles, opDir, isTemp: !isCustomDir }
    }
    case 'zip-create': {
      const targetZip = `${opDir}/archive.zip`
      await window.stash.archives.createZip({ paths: files, targetZip })
      return { outputFiles: [targetZip], opDir, isTemp: !isCustomDir }
    }
    case 'zip-extract': {
      await window.stash.archives.extractZip({ zipPath: files[0], outputDir: opDir })
      const list = await window.stash.files.listDir(opDir)
      const extractedPaths = list.entries.map((e) => `${opDir}/${e.name}`)
      return { outputFiles: extractedPaths, opDir, isTemp: !isCustomDir }
    }
    default: {
      // For any unhandled or passthrough file-producing tool, copy incoming files to this operation's opDir
      // so downstream steps never reference files in an upstream directory that is about to be purged.
      const copiedOutputs: string[] = []
      for (const f of files) {
        const base = f.split(/[\\/]/).pop() || 'file'
        const dest = `${opDir}/${base}`
        if (f !== dest) {
          try {
            const { bytes } = await window.stash.fs.readFileBytes({ path: f })
            await window.stash.fs.writeFileBytes(dest, bytes)
            copiedOutputs.push(dest)
          } catch {
            copiedOutputs.push(f)
          }
        } else {
          copiedOutputs.push(f)
        }
      }
      return {
        outputFiles: copiedOutputs,
        outputText: producesText ? text : undefined,
        opDir,
        isTemp: !isCustomDir
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
): Promise<{ outputFiles: string[]; outputText?: string; opDir?: string; isTemp?: boolean }> {
  if (customExecutor) {
    return customExecutor(toolId, files, text, params, options)
  }

  // Pure in-memory text transformations do not require Electron IPC or window.stash
  if (text) {
    if (toolId === 'case-converter' || toolId === 'text-cases') {
      let mode = ((params.caseMode ?? params.mode ?? params.casing) as string) || 'upper'
      if (mode === 'uppercase') mode = 'upper'
      if (mode === 'lowercase') mode = 'lower'
      return { outputFiles: [], outputText: convertCase(text, mode as CaseKind), isTemp: false }
    }
    if (toolId === 'json-format') {
      const mode = (params.mode as string) || 'pretty'
      const rawIndent = params.indent ?? params.indentChoice
      const indent: JsonIndent =
        mode === 'minify'
          ? 'minify'
          : rawIndent === 1 || rawIndent === '\t'
            ? '\t'
            : typeof rawIndent === 'number'
              ? rawIndent
              : 2
      const res = formatJson(text, indent)
      return {
        outputFiles: [],
        outputText: res.ok ? res.output : text,
        isTemp: false
      }
    }
    if (toolId === 'base64-codec') {
      const mode = (params.direction ?? params.mode) === 'decode' ? 'decode' : 'encode'
      const res = mode === 'decode' ? decodeBase64Utf8(text) : encodeBase64Utf8(text)
      return {
        outputFiles: [],
        outputText: res.ok ? res.output : text,
        isTemp: false
      }
    }
    if (toolId === 'yaml-json') {
      const dir = (params.direction as string) || 'yaml-to-json'
      const res = dir === 'json-to-yaml' ? jsonToYaml(text) : yamlToJson(text)
      return {
        outputFiles: [],
        outputText: res.ok ? res.output : text,
        isTemp: false
      }
    }
    if (toolId === 'csv-json') {
      const dir = (params.direction as string) || 'csv-to-json'
      const delimiter = ((params.delimiter as string) || ',') as CsvDelimiter
      const headerRow = params.headerRow !== false
      const res =
        dir === 'json-to-csv'
          ? jsonToCsv(text, { delimiter, headerRow })
          : csvToJson(text, { delimiter, headerRow })
      return {
        outputFiles: [],
        outputText: res.ok ? res.output : text,
        isTemp: false
      }
    }
  }

  if (typeof window !== 'undefined' && window.stash) {
    return executeWithStash(toolId, files, text, params, options)
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

  // Track downstream consumers to eagerly clean up intermediate directories
  const remainingConsumers = new Map<string, Set<string>>()
  for (const edge of graph.edges) {
    if (!remainingConsumers.has(edge.fromNodeId)) {
      remainingConsumers.set(edge.fromNodeId, new Set())
    }
    remainingConsumers.get(edge.fromNodeId)!.add(edge.toNodeId)
  }

  const intermediateOpDirs = new Map<string, string>()
  const uncleanedIntermediateDirs = new Set<string>()

  let totalCompleted = 0
  const totalNodes = sortedNodeIds.length

  try {
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
        const { outputFiles, outputText, opDir, isTemp } = await executeStep(
          node.toolId,
          stepInputFiles,
          stepInputText,
          node.params,
          { outputDir: callbacks?.outputDir }
        )

        const nodeDuration = Date.now() - nodeStartTime
        nodeOutputs.set(nodeId, { files: outputFiles, text: outputText })

        // If this is an intermediate node (has downstream consumers) and produced a temp directory,
        // track it for eager cleanup once all consumers finish.
        if (remainingConsumers.has(nodeId) && opDir && isTemp) {
          intermediateOpDirs.set(nodeId, opDir)
          uncleanedIntermediateDirs.add(opDir)
        }

        nodeResults[nodeId] = {
          status: 'success',
          inputFiles: stepInputFiles,
          outputFiles,
          durationMs: nodeDuration
        }

        callbacks?.onNodeSuccess?.(nodeId, outputFiles, nodeDuration)
        totalCompleted++
        callbacks?.onProgress?.(totalCompleted / Math.max(1, totalNodes))

        // Check if any upstream nodes feeding this node now have zero remaining consumers
        for (const edge of inEdges) {
          const upstreamId = edge.fromNodeId
          const consumers = remainingConsumers.get(upstreamId)
          if (consumers) {
            consumers.delete(nodeId)
            if (consumers.size === 0) {
              remainingConsumers.delete(upstreamId)
              const dirToClean = intermediateOpDirs.get(upstreamId)
              if (dirToClean) {
                intermediateOpDirs.delete(upstreamId)
                uncleanedIntermediateDirs.delete(dirToClean)
                if (typeof window !== 'undefined' && window.stash?.temp?.cleanup) {
                  try {
                    await window.stash.temp.cleanup(dirToClean)
                  } catch (cleanupErr) {
                    console.warn(`[Workflow] Eager cleanup failed for ${dirToClean}:`, cleanupErr)
                  }
                }
              }
            }
          }
        }
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
  } finally {
    // Purge any remaining intermediate directories on error or early abort
    if (typeof window !== 'undefined' && window.stash?.temp?.cleanup) {
      for (const dir of uncleanedIntermediateDirs) {
        try {
          await window.stash.temp.cleanup(dir)
        } catch (err) {
          console.warn(`[Workflow] Finally cleanup failed for ${dir}:`, err)
        }
      }
      uncleanedIntermediateDirs.clear()
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
