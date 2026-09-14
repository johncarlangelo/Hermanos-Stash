import {
  FolderArchive,
  ListOrdered,
  Maximize2,
  Minus,
  Network,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Workflow
} from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { QUEUE_WORKFLOW_VERSION } from './version'

interface WorkflowToolbarProps {
  workflowName: string
  onRename: (newName: string) => void
  nodeCount: number
  edgeCount: number
  isRunning: boolean
  onRun: () => void
  onToggleToolDrawer: () => void
  onToggleTemplatesDrawer: () => void
  onOpenSaveModal: () => void
  onAutoLayout: () => void
  onFitView: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetZoom: () => void
  zoom: number
  onClearCanvas: () => void
  onSwitchToLinearView?: () => void
}

export function WorkflowToolbar({
  workflowName,
  onRename,
  nodeCount,
  edgeCount,
  isRunning,
  onRun,
  onToggleToolDrawer,
  onToggleTemplatesDrawer,
  onOpenSaveModal,
  onAutoLayout,
  onFitView,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  zoom,
  onClearCanvas,
  onSwitchToLinearView
}: WorkflowToolbarProps) {
  return (
    <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/80 bg-shell/90 px-3.5 py-2 shadow-xl backdrop-blur-md">
      {/* Left section: Workflow Name & Stats */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-raised text-accent">
          <Workflow size={17} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => onRename(e.target.value)}
              placeholder="Untitled Workflow"
              className="bg-transparent font-semibold text-ink text-sm hover:border-line border border-transparent rounded px-1.5 py-0.5 focus:border-accent focus:bg-base/60 focus:outline-none transition-colors truncate max-w-[200px] sm:max-w-xs"
            />
            <Badge
              variant="outline"
              className="border-accent/30 text-accent font-mono text-[9.5px]"
            >
              WORKFLOW VIEW
            </Badge>
            <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-400 tracking-wider uppercase">
              BETA
            </span>
            <span className="rounded bg-base/80 border border-line px-1.5 py-0.5 font-mono text-[9px] font-semibold text-dim tracking-wider">
              v{QUEUE_WORKFLOW_VERSION}
            </span>
          </div>
          <p className="font-mono text-[10px] text-faint ml-1 truncate">
            {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'} · {edgeCount}{' '}
            {edgeCount === 1 ? 'connection' : 'connections'}
          </p>
        </div>
      </div>

      {/* Middle & Right Section: Actions */}
      <div className="flex flex-wrap items-center gap-1.5 ml-auto">
        {/* Run Button */}
        <button
          type="button"
          disabled={isRunning || nodeCount === 0}
          onClick={onRun}
          className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all ${
            isRunning
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'bg-accent text-base hover:opacity-95 disabled:opacity-40 disabled:pointer-events-none'
          }`}
          title="Run entire workflow pipeline"
        >
          {isRunning ? (
            <RefreshCw size={12} className="animate-spin text-amber-300" />
          ) : (
            <Play size={13} className="fill-current" />
          )}
          {isRunning ? 'Running…' : 'Run Pipeline'}
        </button>

        <div className="h-5 w-px bg-line/60 mx-1" />

        {/* Add Tools Drawer Trigger */}
        <button
          type="button"
          onClick={onToggleToolDrawer}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface/70 px-2.5 py-1.5 text-xs font-medium text-ink hover:border-accent hover:text-accent transition-colors"
          title="Open tool palette to drag/drop tools"
        >
          <Plus size={13} /> Tools
        </button>

        {/* Templates Drawer Trigger */}
        <button
          type="button"
          onClick={onToggleTemplatesDrawer}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface/70 px-2.5 py-1.5 text-xs font-medium text-dim hover:text-ink hover:border-line-strong transition-colors"
          title="Browse templates and recipes"
        >
          <FolderArchive size={13} /> Recipes
        </button>

        {/* Save as Template */}
        <button
          type="button"
          disabled={nodeCount === 0}
          onClick={onOpenSaveModal}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface/70 px-2.5 py-1.5 text-xs font-medium text-dim hover:text-ink hover:border-line-strong disabled:opacity-40 disabled:pointer-events-none transition-colors"
          title="Save current workflow as reusable template"
        >
          <Save size={13} /> Save Template
        </button>

        <div className="h-5 w-px bg-line/60 mx-1 hidden sm:block" />

        {/* Auto Layout */}
        <button
          type="button"
          disabled={nodeCount === 0}
          onClick={onAutoLayout}
          className="flex cursor-pointer items-center gap-1 rounded-md border border-line bg-surface/70 p-1.5 text-dim hover:text-ink hover:border-line-strong disabled:opacity-40 transition-colors"
          title="Auto-arrange nodes hierarchically (Left to Right)"
        >
          <Network size={13} />
        </button>

        {/* Fit to View */}
        <button
          type="button"
          onClick={onFitView}
          className="flex cursor-pointer items-center gap-1 rounded-md border border-line bg-surface/70 p-1.5 text-dim hover:text-ink hover:border-line-strong transition-colors"
          title="Fit nodes to screen"
        >
          <Maximize2 size={13} />
        </button>

        {/* Zoom Controls */}
        <div className="flex items-center rounded-md border border-line bg-surface/70 text-dim">
          <button
            type="button"
            onClick={onZoomOut}
            className="cursor-pointer p-1.5 hover:text-ink"
            title="Zoom Out"
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            className="cursor-pointer px-1.5 font-mono text-[10px] text-faint hover:text-ink"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="cursor-pointer p-1.5 hover:text-ink"
            title="Zoom In"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* Clear Canvas */}
        <button
          type="button"
          disabled={nodeCount === 0}
          onClick={onClearCanvas}
          className="cursor-pointer rounded-md border border-line bg-surface/70 p-1.5 text-faint hover:text-danger hover:border-danger/40 disabled:opacity-40 transition-colors"
          title="Clear canvas"
        >
          <Trash2 size={13} />
        </button>

        {/* Switch to Linear View */}
        {onSwitchToLinearView && (
          <>
            <div className="h-5 w-px bg-line/60 mx-1 hidden sm:block" />
            <button
              type="button"
              onClick={onSwitchToLinearView}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-line bg-surface/70 px-2 py-1 text-[11px] font-medium text-dim hover:text-ink hover:border-accent transition-colors"
              title="Switch to Linear Queue Runner / Builder view"
            >
              <ListOrdered size={12} /> Linear View
            </button>
          </>
        )}
      </div>
    </div>
  )
}
