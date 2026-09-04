import { useEffect, useState } from 'react'
import {
  Plus,
  Trash2,
  Save,
  FileText,
  X,
  ChevronDown,
  ChevronUp,
  Play,
  Pencil,
  ArrowDown,
  Workflow,
  Search,
  AlertCircle
} from 'lucide-react'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/Inputs'
import { toastError, toastSuccess } from '../../stores/toasts'
import { useQueueStore } from '../../stores/queue'
import { validateQueueChain, getCompatibleNextTools } from '../../../shared/utils/queue-validation'
import { getCategory } from '../../../shared/constants/categories'

interface QueueBuilderProps {
  initialPresetId?: string
  onRunPreset?: (presetId: string) => void
}

export function QueueBuilder({ initialPresetId, onRunPreset }: QueueBuilderProps = {}) {
  const presets = useQueueStore((s) => s.presets)
  const lastUsedId = useQueueStore((s) => s.lastUsedId)
  const savePreset = useQueueStore((s) => s.savePreset)
  const deletePreset = useQueueStore((s) => s.deletePreset)

  const [steps, setSteps] = useState<{ toolId: string; params: Record<string, unknown> }[]>([])
  const [presetName, setPresetName] = useState('')
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [validation, setValidation] = useState<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }>({ valid: true, errors: [], warnings: [] })
  const [showToolPicker, setShowToolPicker] = useState(false)
  const [pickerInsertIndex, setPickerInsertIndex] = useState<number | null>(null)
  const [toolSearch, setToolSearch] = useState('')

  useEffect(() => {
    if (initialPresetId) {
      const preset = presets.find((p) => p.id === initialPresetId)
      if (preset) {
        setPresetName(preset.name)
        setSteps(preset.steps)
        setEditingId(preset.id)
      }
    }
  }, [initialPresetId, presets])

  const allTools = toolRegistry.all()

  const filteredTools = allTools.filter((t) => {
    if (!toolSearch) return true
    const q = toolSearch.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  })

  // Validate on changes
  useEffect(() => {
    if (steps.length === 0) {
      setValidation({ valid: true, errors: [], warnings: [] })
      return
    }
    const tools = steps.map((s) => toolRegistry.get(s.toolId)).filter(Boolean) as ToolDefinition[]
    const result = validateQueueChain(tools)
    setValidation({
      valid: result.valid,
      errors: result.errors.map((e) => `${e.message}`),
      warnings: result.warnings.map((w) => `${w.message}`)
    })
  }, [steps])

  // Handle dropping a tool into the step list
  const handleToolSelect = (tool: ToolDefinition) => {
    if (pickerInsertIndex !== null) {
      const newSteps = [...steps]
      newSteps.splice(pickerInsertIndex, 0, { toolId: tool.id, params: {} })
      setSteps(newSteps)
    } else {
      setSteps([...steps, { toolId: tool.id, params: {} }])
    }
    setShowToolPicker(false)
    setPickerInsertIndex(null)
    setToolSearch('')
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= newSteps.length) return
    ;[newSteps[index], newSteps[target]] = [newSteps[target], newSteps[index]]
    setSteps(newSteps)
  }

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      toastError('Please enter a preset name')
      return
    }
    if (steps.length === 0) {
      toastError('Add at least one step')
      return
    }
    const validationResult = validateQueueChain(
      steps.map((s) => toolRegistry.get(s.toolId)).filter((t): t is ToolDefinition => Boolean(t))
    )
    if (!validationResult.valid) {
      toastError(validationResult.errors.map((e) => e.message).join('\n'))
      return
    }
    try {
      await savePreset({
        id: editingId,
        name: presetName.trim(),
        steps
      })
      toastSuccess(`Saved preset "${presetName}"`)
      setPresetName('')
      setSteps([])
      setEditingId(undefined)
    } catch (err) {
      toastError(err)
    }
  }

  const handleLoadPreset = (preset: {
    id: string
    name: string
    steps: { toolId: string; params: Record<string, unknown> }[]
  }) => {
    setPresetName(preset.name)
    setSteps(preset.steps)
    setEditingId(preset.id)
  }

  const handleDeletePreset = async (id: string) => {
    if (confirm('Delete this preset?')) {
      await deletePreset(id)
      if (editingId === id) {
        setPresetName('')
        setSteps([])
        setEditingId(undefined)
      }
    }
  }

  const resetForm = () => {
    setPresetName('')
    setSteps([])
    setEditingId(undefined)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
      {/* Left Column: Pipeline Sequence Chain Editor */}
      <div className="lg:col-span-7 space-y-6">
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="pb-4 border-b border-line/60">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold text-ink">
                    Pipeline Sequence
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="border-accent/40 text-accent font-mono text-[10px]"
                  >
                    {steps.length} {steps.length === 1 ? 'STEP' : 'STEPS'}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-dim mt-0.5">
                  Ordered tools chained sequentially. Each tool passes its output files to the next.
                </CardDescription>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setPickerInsertIndex(steps.length)
                  setShowToolPicker(true)
                }}
                className="gap-1.5 text-xs cursor-pointer shadow-[0_0_16px_-4px_var(--color-accent-glow)]"
              >
                <Plus size={14} aria-hidden />
                Add Step
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-3">
            {steps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-raised/50 text-faint mb-3">
                  <Workflow size={24} className="opacity-60" />
                </div>
                <p className="text-sm font-medium text-ink">No steps in this pipeline yet</p>
                <p className="text-xs text-dim max-w-sm mt-1">
                  Add tools to construct an automated processing sequence. Output files will flow
                  seamlessly between steps.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPickerInsertIndex(0)
                    setShowToolPicker(true)
                  }}
                  className="mt-4 gap-1.5 text-xs cursor-pointer"
                >
                  <Plus size={13} aria-hidden />
                  Add First Tool
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((step, i) => {
                  const tool = toolRegistry.get(step.toolId)
                  const isLast = i === steps.length - 1
                  const Icon = tool ? getIcon(tool.icon) : FileText
                  const category = tool ? (getCategory(tool.category)?.label ?? tool.category) : ''

                  return (
                    <div key={`step-${i}`} className="space-y-2">
                      <div className="group flex items-center gap-3 rounded-lg border border-line/80 bg-surface/70 p-3.5 transition-all duration-150 hover:border-line-strong">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-raised border border-line text-[10.5px] font-mono font-semibold text-faint">
                          {i + 1}
                        </span>

                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-accent/25 bg-raised/80 text-accent">
                          <Icon size={16} aria-hidden />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-semibold text-ink">
                              {tool?.name ?? 'Unknown tool'}
                            </span>
                            <span className="shrink-0 font-mono text-[9px] tracking-wide text-faint uppercase px-1.5 py-0.2 rounded bg-base/50 border border-line">
                              {category}
                            </span>
                          </div>
                          {step.params && Object.keys(step.params).length > 0 && (
                            <p className="mt-0.5 truncate text-[10.5px] text-faint font-mono">
                              {Object.entries(step.params)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(', ')}
                            </p>
                          )}
                        </div>

                        {/* Step Re-order & Delete Controls */}
                        <div className="flex items-center gap-1">
                          {i > 0 && (
                            <button
                              type="button"
                              className="cursor-pointer rounded p-1 text-faint hover:text-ink hover:bg-raised transition-colors"
                              onClick={() => moveStep(i, 'up')}
                              title="Move step up"
                              aria-label="Move step up"
                            >
                              <ChevronUp size={14} />
                            </button>
                          )}
                          {!isLast && (
                            <button
                              type="button"
                              className="cursor-pointer rounded p-1 text-faint hover:text-ink hover:bg-raised transition-colors"
                              onClick={() => moveStep(i, 'down')}
                              title="Move step down"
                              aria-label="Move step down"
                            >
                              <ChevronDown size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="cursor-pointer rounded p-1 text-faint hover:text-danger hover:bg-danger/10 transition-colors ml-1"
                            onClick={() => removeStep(i)}
                            title="Remove step"
                            aria-label="Remove step"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Connecting Arrow */}
                      {!isLast && (
                        <div className="flex items-center justify-center py-0.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-raised/60 border border-line text-accent/70">
                            <ArrowDown size={11} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add Step Dashed Trigger Button */}
                <button
                  type="button"
                  onClick={() => {
                    setPickerInsertIndex(steps.length)
                    setShowToolPicker(true)
                  }}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line py-3 text-xs text-faint transition-all duration-150 hover:border-accent/50 hover:text-ink hover:bg-surface/30 mt-3"
                >
                  <Plus size={14} aria-hidden />
                  Add next step in sequence
                </button>
              </div>
            )}

            {/* Validation Alerts */}
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <div className="space-y-1.5 pt-2">
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
      </div>

      {/* Right Column: Preset Save Controls & Presets Library */}
      <div className="lg:col-span-5 space-y-6">
        {/* Card 1: Save / Update Preset */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-ink">
              {editingId ? 'Update Preset' : 'Save Workflow Preset'}
            </CardTitle>
            <CardDescription className="text-xs text-dim">
              {editingId
                ? 'Save your edits to this workflow preset'
                : 'Give this pipeline a name to re-use it anytime'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g. Optimize & Watermark PDFs"
              className="text-xs"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleSavePreset}
                disabled={!presetName.trim() || steps.length === 0}
                className="flex-1 gap-1.5 text-xs cursor-pointer"
              >
                <Save size={13} aria-hidden />
                {editingId ? 'Update Preset' : 'Save Preset'}
              </Button>
              {editingId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="gap-1 text-xs cursor-pointer"
                >
                  <X size={13} aria-hidden />
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Preset Library */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="pb-3 border-b border-line/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-ink">Preset Library</CardTitle>
                <CardDescription className="text-xs text-dim mt-0.5">
                  {presets.length} {presets.length === 1 ? 'saved preset' : 'saved presets'}
                </CardDescription>
              </div>
              {editingId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="gap-1 text-xs text-faint hover:text-ink cursor-pointer"
                >
                  <FileText size={12} aria-hidden />
                  New Preset
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-2.5">
            {presets.length === 0 ? (
              <div className="py-8 text-center text-xs text-dim">
                No saved presets yet. Build a sequence and click “Save Preset”.
              </div>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {presets.map((preset) => {
                  const isCurrent = editingId === preset.id
                  const isLastUsed = lastUsedId === preset.id
                  return (
                    <li
                      key={preset.id}
                      className={`flex flex-col gap-2 rounded-lg border p-3 transition-all ${
                        isCurrent
                          ? 'border-accent/50 bg-accent-soft/30'
                          : 'border-line/70 bg-surface/50 hover:border-line-strong'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-semibold text-ink">
                              {preset.name}
                            </span>
                            {isLastUsed && (
                              <Badge
                                variant="outline"
                                className="border-accent/40 text-accent text-[9px] font-mono"
                              >
                                LAST USED
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10.5px] font-mono text-faint mt-0.5 block">
                            {preset.steps.length} {preset.steps.length === 1 ? 'step' : 'steps'}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {onRunPreset && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRunPreset(preset.id)}
                              title="Run in pipeline runner"
                              className="h-7 w-7 p-0 cursor-pointer text-accent hover:bg-accent-soft"
                            >
                              <Play size={12} fill="currentColor" aria-hidden />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoadPreset(preset)}
                            title="Edit preset steps"
                            className="h-7 w-7 p-0 cursor-pointer text-dim hover:text-ink"
                          >
                            <Pencil size={12} aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDeletePreset(preset.id)}
                            title="Delete preset"
                            className="h-7 w-7 p-0 cursor-pointer text-faint hover:text-danger hover:bg-danger/10"
                          >
                            <Trash2 size={12} aria-hidden />
                          </Button>
                        </div>
                      </div>

                      {/* Tool Sequence Micro Preview */}
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-dim font-mono">
                        {preset.steps.slice(0, 4).map((step, idx) => (
                          <span key={idx} className="flex items-center gap-1">
                            <span className="truncate max-w-[90px] rounded bg-base/60 px-1 py-0.2 border border-line/60">
                              {toolRegistry.get(step.toolId)?.name ?? step.toolId}
                            </span>
                            {idx < Math.min(preset.steps.length - 1, 3) && <span>→</span>}
                          </span>
                        ))}
                        {preset.steps.length > 4 && (
                          <span className="text-faint">+{preset.steps.length - 4} more</span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tool Picker Modal */}
      {showToolPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-line-strong bg-overlay shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-line px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  {pickerInsertIndex !== null
                    ? `Insert Step at Position #${pickerInsertIndex + 1}`
                    : 'Add Tool Step'}
                </h3>
                <p className="text-xs text-dim mt-0.5">
                  Choose a tool to include in your batch pipeline
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowToolPicker(false)
                  setPickerInsertIndex(null)
                  setToolSearch('')
                }}
                className="cursor-pointer rounded-md p-1.5 text-faint hover:text-ink hover:bg-raised transition-colors"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-line/60 bg-surface/30">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <Input
                  placeholder="Search tools by name, tag, or description..."
                  value={toolSearch}
                  onChange={(e) => setToolSearch(e.target.value)}
                  className="pl-8 text-xs"
                  autoFocus
                />
              </div>
            </div>

            {/* Scrollable Tool Selection List */}
            <div className="max-h-80 overflow-y-auto p-3 space-y-1">
              {filteredTools.length === 0 ? (
                <div className="py-8 text-center text-xs text-dim">
                  No tools found matching "{toolSearch}".
                </div>
              ) : (
                filteredTools.map((tool) => {
                  const Icon = getIcon(tool.icon)
                  const category = getCategory(tool.category)?.label ?? tool.category
                  const isCompatible =
                    steps.length === 0 ||
                    getCompatibleNextTools(
                      toolRegistry.get(steps[steps.length - 1].toolId)!,
                      allTools
                    ).some((t) => t.id === tool.id)

                  return (
                    <button
                      key={tool.id}
                      type="button"
                      disabled={!isCompatible}
                      onClick={() => handleToolSelect(tool)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-all ${
                        isCompatible
                          ? 'text-ink hover:bg-raised/70 cursor-pointer'
                          : 'text-faint/40 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-raised text-accent">
                        <Icon size={15} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-semibold">{tool.name}</span>
                          <span className="font-mono text-[9px] tracking-wide text-faint uppercase">
                            {category}
                          </span>
                        </div>
                        <p className="text-[11px] text-dim truncate mt-0.5">{tool.description}</p>
                      </div>
                      {!isCompatible && (
                        <span className="text-[10px] text-faint font-mono shrink-0">
                          incompatible
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QueueBuilder
