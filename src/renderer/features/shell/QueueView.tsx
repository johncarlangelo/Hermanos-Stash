import { useEffect, useMemo, useState } from 'react'
import { GitFork, Play, Wrench, Workflow } from 'lucide-react'
import { useQueueStore } from '../../stores/queue'
import { useNav } from '../../stores/nav'
import { useWorkspace } from '../../stores/workspace'
import { Badge } from '../../components/ui/badge'
import { QueueRunner } from './QueueRunner'
import { QueueBuilder } from './QueueBuilder'
import { WorkflowCanvas } from '../workflow/WorkflowCanvas'
import { stepsToWorkflowGraph } from '../workflow/layout'
import type { WorkflowGraph } from '../workflow/types'
import { QUEUE_WORKFLOW_VERSION } from '../workflow/version'

type QueueTab = 'workflow' | 'runner' | 'builder'

/**
 * QueueView — workstation hosting the Visual Workflow View,
 * Queue Pipeline Runner, and Queue Builder.
 */
export function QueueView() {
  const view = useNav((s) => s.view)
  const { initialize, presets } = useQueueStore()
  const setSidebarCollapsed = useWorkspace((s) => s.setSidebarCollapsed)

  const presetIdFromNav = view.type === 'queue' ? view.presetId : undefined
  const [activeTab, setActiveTab] = useState<QueueTab>('workflow')
  const [activePresetId, setActivePresetId] = useState<string | undefined>(presetIdFromNav)

  // Auto-collapse the sidebar on mount for full-screen workflow workstation experience
  useEffect(() => {
    setSidebarCollapsed(true)
  }, [setSidebarCollapsed])

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (presetIdFromNav) {
      setActivePresetId(presetIdFromNav)
    }
  }, [presetIdFromNav])

  // Derive initial graph if a preset was passed through navigation
  const initialGraph = useMemo<WorkflowGraph | undefined>(() => {
    if (!activePresetId) return undefined
    const preset = presets.find((p) => p.id === activePresetId)
    if (!preset) return undefined
    if (preset.graph) return preset.graph
    if (preset.steps && preset.steps.length > 0) {
      return stepsToWorkflowGraph(preset.steps)
    }
    return undefined
  }, [activePresetId, presets])

  // If in Visual Workflow Studio mode, render full-screen edge-to-edge canvas
  if (activeTab === 'workflow') {
    return (
      <div className="relative h-full w-full overflow-hidden flex flex-col">
        <WorkflowCanvas
          initialGraph={initialGraph}
          onSwitchToLinearView={() => setActiveTab('runner')}
        />
      </div>
    )
  }

  // Linear Runner & Builder mode
  return (
    <div className="mx-auto w-full max-w-6xl 2xl:max-w-7xl px-6 sm:px-8 py-8 space-y-7 overflow-y-auto h-full">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-raised/80 shadow-[0_0_24px_-8px_var(--color-accent-glow)]">
            <GitFork size={22} className="text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                Batch Pipeline & Queue
              </h1>
              <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-400 tracking-wider uppercase">
                BETA
              </span>
              <span className="rounded bg-base/80 border border-line px-1.5 py-0.5 font-mono text-[9px] font-semibold text-dim tracking-wider">
                v{QUEUE_WORKFLOW_VERSION}
              </span>
              <Badge
                variant="outline"
                className="border-accent/40 text-accent font-mono text-[10px]"
              >
                LINEAR RUNNER
              </Badge>
            </div>
            <p className="text-[13px] text-dim mt-0.5">
              Sequential multi-tool execution runner and rule-based builder.
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center rounded-lg border border-line bg-surface/80 p-0.5 backdrop-blur-sm self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('workflow')}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium text-dim hover:text-ink hover:bg-raised/50 transition-all"
          >
            <Workflow size={13} className="text-accent" />
            Visual Studio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('runner')}
            className={`flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'runner'
                ? 'bg-accent text-base shadow-sm font-semibold'
                : 'text-dim hover:text-ink hover:bg-raised/50'
            }`}
          >
            <Play size={13} className={activeTab === 'runner' ? 'fill-current' : ''} aria-hidden />
            Runner
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === 'builder'
                ? 'bg-accent text-base shadow-sm font-semibold'
                : 'text-dim hover:text-ink hover:bg-raised/50'
            }`}
          >
            <Wrench size={13} aria-hidden />
            Builder
            {presets.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                  activeTab === 'builder' ? 'bg-base/30 text-base' : 'bg-raised text-faint'
                }`}
              >
                {presets.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div>
        {activeTab === 'runner' ? (
          <QueueRunner
            initialPresetId={activePresetId}
            onEditPreset={(id) => {
              setActivePresetId(id)
              setActiveTab('builder')
            }}
          />
        ) : (
          <QueueBuilder
            initialPresetId={activePresetId}
            onRunPreset={(id) => {
              setActivePresetId(id)
              setActiveTab('runner')
            }}
          />
        )}
      </div>
    </div>
  )
}

export default QueueView
