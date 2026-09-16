import React, { memo } from 'react'
import { AlertCircle, CheckCircle2, Copy, Plus, RefreshCw, Settings2, Sliders, X } from 'lucide-react'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { getIcon } from '../../components/icons'
import { getCategory } from '../../../shared/constants/categories'
import type { PortType, WorkflowNode } from './types'

interface WorkflowNodeCardProps {
  node: WorkflowNode
  selected: boolean
  hasIncomingFileEdge?: boolean
  hasIncomingTextEdge?: boolean
  onSelect: (nodeId: string) => void
  onDelete: (nodeId: string) => void
  onDuplicate: (nodeId: string) => void
  onOpenDetails?: (nodeId: string) => void
  onContextMenu?: (nodeId: string, e: React.MouseEvent) => void
  onUpdateInputs?: (nodeId: string, updates: { inputFiles?: string[]; inputText?: string }) => void
  onStartWire: (
    nodeId: string,
    portType: PortType,
    portDirection: 'out',
    clientPos: { x: number; y: number }
  ) => void
  onEndWire: (nodeId: string, portType: PortType, portDirection: 'in') => void
  onStartDrag: (nodeId: string, e: React.PointerEvent) => void
}

export const WorkflowNodeCard = memo(function WorkflowNodeCard({
  node,
  selected,
  hasIncomingFileEdge = false,
  hasIncomingTextEdge = false,
  onSelect,
  onDelete,
  onDuplicate,
  onOpenDetails,
  onContextMenu,
  onUpdateInputs,
  onStartWire,
  onEndWire,
  onStartDrag
}: WorkflowNodeCardProps) {
  const tool = toolRegistry.get(node.toolId)
  const category = tool ? getCategory(tool.category) : null
  const Icon = tool ? getIcon(tool.icon) : null

  const acceptsFiles = tool?.capabilities.acceptsFiles ?? false
  const acceptsText = tool?.capabilities.acceptsText ?? false
  const producesFiles = tool?.capabilities.producesFiles ?? false
  const producesText = tool?.capabilities.producesText ?? false

  const status = node.status || 'idle'

  const handlePickFiles = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.stash?.dialogs?.openFile) {
      try {
        const res = await window.stash.dialogs.openFile({
          title: `Select files for ${tool?.name || 'tool'}`,
          multiSelections: true
        })
        if (!res.cancelled && res.paths.length > 0) {
          onUpdateInputs?.(node.id, { inputFiles: res.paths })
        }
      } catch (err) {
        console.warn('Failed to open file picker', err)
      }
    }
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
      onUpdateInputs?.(node.id, { inputFiles: paths })
    }
  }

  return (
    <div
      id={`node-${node.id}`}
      data-dropzone="workflow-node"
      style={{
        transform: `translate(${node.position.x}px, ${node.position.y}px)`,
        width: 270
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(node.id)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onOpenDetails?.(node.id)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onContextMenu?.(node.id, e)
      }}
      onDragOver={(e) => {
        if (acceptsFiles && !hasIncomingFileEdge) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onDrop={handleDropFiles}
      className={`absolute pointer-events-auto select-none rounded-xl border transition-all duration-150 backdrop-blur-md ${
        selected
          ? 'border-accent shadow-[0_0_24px_-4px_var(--color-accent-glow)] bg-surface/95 z-20 ring-1 ring-accent'
          : status === 'running'
            ? 'border-accent shadow-[0_0_24px_-4px_var(--color-accent-glow)] bg-surface/95 z-20 ring-1 ring-accent/60'
            : status === 'error'
              ? 'border-danger/80 shadow-[0_0_20px_-6px_rgba(239,68,68,0.4)] bg-surface/90 z-10'
              : 'border-line/70 hover:border-line-strong shadow-md bg-surface/80 z-10'
      }`}
    >
      {/* n8n-style rotating double-arrow execution badge */}
      {status === 'running' && (
        <div
          title="Executing node..."
          className="absolute -top-2.5 -right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-shell border border-accent shadow-[0_0_14px_var(--color-accent-glow)] z-30 ring-2 ring-shell"
        >
          <RefreshCw size={11} className="text-accent animate-spin" />
        </div>
      )}

      {/* Node Header */}
      <div
        onPointerDown={(e) => onStartDrag(node.id, e)}
        className="flex items-center justify-between border-b border-line/50 px-3 py-2 cursor-grab active:cursor-grabbing rounded-t-xl bg-raised/40"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-base/80 text-accent">
            {Icon ? <Icon size={13} /> : <Sliders size={13} />}
          </div>
          <div className="min-w-0">
            <h4 className="text-[12px] font-semibold text-ink truncate">
              {node.customLabel || tool?.name || node.toolId}
            </h4>
            <p className="text-[9.5px] font-mono text-faint uppercase tracking-wider truncate">
              {category?.label ?? tool?.category ?? 'Utility'}
            </p>
          </div>
        </div>

        {/* Quick Node Actions */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {status === 'running' && (
            <span className="flex items-center gap-1 rounded-full bg-accent/15 border border-accent/35 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-accent">
              <RefreshCw size={9} className="animate-spin" />
              RUNNING
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenDetails?.(node.id)
            }}
            title="Configure & inspect node (Double-click)"
            className="cursor-pointer rounded p-1 text-faint hover:text-accent hover:bg-surface transition-colors"
          >
            <Settings2 size={11} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDuplicate(node.id)
            }}
            title="Duplicate node"
            className="cursor-pointer rounded p-1 text-faint hover:text-ink hover:bg-surface transition-colors"
          >
            <Copy size={11} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(node.id)
            }}
            title="Delete node"
            className="cursor-pointer rounded p-1 text-faint hover:text-danger hover:bg-surface transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Node Body with Ports & Dynamic Inputs */}
      <div className="relative px-3 py-2.5 text-xs space-y-2">
        {/* Left Input Ports (Absolute anchored) */}
        <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          {acceptsFiles && (
            <div
              data-port="in-files"
              onPointerUp={(e) => {
                e.stopPropagation()
                onEndWire(node.id, 'files', 'in')
              }}
              className="group/port relative flex h-5 w-5 items-center justify-center rounded-full border border-cyan-500/50 bg-slate-950 text-cyan-400 cursor-crosshair transition-transform hover:scale-125"
              title="Input Port: Files"
            >
              <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
              <span className="pointer-events-none absolute left-6 hidden rounded bg-base/90 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300 shadow group-hover/port:inline-block z-30 whitespace-nowrap">
                In: Files
              </span>
            </div>
          )}

          {acceptsText && (
            <div
              data-port="in-text"
              onPointerUp={(e) => {
                e.stopPropagation()
                onEndWire(node.id, 'text', 'in')
              }}
              className="group/port relative flex h-5 w-5 items-center justify-center rounded-full border border-purple-500/50 bg-slate-950 text-purple-400 cursor-crosshair transition-transform hover:scale-125"
              title="Input Port: Text"
            >
              <div className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_6px_#a855f7]" />
              <span className="pointer-events-none absolute left-6 hidden rounded bg-base/90 px-1.5 py-0.5 text-[9px] font-mono text-purple-300 shadow group-hover/port:inline-block z-30 whitespace-nowrap">
                In: Text
              </span>
            </div>
          )}
        </div>

        {/* Right Output Ports (Absolute anchored) */}
        <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 flex flex-col gap-2">
          {producesFiles && (
            <div
              data-port="out-files"
              onPointerDown={(e) => {
                e.stopPropagation()
                onStartWire(node.id, 'files', 'out', { x: e.clientX, y: e.clientY })
              }}
              className="group/port relative flex h-5 w-5 items-center justify-center rounded-full border border-cyan-500/50 bg-slate-950 text-cyan-400 cursor-crosshair transition-transform hover:scale-125"
              title="Output Port: Files (Drag to connect)"
            >
              <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
              <span className="pointer-events-none absolute right-6 hidden rounded bg-base/90 px-1.5 py-0.5 text-[9px] font-mono text-cyan-300 shadow group-hover/port:inline-block z-30 whitespace-nowrap">
                Out: Files
              </span>
            </div>
          )}

          {producesText && (
            <div
              data-port="out-text"
              onPointerDown={(e) => {
                e.stopPropagation()
                onStartWire(node.id, 'text', 'out', { x: e.clientX, y: e.clientY })
              }}
              className="group/port relative flex h-5 w-5 items-center justify-center rounded-full border border-purple-500/50 bg-slate-950 text-purple-400 cursor-crosshair transition-transform hover:scale-125"
              title="Output Port: Text (Drag to connect)"
            >
              <div className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_6px_#a855f7]" />
              <span className="pointer-events-none absolute right-6 hidden rounded bg-base/90 px-1.5 py-0.5 text-[9px] font-mono text-purple-300 shadow group-hover/port:inline-block z-30 whitespace-nowrap">
                Out: Text
              </span>
            </div>
          )}
        </div>

        {/* Node Center Description */}
        <p className="line-clamp-1 text-[11px] leading-relaxed text-dim">
          {tool?.description ?? 'Local utility tool in pipeline.'}
        </p>

        {/* Input Slots / Status (Item 4: User must supply input if not connected upstream) */}
        {acceptsFiles && (
          <div>
            {hasIncomingFileEdge ? (
              <div className="flex items-center gap-1.5 rounded border border-cyan-500/25 bg-cyan-950/20 px-2 py-1 text-[10px] text-cyan-300 font-mono">
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="truncate">Input: Linked from upstream</span>
              </div>
            ) : (
              <div>
                {node.inputFiles && node.inputFiles.length > 0 ? (
                  <div className="flex items-center justify-between rounded border border-cyan-500/40 bg-cyan-950/30 px-2 py-1 text-[10.5px]">
                    <span
                      className="truncate font-mono text-cyan-200"
                      title={node.inputFiles.join('\n')}
                    >
                      📁 {node.inputFiles.length} file{node.inputFiles.length > 1 ? 's' : ''}{' '}
                      attached
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onUpdateInputs?.(node.id, { inputFiles: [] })
                      }}
                      className="ml-1 cursor-pointer text-cyan-400/70 hover:text-danger transition-colors p-0.5"
                      title="Clear files"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handlePickFiles}
                    className="w-full flex items-center justify-center gap-1.5 rounded border border-dashed border-line-strong hover:border-accent bg-base/60 hover:bg-base/90 px-2 py-1.5 text-[10.5px] text-dim hover:text-ink transition-colors cursor-pointer"
                  >
                    <Plus size={11} className="text-accent" />
                    <span>Attach Input Files</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {acceptsText && !hasIncomingTextEdge && (
          <div>
            <input
              type="text"
              value={node.inputText || ''}
              onChange={(e) => {
                onUpdateInputs?.(node.id, { inputText: e.target.value })
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Enter text input payload…"
              className="w-full rounded border border-line bg-base/70 px-2 py-1 text-[10.5px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>
        )}

        {acceptsText && hasIncomingTextEdge && (
          <div className="flex items-center gap-1.5 rounded border border-purple-500/25 bg-purple-950/20 px-2 py-1 text-[10px] text-purple-300 font-mono">
            <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="truncate">Text: Linked from upstream</span>
          </div>
        )}
      </div>

      {/* Node Status Footer */}
      <div className="flex items-center justify-between border-t border-line/40 px-3 py-1.5 bg-base/30 rounded-b-xl text-[10.5px]">
        {status === 'idle' && (
          <span className="text-faint font-mono text-[10px]">
            {acceptsFiles &&
            !hasIncomingFileEdge &&
            (!node.inputFiles || node.inputFiles.length === 0)
              ? 'Awaiting input'
              : 'Ready'}
          </span>
        )}
        {status === 'running' && (
          <span className="flex items-center gap-1.5 text-accent font-medium font-mono text-[10px]">
            <RefreshCw size={11} className="animate-spin" /> Running…
          </span>
        )}
        {status === 'success' && (
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium font-mono text-[10px]">
            <CheckCircle2 size={11} /> Done {node.durationMs ? `(${node.durationMs}ms)` : ''}
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-center gap-1 text-danger font-medium font-mono text-[10px] truncate max-w-[190px]">
            <AlertCircle size={11} className="shrink-0" /> {node.error || 'Failed'}
          </span>
        )}

        {/* Output Pill */}
        {node.outputFiles && node.outputFiles.length > 0 && (
          <span className="rounded bg-line/60 px-1.5 py-0.2 font-mono text-[9px] text-dim">
            {node.outputFiles.length} {node.outputFiles.length === 1 ? 'file' : 'files'}
          </span>
        )}
      </div>
    </div>
  )
})
