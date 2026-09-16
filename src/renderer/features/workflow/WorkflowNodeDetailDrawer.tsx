import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  FileCode,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Sliders,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { getCategory } from '../../../shared/constants/categories'
import { getIcon } from '../../components/icons'
import { executeStep } from './execution'
import type { WorkflowGraph, WorkflowNode } from './types'

interface WorkflowNodeDetailDrawerProps {
  open: boolean
  nodeId: string | null
  graph: WorkflowGraph
  onClose: () => void
  onUpdateLabel: (nodeId: string, customLabel: string) => void
  onUpdateParams: (nodeId: string, params: Record<string, unknown>) => void
  onUpdateInputs: (nodeId: string, updates: { inputFiles?: string[]; inputText?: string }) => void
  onDisconnectEdge: (edgeId: string) => void
}

export function WorkflowNodeDetailDrawer({
  open,
  nodeId,
  graph,
  onClose,
  onUpdateLabel,
  onUpdateParams,
  onUpdateInputs,
  onDisconnectEdge
}: WorkflowNodeDetailDrawerProps) {
  const node: WorkflowNode | undefined = useMemo(() => {
    if (!nodeId) return undefined
    return graph.nodes.find((n) => n.id === nodeId)
  }, [graph.nodes, nodeId])

  const tool = useMemo(() => {
    if (!node) return undefined
    return toolRegistry.get(node.toolId)
  }, [node])

  const category = useMemo(() => {
    if (!tool) return undefined
    return getCategory(tool.category)
  }, [tool])

  const Icon = tool ? getIcon(tool.icon) : Sliders

  // Local state for label editing
  const nodeLabel = node?.customLabel || tool?.name || node?.toolId || ''
  const [labelDraft, setLabelDraft] = useState(nodeLabel)
  useEffect(() => {
    setLabelDraft(nodeLabel)
  }, [node?.id, nodeLabel])

  // Single step isolated testing state
  const [isTestingStep, setIsTestingStep] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    durationMs: number
    outputFiles: string[]
    outputText?: string
    error?: string
  } | null>(null)

  // Incoming and outgoing edges for wiring topology
  const incomingEdges = useMemo(() => {
    if (!nodeId) return []
    return graph.edges.filter((e) => e.toNodeId === nodeId)
  }, [graph.edges, nodeId])

  const outgoingEdges = useMemo(() => {
    if (!nodeId) return []
    return graph.edges.filter((e) => e.fromNodeId === nodeId)
  }, [graph.edges, nodeId])

  const hasIncomingFileEdge = incomingEdges.some((e) => e.fromPort === 'files')
  const hasIncomingTextEdge = incomingEdges.some((e) => e.fromPort === 'text')

  if (!node || !tool) {
    return null
  }

  const acceptsFiles = tool.capabilities.acceptsFiles
  const acceptsText = tool.capabilities.acceptsText
  const producesFiles = tool.capabilities.producesFiles
  const producesText = tool.capabilities.producesText

  // Node params
  const params = node.params || {}

  const handleParamChange = (key: string, value: unknown) => {
    onUpdateParams(node.id, {
      ...params,
      [key]: value
    })
  }

  const handleSaveLabel = () => {
    const trimmed = labelDraft.trim()
    if (trimmed && trimmed !== (node.customLabel || tool.name)) {
      onUpdateLabel(node.id, trimmed)
    }
  }

  // File management
  const handlePickFiles = async () => {
    if (window.stash?.dialogs?.openFile) {
      try {
        const res = await window.stash.dialogs.openFile({
          title: `Select files for ${tool.name}`,
          multiSelections: true
        })
        if (!res.cancelled && res.paths.length > 0) {
          const combined = Array.from(new Set([...(node.inputFiles || []), ...res.paths]))
          onUpdateInputs(node.id, { inputFiles: combined })
        }
      } catch (err) {
        console.warn('Failed to pick files', err)
      }
    }
  }

  const handleRemoveFile = (filePath: string) => {
    const next = (node.inputFiles || []).filter((f) => f !== filePath)
    onUpdateInputs(node.id, { inputFiles: next })
  }

  const handleClearAllFiles = () => {
    onUpdateInputs(node.id, { inputFiles: [] })
  }

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const paths = files
      .map((f) => {
        if (window.stash?.files?.getPathForFile) {
          return window.stash.files.getPathForFile(f)
        }
        return (f as unknown as { path?: string }).path || ''
      })
      .filter(Boolean)

    if (paths.length > 0) {
      const combined = Array.from(new Set([...(node.inputFiles || []), ...paths]))
      onUpdateInputs(node.id, { inputFiles: combined })
    }
  }

  // Isolated step test runner
  const handleTestStep = async () => {
    const effectiveFiles = node.inputFiles || []
    const effectiveText = node.inputText || ''

    if (acceptsFiles && effectiveFiles.length === 0) {
      setTestResult({
        success: false,
        durationMs: 0,
        outputFiles: [],
        error: `"${node.customLabel || tool.name}" requires input file(s) to run. Please attach files above.`
      })
      return
    }

    if (acceptsText && !acceptsFiles && !effectiveText.trim()) {
      setTestResult({
        success: false,
        durationMs: 0,
        outputFiles: [],
        error: `"${node.customLabel || tool.name}" requires text input to run. Please enter a text payload above.`
      })
      return
    }

    setIsTestingStep(true)
    setTestResult(null)
    const startTime = Date.now()

    try {
      const { outputFiles, outputText } = await executeStep(
        node.toolId,
        effectiveFiles,
        effectiveText,
        params
      )

      const durationMs = Date.now() - startTime
      setTestResult({
        success: true,
        durationMs,
        outputFiles,
        outputText
      })
    } catch (err) {
      setTestResult({
        success: false,
        durationMs: Date.now() - startTime,
        outputFiles: [],
        error: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setIsTestingStep(false)
    }
  }

  return (
    <div
      className={`absolute top-16 right-4 bottom-6 z-40 flex w-104 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-line-strong bg-shell/95 shadow-2xl backdrop-blur-xl transition-all duration-200 ease-out transform ${
        open
          ? 'translate-x-0 opacity-100 pointer-events-auto scale-100'
          : 'translate-x-12 opacity-0 pointer-events-none scale-95'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-surface/60 rounded-t-xl shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-base text-accent">
            <Icon size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={handleSaveLabel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
                title="Click to rename node"
                placeholder="Node name..."
                className="w-48 bg-transparent text-xs font-bold text-ink hover:bg-raised/40 focus:bg-base focus:border focus:border-accent rounded px-1 py-0.5 outline-none transition-colors truncate"
              />
            </div>
            <div className="flex items-center gap-2 px-1">
              <span className="font-mono text-[9px] text-faint uppercase">
                {category?.label || tool.category}
              </span>
              <span className="text-[9px] text-faint">•</span>
              <span className="font-mono text-[9px] text-faint truncate max-w-[120px]">
                {tool.id}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-faint hover:text-ink hover:bg-surface transition-colors"
            title="Close node inspector"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Description & Capabilities */}
        <div className="rounded-lg border border-line/70 bg-surface/40 p-3 space-y-2">
          <p className="text-[11.5px] text-dim leading-relaxed">{tool.description}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {acceptsFiles && (
              <span className="rounded bg-base px-2 py-0.5 font-mono text-[9px] text-accent border border-accent/20">
                IN: files
              </span>
            )}
            {acceptsText && (
              <span className="rounded bg-base px-2 py-0.5 font-mono text-[9px] text-accent border border-accent/20">
                IN: text
              </span>
            )}
            {producesFiles && (
              <span className="rounded bg-base px-2 py-0.5 font-mono text-[9px] text-success border border-success/20">
                OUT: files
              </span>
            )}
            {producesText && (
              <span className="rounded bg-base px-2 py-0.5 font-mono text-[9px] text-success border border-success/20">
                OUT: text
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Tool Parameters Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-ink font-semibold">
              <Sliders size={13} className="text-accent" />
              <span>Tool Parameters</span>
            </div>
            <span className="text-[10px] font-mono text-faint">node.params</span>
          </div>

          <div className="rounded-lg border border-line/80 bg-surface/30 p-3 space-y-3.5">
            {/* Image Tool Options */}
            {(tool.category === 'images' || tool.id.includes('image')) && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-dim">Output Quality</span>
                    <span className="font-mono text-accent">
                      {((params.quality as number) || 85)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={(params.quality as number) || 85}
                    onChange={(e) => handleParamChange('quality', Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer h-1.5 rounded-lg bg-line"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-dim">Output Format</label>
                  <select
                    value={(params.format as string) || 'original'}
                    onChange={(e) => handleParamChange('format', e.target.value)}
                    className="rounded border border-line bg-base px-2 py-1 text-[11px] text-ink outline-none cursor-pointer hover:border-line-strong"
                  >
                    <option value="original">Original Format</option>
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                    <option value="webp">WebP</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-dim">Max Width (px)</label>
                    <input
                      type="number"
                      placeholder="Auto"
                      value={(params.maxWidth as number) || ''}
                      onChange={(e) =>
                        handleParamChange(
                          'maxWidth',
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                      className="w-full rounded border border-line bg-base px-2 py-1 text-[11px] text-ink outline-none focus:border-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-dim">Max Height (px)</label>
                    <input
                      type="number"
                      placeholder="Auto"
                      value={(params.maxHeight as number) || ''}
                      onChange={(e) =>
                        handleParamChange(
                          'maxHeight',
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                      className="w-full rounded border border-line bg-base px-2 py-1 text-[11px] text-ink outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </>
            )}

            {/* PDF Tool Options */}
            {(tool.category === 'documents' || tool.id.includes('pdf')) && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] text-dim">Page Ranges (e.g. 1-3, 5, 8-10)</label>
                  <input
                    type="text"
                    placeholder="all"
                    value={(params.pageRanges as string) || ''}
                    onChange={(e) => handleParamChange('pageRanges', e.target.value)}
                    className="w-full rounded border border-line bg-base px-2 py-1 text-[11px] text-ink font-mono outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-dim">Watermark Text (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. CONFIDENTIAL"
                    value={(params.watermark as string) || ''}
                    onChange={(e) => handleParamChange('watermark', e.target.value)}
                    className="w-full rounded border border-line bg-base px-2 py-1 text-[11px] text-ink outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-dim">Rotation</label>
                  <select
                    value={(params.rotation as number) || 0}
                    onChange={(e) => handleParamChange('rotation', Number(e.target.value))}
                    className="rounded border border-line bg-base px-2 py-1 text-[11px] text-ink outline-none cursor-pointer hover:border-line-strong"
                  >
                    <option value={0}>0° (Default)</option>
                    <option value={90}>90° Clockwise</option>
                    <option value={180}>180° Flip</option>
                    <option value={270}>270° Counter-clockwise</option>
                  </select>
                </div>
              </>
            )}

            {/* Text / Developer / Converter Tool Options */}
            {(tool.category === 'text' ||
              tool.category === 'developer' ||
              tool.id.includes('hash') ||
              tool.id.includes('uuid')) && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-dim">Casing / Transform</label>
                  <select
                    value={(params.caseMode as string) || 'preserve'}
                    onChange={(e) => handleParamChange('caseMode', e.target.value)}
                    className="rounded border border-line bg-base px-2 py-1 text-[11px] text-ink outline-none cursor-pointer hover:border-line-strong"
                  >
                    <option value="preserve">Preserve As-Is</option>
                    <option value="lowercase">lowercase</option>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="titlecase">Title Case</option>
                    <option value="camelcase">camelCase</option>
                    <option value="snakecase">snake_case</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-dim">Indentation</label>
                  <select
                    value={(params.indent as number) || 2}
                    onChange={(e) => handleParamChange('indent', Number(e.target.value))}
                    className="rounded border border-line bg-base px-2 py-1 text-[11px] text-ink outline-none cursor-pointer hover:border-line-strong"
                  >
                    <option value={2}>2 Spaces</option>
                    <option value={4}>4 Spaces</option>
                    <option value={1}>1 Tab</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-dim select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(params.trimWhitespace)}
                    onChange={(e) => handleParamChange('trimWhitespace', e.target.checked)}
                    className="accent-accent"
                  />
                  <span>Trim leading & trailing whitespace</span>
                </label>
              </>
            )}

            {/* Universal execution flags */}
            <div className="pt-2 border-t border-line/50 flex items-center justify-between text-[11px]">
              <span className="text-dim">Pass-through on empty input</span>
              <input
                type="checkbox"
                checked={Boolean(params.allowEmpty)}
                onChange={(e) => handleParamChange('allowEmpty', e.target.checked)}
                className="accent-accent cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Input Assets & Payloads */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-ink font-semibold">
            <div className="flex items-center gap-1.5">
              <FileCode size={13} className="text-accent" />
              <span>Input Payloads & Files</span>
            </div>
            {acceptsFiles && (node.inputFiles?.length ?? 0) > 0 && (
              <button
                type="button"
                onClick={handleClearAllFiles}
                className="text-[10px] text-danger hover:underline cursor-pointer"
              >
                Clear all ({node.inputFiles!.length})
              </button>
            )}
          </div>

          {/* Files section */}
          {acceptsFiles && (
            <div className="space-y-2">
              {hasIncomingFileEdge && (
                <div className="rounded border border-line/60 bg-base/50 p-2 text-[11px] text-dim flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>
                    Receiving files automatically from upstream wired node during pipeline runs.
                  </span>
                </div>
              )}

              {/* Direct Attached Files */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropFiles}
                className="rounded-lg border border-dashed border-line p-3 bg-surface/20 space-y-2"
              >
                {(node.inputFiles || []).length === 0 ? (
                  <div className="text-center py-2 space-y-1">
                    <UploadCloud size={20} className="mx-auto text-faint" />
                    <p className="text-[11px] text-dim">
                      Drag and drop files here, or pick directly
                    </p>
                    <button
                      type="button"
                      onClick={handlePickFiles}
                      className="mt-1 inline-flex items-center gap-1 rounded bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink border border-line hover:bg-raised transition-colors cursor-pointer"
                    >
                      <Plus size={11} /> Browse Files
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-faint">
                        Attached Files ({node.inputFiles!.length})
                      </span>
                      <button
                        type="button"
                        onClick={handlePickFiles}
                        className="text-[10px] text-accent hover:underline cursor-pointer"
                      >
                        + Add More
                      </button>
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                      {node.inputFiles!.map((f) => {
                        const name = f.split(/[/\\]/).pop() || f
                        return (
                          <div
                            key={f}
                            className="flex items-center justify-between rounded bg-base/80 border border-line px-2 py-1 text-[11px] text-ink"
                          >
                            <span className="truncate max-w-[240px]" title={f}>
                              {name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(f)}
                              className="text-faint hover:text-danger cursor-pointer ml-1"
                              title="Remove file"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Text Payload Section */}
          {acceptsText && (
            <div className="space-y-1.5">
              {hasIncomingTextEdge && (
                <div className="rounded border border-line/60 bg-base/50 p-2 text-[11px] text-dim flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  <span>
                    Receiving text automatically from upstream wired node during pipeline runs.
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-[11px]">
                <label className="text-dim">Direct Text Payload</label>
                <span className="font-mono text-[10px] text-faint">
                  {(node.inputText || '').length} chars
                </span>
              </div>
              <textarea
                rows={3}
                value={node.inputText || ''}
                onChange={(e) => onUpdateInputs(node.id, { inputText: e.target.value })}
                placeholder="Enter raw text, JSON, or template string for this step..."
                className="w-full rounded-lg border border-line bg-base p-2 font-mono text-[11px] text-ink outline-none focus:border-accent resize-y"
              />
            </div>
          )}
        </div>

        {/* Pipeline Wiring Topology */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-ink font-semibold">
            <div className="flex items-center gap-1.5">
              <Layers size={13} className="text-accent" />
              <span>Wiring Topology</span>
            </div>
            <span className="text-[10px] font-mono text-faint">
              {incomingEdges.length} in • {outgoingEdges.length} out
            </span>
          </div>

          <div className="space-y-2">
            {/* Upstream links */}
            <div className="rounded-lg border border-line/80 bg-surface/30 p-2.5 space-y-1.5">
              <span className="text-[10px] font-semibold text-faint uppercase tracking-wider flex items-center gap-1">
                <ArrowDownRight size={12} className="text-accent" /> Upstream Sources
              </span>
              {incomingEdges.length === 0 ? (
                <p className="text-[11px] text-faint italic">
                  No upstream connections. This node functions as a pipeline root.
                </p>
              ) : (
                incomingEdges.map((e) => {
                  const sourceNode = graph.nodes.find((n) => n.id === e.fromNodeId)
                  const sourceTool = sourceNode ? toolRegistry.get(sourceNode.toolId) : null
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded bg-base/80 border border-line px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-ink truncate">
                          {sourceNode?.customLabel || sourceTool?.name || e.fromNodeId}
                        </span>
                        <span className="font-mono text-[9px] text-accent rounded bg-accent/10 px-1 py-0.2">
                          {e.fromPort}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDisconnectEdge(e.id)}
                        className="flex items-center gap-1 text-[10px] text-danger hover:underline cursor-pointer ml-2"
                        title="Disconnect cable"
                      >
                        <Trash2 size={10} /> Disconnect
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Downstream targets */}
            <div className="rounded-lg border border-line/80 bg-surface/30 p-2.5 space-y-1.5">
              <span className="text-[10px] font-semibold text-faint uppercase tracking-wider flex items-center gap-1">
                <ArrowUpRight size={12} className="text-success" /> Downstream Targets
              </span>
              {outgoingEdges.length === 0 ? (
                <p className="text-[11px] text-faint italic">
                  No downstream connections. Output delivers directly to final results.
                </p>
              ) : (
                outgoingEdges.map((e) => {
                  const targetNode = graph.nodes.find((n) => n.id === e.toNodeId)
                  const targetTool = targetNode ? toolRegistry.get(targetNode.toolId) : null
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded bg-base/80 border border-line px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-ink truncate">
                          {targetNode?.customLabel || targetTool?.name || e.toNodeId}
                        </span>
                        <span className="font-mono text-[9px] text-success rounded bg-success/10 px-1 py-0.2">
                          {e.toPort}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDisconnectEdge(e.id)}
                        className="flex items-center gap-1 text-[10px] text-danger hover:underline cursor-pointer ml-2"
                        title="Disconnect cable"
                      >
                        <Trash2 size={10} /> Disconnect
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Isolated Step Test Runner */}
        <div className="space-y-3 pt-2 border-t border-line/60">
          <div className="flex items-center justify-between">
            <span className="text-ink font-semibold flex items-center gap-1.5">
              <Play size={13} className="text-accent" />
              <span>Isolated Step Test</span>
            </span>
            <button
              type="button"
              disabled={isTestingStep}
              onClick={handleTestStep}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-base shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
            >
              {isTestingStep ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play size={12} />
                  Test Step
                </>
              )}
            </button>
          </div>

          {/* Test Results Banner */}
          {testResult && (
            <div
              className={`rounded-lg border p-3 space-y-2 text-[11px] ${
                testResult.success
                  ? 'border-success/40 bg-success/10 text-ink'
                  : 'border-danger/40 bg-danger/10 text-ink'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 size={14} className="text-success" />
                      <span>Step Executed Successfully</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={14} className="text-danger" />
                      <span>Step Failed</span>
                    </>
                  )}
                </div>
                <span className="font-mono text-[10px] text-faint">
                  {testResult.durationMs}ms
                </span>
              </div>

              {testResult.error && (
                <p className="text-danger font-mono text-[10px] break-all">{testResult.error}</p>
              )}

              {testResult.outputFiles.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-dim font-medium">
                    Output Files ({testResult.outputFiles.length}):
                  </span>
                  <div className="max-h-20 overflow-y-auto space-y-1 font-mono text-[10px] text-ink">
                    {testResult.outputFiles.map((f) => (
                      <div key={f} className="truncate bg-base/60 rounded px-1.5 py-0.5" title={f}>
                        {f.split(/[/\\]/).pop()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {testResult.outputText && (
                <div className="space-y-1">
                  <span className="text-[10px] text-dim font-medium">Output Text:</span>
                  <pre className="max-h-20 overflow-y-auto rounded bg-base/60 p-1.5 font-mono text-[10px] text-ink whitespace-pre-wrap break-all">
                    {testResult.outputText}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
