import { useEffect, useState } from 'react'
import { Play, Pause, RotateCcw, AlertCircle, CheckCircle, Loader2, FileText } from 'lucide-react'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../../shared/types/tool'
import { Button } from '../../components/ui/Button'
import { Panel, SectionHeading } from '../../components/ui/Feedback'
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

export function QueueRunner() {
  const presets = useQueueStore((s) => s.presets)
  const lastUsedId = useQueueStore((s) => s.lastUsedId)
  const setLastUsed = useQueueStore((s) => s.setLastUsed)

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [inputFiles, setInputFiles] = useState<string[]>([])
  const [stepResults, setStepResults] = useState<StepResult[]>([])
  const [running, setRunning] = useState(false)
  const [aborted, setAborted] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const selectedPreset = presets.find((p) => p.id === selectedPresetId)
  const steps = selectedPreset?.steps ?? []

  // Validation
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] }>({
    valid: true,
    errors: [],
    warnings: []
  })

  useEffect(() => {
    if (steps.length === 0) {
      setValidation({ valid: true, errors: [], warnings: [] })
      return
    }
    const tools = steps.map((s) => toolRegistry.get(s.toolId)).filter(Boolean) as ToolDefinition[]
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
        setStepResults((prev) => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', error: 'Tool not found' } : r
        ))
        allSuccess = false
        break
      }

      // Check capability
      if (!toolDef.capabilities.acceptsMultipleFiles && !toolDef.capabilities.supportsBatch) {
        setStepResults((prev) => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', error: 'Tool does not support batch processing' } : r
        ))
        allSuccess = false
        break
      }

      // Update step status to running
      setStepResults((prev) => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'running', inputFiles: currentFiles, startTime: Date.now() } : r
      ))
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

        setStepResults((prev) => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'success', outputFiles, inputFiles: currentFiles, durationMs: Date.now() - (r.startTime ?? Date.now()) } : r
        ))

        currentFiles = outputFiles

        if (currentFiles.length === 0) {
          // No outputs to pass to next step
          break
        }

      } catch (err) {
        setStepResults((prev) => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'error', error: err instanceof Error ? err.message : String(err) } : r
        ))
        allSuccess = false
        break
      }
    }

    setRunning(false)
    setOverallProgress(100)

    if (allSuccess) {
      toastSuccess(`Queue completed: ${currentFiles.length} file(s) produced`)
    } else {
      toastError('Queue failed')
    }
  }

  const abortQueue = () => {
    setAborted(true)
    setRunning(false)
  }

  const retryFailed = () => {
    setAborted(false)
    runQueue()
  }

  const clearResults = () => {
    setStepResults([])
    setInputFiles([])
    setOverallProgress(0)
  }

  const progress = running
    ? Math.round(((currentStepIndex + (stepResults[currentStepIndex]?.progress ?? 0) / 100) / steps.length) * 100)
    : overallProgress

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <SectionHeading>Queue Runner</SectionHeading>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clearResults} disabled={running}>
            <span className="flex items-center gap-1">
              <RotateCcw size={13} aria-hidden />
              Clear
            </span>
          </Button>
        </div>
      </div>

      {/* Preset selector */}
      <div className="mb-4 flex items-center gap-2">
        <Select
          aria-label="Select queue preset"
          value={selectedPresetId ?? ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPresetId(e.target.value || null)}
        >
          <option value="">— Select a queue preset —</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.id === lastUsedId && '(last used)'}
            </option>
          ))}
        </Select>
        {selectedPreset && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedPresetId(null)}>
            <RotateCcw size={13} aria-hidden />
          </Button>
        )}
      </div>

      {/* Validation */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="mb-4 space-y-1">
          {validation.errors.map((err, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-sm bg-danger/10 px-2 py-1.5 text-[11px] text-danger">
              <span className="shrink-0">✕</span>
              <span>{err}</span>
            </div>
          ))}
          {validation.warnings.map((warn, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-sm bg-warn/10 px-2 py-1.5 text-[11px] text-warn">
              <span className="shrink-0">⚠</span>
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* File input */}
      <DropZone
        accept={[]}
        multiple
        onFiles={handleFilesChange}
        label={inputFiles.length === 0 ? 'Drop files to process' : `${inputFiles.length} file(s) ready`}
        hint={inputFiles.length > 0 ? inputFiles.map((f) => f.split(/[\\/]/).pop()).join(', ') : 'Drag and drop or click to browse'}
        disabled={running}
      />

      {/* Progress bar */}
      {(running || overallProgress > 0) && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-faint mb-1">
            <span>{running ? `Running step ${currentStepIndex + 1} of ${steps.length}` : 'Completed'}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-base rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Step results */}
      <Panel className="mt-4 flex-1 overflow-y-auto">
        {stepResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-faint">
            <span className="text-[12.5px]">Select a preset, add files, and click Run</span>
          </div>
        ) : (
          <ul className="space-y-2">
            {stepResults.map((result, i) => (
              <li key={i} className="flex flex-col gap-1.5 rounded-md border border-line bg-surface/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-sm ${
                      result.status === 'running' ? 'bg-accent/20 text-accent animate-spin' :
                      result.status === 'success' ? 'bg-ok/20 text-ok' :
                      result.status === 'error' ? 'bg-danger/20 text-danger' :
                      'bg-line text-faint'
                    }`}>
                      {result.status === 'running' && <Loader2 size={12} aria-hidden />}
                      {result.status === 'success' && <CheckCircle size={12} aria-hidden />}
                      {result.status === 'error' && <AlertCircle size={12} aria-hidden />}
                      {result.status === 'pending' && <FileText size={12} aria-hidden />}
                    </span>
                    <div>
                      <span className="text-[12.5px] font-medium text-ink">Step {result.step}: {result.toolName}</span>
                      {result.status === 'running' && (
                        <span className="ml-2 font-mono text-[10px] text-faint">
                          {result.currentFile ? `Processing: ${result.currentFile}` : 'Starting...'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.status === 'success' && result.outputFiles.length > 0 && (
                      <span className="tnum text-[11px] text-ok">
                        {result.outputFiles.length} file(s)
                      </span>
                    )}
                    {result.status === 'error' && (
                      <span className="text-[11px] text-danger">{result.error}</span>
                    )}
                  </div>
                </div>
                {result.status === 'running' && (
                  <div className="h-1 bg-base rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-200"
                      style={{ width: `${result.progress ?? 0}%` }}
                    />
                  </div>
                )}
                {result.status === 'error' && result.error && (
                  <p className="mt-1 text-[11px] text-danger font-mono">{result.error}</p>
                )}
                {result.inputFiles.length > 0 && (
                  <p className="mt-1 text-[10px] text-faint font-mono truncate">
                    Input: {result.inputFiles.join(', ')}
                  </p>
                )}
                {result.outputFiles.length > 0 && (
                  <p className="mt-1 text-[10px] text-ok font-mono truncate">
                    Output: {result.outputFiles.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Controls */}
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant={running ? 'ghost' : 'primary'}
            size="lg"
            onClick={running ? abortQueue : runQueue}
            disabled={!canRun && !running}
            className="flex-1"
          >
            {running ? (
              <>
                <Pause size={16} aria-hidden />
                Abort
              </>
            ) : (
              <>
                <Play size={16} aria-hidden />
                Run Queue
              </>
            )}
          </Button>
          {!running && stepResults.some((r) => r.status === 'error') && (
            <Button variant="secondary" size="lg" onClick={retryFailed}>
              <RotateCcw size={16} aria-hidden />
              Retry Failed
            </Button>
          )}
        </div>
      </Panel>
    </div>
  )
}

// Placeholder Select component - uses native select for now
function Select({ value, onChange, children, ...props }: any) {
  return <select value={value} onChange={onChange} {...props}>{children}</select>
}

// Mock tool batch/single invokers - replace with actual IPC calls
async function invokeToolBatch(_toolId: string, files: string[], _params: Record<string, unknown>) {
  // This would call the actual tool IPC
  // For now, simulate
  await new Promise((r) => setTimeout(r, 500))
  return { outputFiles: files.map((f) => f.replace(/\.[^.]+$/, '_processed$&')) }
}

async function invokeToolSingle(_toolId: string, file: string, _params: Record<string, unknown>) {
  await new Promise((r) => setTimeout(r, 200))
  return { outputFile: file.replace(/\.[^.]+$/, '_processed$&') }
}

export default QueueRunner