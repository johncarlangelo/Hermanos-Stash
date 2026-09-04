import { useEffect, useMemo, useState } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  Pencil,
  X,
  ArrowRight,
  Workflow,
  Clock
} from 'lucide-react'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '../../components/ui/card'
import { Select } from '../../components/ui/Inputs'
import { toastError, toastSuccess } from '../../stores/toasts'
import { useQueueStore } from '../../stores/queue'
import { validateQueueChain } from '../../../shared/utils/queue-validation'
import { DropZone } from '../../components/ui/DropZone'

interface StepResult {
  step: number
  toolId: string
  toolName: string
  status: 'pending' | 'running' | 'success' | 'error'
  inputFiles: string[]
  outputFiles: string[]
  durationMs?: number
  error?: string
  progress?: number
  currentFile?: string
  startTime?: number
}

interface QueueRunnerProps {
  initialPresetId?: string
  onEditPreset?: (presetId: string) => void
}

export function QueueRunner({ initialPresetId, onEditPreset }: QueueRunnerProps = {}) {
  const presets = useQueueStore((s) => s.presets)
  const lastUsedId = useQueueStore((s) => s.lastUsedId)
  const setLastUsed = useQueueStore((s) => s.setLastUsed)

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(initialPresetId ?? null)

  useEffect(() => {
    if (initialPresetId) {
      setSelectedPresetId(initialPresetId)
    }
  }, [initialPresetId])

  const [inputFiles, setInputFiles] = useState<string[]>([])
  const [stepResults, setStepResults] = useState<StepResult[]>([])
  const [running, setRunning] = useState(false)
  const [aborted, setAborted] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const selectedPreset = presets.find((p) => p.id === selectedPresetId)
  const steps = useMemo(() => selectedPreset?.steps ?? [], [selectedPreset])

  // Validation
  const [validation, setValidation] = useState<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }>({
    valid: true,
    errors: [],
    warnings: []
  })

  useEffect(() => {
    if (steps.length === 0) {
      setValidation({ valid: true, errors: [], warnings: [] })
      return
    }
    const tools = steps
      .map((s) => toolRegistry.get(s.toolId))
      .filter((t): t is ToolDefinition => Boolean(t))
    const result = validateQueueChain(tools)
    setValidation({
      valid: result.valid,
      errors: result.errors.map((e) => e.message),
      warnings: result.warnings.map((w) => w.message)
    })
  }, [steps])

  const handleFilesChange = (files: string[]) => {
    setInputFiles(files)
  }

  const canRun = steps.length > 0 && inputFiles.length > 0 && validation.valid && !running

  const runQueue = async () => {
    if (!canRun) return

    setRunning(true)
    setAborted(false)
    setStepResults(
      steps.map((step, i) => ({
        step: i + 1,
        toolId: step.toolId,
        toolName: toolRegistry.get(step.toolId)?.name ?? 'Unknown',
        status: 'pending' as const,
        inputFiles: [],
        outputFiles: [],
        startTime: Date.now()
      }))
    )
    setOverallProgress(0)
    setCurrentStepIndex(0)

    if (selectedPresetId) {
      await setLastUsed(selectedPresetId)
    }

    let currentFiles = [...inputFiles]
    let allSuccess = true

    for (let i = 0; i < steps.length; i++) {
      if (aborted) break

      const step = steps[i]
      const toolDef = toolRegistry.get(step.toolId)
      if (!toolDef) {
        setStepResults((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: 'error', error: 'Tool not found' } : r))
        )
        allSuccess = false
        break
      }

      // Check capability
      if (!toolDef.capabilities.acceptsMultipleFiles && !toolDef.capabilities.supportsBatch) {
        setStepResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: 'error', error: 'Tool does not support batch processing' }
              : r
          )
        )
        allSuccess = false
        break
      }

      // Update step status to running
      setStepResults((prev) =>
        prev.map((r, idx) =>
          idx === i
            ? { ...r, status: 'running', inputFiles: currentFiles, startTime: Date.now() }
            : r
        )
      )
      setCurrentStepIndex(i)

      try {
        let outputFiles: string[] = []
        const stepParams = step.params ?? {}

        if (toolDef.capabilities.acceptsMultipleFiles) {
          const result = await invokeToolBatch(toolDef.id, currentFiles, stepParams)
          outputFiles = result.outputFiles ?? []
        } else if (toolDef.capabilities.acceptsFiles) {
          // Single file tool - process each file sequentially
          for (const file of currentFiles) {
            if (aborted) break
            const result = await invokeToolSingle(toolDef.id, file, stepParams)
            if (result.outputFile) outputFiles.push(result.outputFile)
          }
        }

        setStepResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: 'success',
                  outputFiles,
                  inputFiles: currentFiles,
                  durationMs: Date.now() - (r.startTime ?? Date.now())
                }
              : r
          )
        )

        currentFiles = outputFiles

        if (currentFiles.length === 0) {
          // No outputs to pass to next step
          break
        }
      } catch (err) {
        setStepResults((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, status: 'error', error: err instanceof Error ? err.message : String(err) }
              : r
          )
        )
        allSuccess = false
        break
      }
    }

    setRunning(false)
    setOverallProgress(100)

    if (allSuccess) {
      toastSuccess(`Pipeline completed: ${currentFiles.length} file(s) produced`)
    } else {
      toastError('Pipeline failed')
    }
  }

  const abortQueue = () => {
    setAborted(true)
    setRunning(false)
  }

  const retryFailed = () => {
    setAborted(false)
    void runQueue()
  }

  const clearResults = () => {
    setStepResults([])
    setOverallProgress(0)
  }

  const progress = running
    ? Math.round(
        ((currentStepIndex + (stepResults[currentStepIndex]?.progress ?? 0) / 100) /
          Math.max(1, steps.length)) *
          100
      )
    : overallProgress

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
      {/* Left Column: Pipeline Config & Source Files */}
      <div className="lg:col-span-5 space-y-6">
        {/* Card 1: Preset Selection */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-ink">1. Select Preset</CardTitle>
              {selectedPreset && (
                <Badge
                  variant="outline"
                  className="border-accent/40 text-accent font-mono text-[10px]"
                >
                  {steps.length} {steps.length === 1 ? 'STEP' : 'STEPS'}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-dim">
              Choose a saved automated tool sequence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div className="flex items-center gap-2">
              <Select
                aria-label="Select queue preset"
                value={selectedPresetId ?? ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelectedPresetId(e.target.value || null)
                }
                className="flex-1 text-xs"
              >
                <option value="">— Select a queue preset —</option>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.id === lastUsedId ? '(last used)' : ''}
                  </option>
                ))}
              </Select>
              {selectedPreset && (
                <div className="flex items-center gap-1 shrink-0">
                  {onEditPreset && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditPreset(selectedPreset.id)}
                      title="Edit preset in builder"
                      className="cursor-pointer h-8 px-2 text-xs"
                    >
                      <Pencil size={13} className="text-dim" aria-hidden />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPresetId(null)}
                    title="Clear selection"
                    className="cursor-pointer h-8 px-2 text-xs"
                  >
                    <X size={13} className="text-dim" aria-hidden />
                  </Button>
                </div>
              )}
            </div>

            {/* Selected Preset Chain Overview */}
            {selectedPreset && steps.length > 0 && (
              <div className="rounded-lg border border-line/70 bg-surface/40 p-3 space-y-2">
                <p className="text-[11px] font-medium text-dim uppercase tracking-wider font-mono">
                  Chain Overview
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {steps.map((step, idx) => {
                    const tool = toolRegistry.get(step.toolId)
                    const Icon = tool ? getIcon(tool.icon) : FileText
                    return (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md border border-line bg-raised/70 px-2 py-1 text-[11px] font-medium text-ink">
                          <Icon size={12} className="text-accent shrink-0" />
                          <span className="truncate max-w-[120px]">
                            {tool?.name ?? step.toolId}
                          </span>
                        </span>
                        {idx < steps.length - 1 && (
                          <ArrowRight size={11} className="text-faint shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Validation Alerts */}
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <div className="space-y-1.5 pt-1">
                {validation.errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md bg-danger/10 border border-danger/25 p-2.5 text-[11.5px] text-danger"
                  >
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                ))}
                {validation.warnings.map((warn, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md bg-warn/10 border border-warn/25 p-2.5 text-[11.5px] text-warn"
                  >
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Source Files */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-ink">2. Source Files</CardTitle>
              {inputFiles.length > 0 && (
                <Badge variant="outline" className="border-ok/40 text-ok font-mono text-[10px]">
                  {inputFiles.length} {inputFiles.length === 1 ? 'FILE' : 'FILES'} READY
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-dim">
              Files to feed into the pipeline's first step
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DropZone
              accept={[]}
              multiple
              onFiles={handleFilesChange}
              label={
                inputFiles.length === 0
                  ? 'Drop files to process'
                  : `${inputFiles.length} file(s) queued`
              }
              hint={
                inputFiles.length > 0
                  ? 'Drag more files or click to change'
                  : 'Drag and drop files or click to browse'
              }
              disabled={running}
            />

            {inputFiles.length > 0 && (
              <div className="rounded-lg border border-line/70 bg-surface/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-dim uppercase tracking-wider font-mono">
                    Queued Inputs
                  </span>
                  <button
                    type="button"
                    onClick={() => setInputFiles([])}
                    disabled={running}
                    className="cursor-pointer text-[11px] text-faint hover:text-danger transition-colors"
                  >
                    Clear files
                  </button>
                </div>
                <ul className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {inputFiles.map((file, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between gap-2 text-[11.5px] font-mono text-dim truncate"
                      title={file}
                    >
                      <span className="truncate">{file.split(/[\\/]/).pop()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Execution Timeline & Action Controls */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md overflow-hidden">
          <CardHeader className="pb-4 border-b border-line/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-ink">
                  3. Execution Pipeline
                </CardTitle>
                <CardDescription className="text-xs text-dim mt-0.5">
                  {running
                    ? `Processing step ${currentStepIndex + 1} of ${steps.length}...`
                    : stepResults.length > 0
                      ? 'Execution run completed'
                      : 'Ready to execute'}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearResults}
                disabled={running || stepResults.length === 0}
                className="cursor-pointer gap-1.5 text-xs text-faint hover:text-ink"
              >
                <RotateCcw size={12} aria-hidden />
                Reset Results
              </Button>
            </div>
          </CardHeader>

          {/* Progress Bar Section */}
          {(running || overallProgress > 0) && (
            <div className="px-6 pt-5 pb-2 border-b border-line/40 bg-surface/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink flex items-center gap-1.5">
                  {running && <Loader2 size={13} className="animate-spin text-accent" />}
                  {running
                    ? `Running: Step ${currentStepIndex + 1} of ${steps.length}`
                    : 'Pipeline Completed'}
                </span>
                <span className="font-mono text-xs font-semibold text-accent">{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-base overflow-hidden border border-line/60">
                <div
                  className="h-full bg-accent transition-all duration-300 ease-out shadow-[0_0_12px_var(--color-accent)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Step Execution Timeline */}
          <CardContent className="pt-6 space-y-3 min-h-[300px]">
            {stepResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-raised/50 text-faint mb-3">
                  <Workflow size={24} className="opacity-60" />
                </div>
                <p className="text-sm font-medium text-ink">Pipeline Idle</p>
                <p className="text-xs text-dim max-w-sm mt-1">
                  Select a workflow preset and drop source files on the left. When ready, click “Run
                  Pipeline” below.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {stepResults.map((result, i) => {
                  const tool = toolRegistry.get(result.toolId)
                  const Icon = tool ? getIcon(tool.icon) : FileText
                  return (
                    <li
                      key={i}
                      className="rounded-lg border border-line/80 bg-surface/70 p-4 transition-all duration-150 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                              result.status === 'running'
                                ? 'border-accent/40 bg-accent/15 text-accent animate-spin'
                                : result.status === 'success'
                                  ? 'border-ok/40 bg-ok/15 text-ok'
                                  : result.status === 'error'
                                    ? 'border-danger/40 bg-danger/15 text-danger'
                                    : 'border-line bg-raised text-faint'
                            }`}
                          >
                            {result.status === 'running' && <Loader2 size={15} aria-hidden />}
                            {result.status === 'success' && <CheckCircle2 size={15} aria-hidden />}
                            {result.status === 'error' && <AlertCircle size={15} aria-hidden />}
                            {result.status === 'pending' && <Clock size={15} aria-hidden />}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-faint font-semibold">
                                #{result.step}
                              </span>
                              <span className="text-sm font-semibold text-ink flex items-center gap-1.5">
                                <Icon size={14} className="text-dim shrink-0" />
                                {result.toolName}
                              </span>
                            </div>
                            {result.status === 'running' && (
                              <p className="mt-0.5 font-mono text-[11px] text-accent animate-pulse">
                                {result.currentFile
                                  ? `Processing: ${result.currentFile.split(/[\\/]/).pop()}`
                                  : 'Executing...'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {result.durationMs !== undefined && (
                            <span className="text-[11px] font-mono text-faint">
                              {result.durationMs < 1000
                                ? `${result.durationMs}ms`
                                : `${(result.durationMs / 1000).toFixed(1)}s`}
                            </span>
                          )}
                          {result.status === 'success' && (
                            <Badge
                              variant="outline"
                              className="border-ok/40 text-ok text-[10px] font-mono"
                            >
                              {result.outputFiles.length} file(s)
                            </Badge>
                          )}
                          {result.status === 'error' && (
                            <Badge
                              variant="outline"
                              className="border-danger/40 text-danger text-[10px] font-mono"
                            >
                              FAILED
                            </Badge>
                          )}
                        </div>
                      </div>

                      {result.error && (
                        <div className="rounded-md bg-danger/10 border border-danger/25 p-2 text-xs font-mono text-danger">
                          {result.error}
                        </div>
                      )}

                      {result.outputFiles.length > 0 && (
                        <div className="text-[11px] text-faint font-mono truncate bg-surface/50 border border-line/50 rounded px-2 py-1">
                          <span className="text-ok font-semibold">Outputs: </span>
                          {result.outputFiles.map((f) => f.split(/[\\/]/).pop()).join(', ')}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>

          {/* Sticky Card Footer with Primary Execution Actions */}
          <CardFooter className="flex items-center gap-3 pt-4 border-t border-line/60 bg-surface/40">
            {running ? (
              <Button
                variant="danger"
                size="lg"
                onClick={abortQueue}
                className="w-full gap-2 cursor-pointer font-semibold"
              >
                <Pause size={16} aria-hidden />
                Abort Pipeline Execution
              </Button>
            ) : (
              <div className="flex items-center gap-3 w-full">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => void runQueue()}
                  disabled={!canRun}
                  className="flex-1 gap-2 cursor-pointer font-semibold shadow-[0_0_20px_-6px_var(--color-accent-glow)]"
                >
                  <Play size={16} fill="currentColor" aria-hidden />
                  Run Pipeline
                </Button>
                {stepResults.some((r) => r.status === 'error') && (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={retryFailed}
                    className="gap-2 cursor-pointer text-xs"
                  >
                    <RotateCcw size={15} aria-hidden />
                    Retry Failed
                  </Button>
                )}
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

// Mock tool batch/single invokers
async function invokeToolBatch(_toolId: string, files: string[], _params: Record<string, unknown>) {
  await new Promise((r) => setTimeout(r, 400))
  return { outputFiles: files.map((f) => f.replace(/\.[^.]+$/, '_processed$&')) }
}

async function invokeToolSingle(_toolId: string, file: string, _params: Record<string, unknown>) {
  await new Promise((r) => setTimeout(r, 200))
  return { outputFile: file.replace(/\.[^.]+$/, '_processed$&') }
}

export default QueueRunner
