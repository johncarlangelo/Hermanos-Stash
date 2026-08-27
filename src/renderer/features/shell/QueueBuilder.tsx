import { useEffect, useState } from 'react'
import { Plus, GripVertical, Trash2, Save, FileText, X, ChevronDown, ChevronUp } from 'lucide-react'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { ToolDefinition } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Inputs'
import { Panel, SectionHeading } from '../../components/ui/Feedback'
import { Select } from '../../components/ui/Inputs'
import { toastError, toastSuccess } from '../../stores/toasts'
import { useQueueStore } from '../../stores/queue'
import { validateQueueChain, getCompatibleNextTools } from '../../../shared/utils/queue-validation'
import { getCategory } from '../../../shared/constants/categories'

export function QueueBuilder() {
  const presets = useQueueStore((s) => s.presets)
  const lastUsedId = useQueueStore((s) => s.lastUsedId)
  const savePreset = useQueueStore((s) => s.savePreset)
  const deletePreset = useQueueStore((s) => s.deletePreset)

  const [steps, setSteps] = useState<{ toolId: string; params: Record<string, unknown> }[]>([])
  const [presetName, setPresetName] = useState('')
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] }>({ valid: true, errors: [], warnings: [] })
  const [showToolPicker, setShowToolPicker] = useState(false)
  const [pickerInsertIndex, setPickerInsertIndex] = useState<number | null>(null)
  const [toolSearch, setToolSearch] = useState('')

  const allTools = toolRegistry.all()

  const filteredTools = allTools.filter((t) => {
    if (!toolSearch) return true
    const q = toolSearch.toLowerCase()
    return t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
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
    const validation = validateQueueChain(steps.map((s) => toolRegistry.get(s.toolId)).filter(Boolean) as any)
      if (!validation.valid) {
        toastError(validation.errors.join('\n'))
        return
      }
      try {
        await savePreset({
          id: editingId,
          name: presetName.trim(),
          steps
        })
        toastSuccess(`Saved "${presetName}"`)
        setPresetName('')
        setSteps([])
        setEditingId(undefined)
      } catch (err) {
        toastError(err)
      }
    }

    const handleLoadPreset = async (preset: any) => {
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

  const compatibleNextTools = steps.length > 0
    ? getCompatibleNextTools(
        toolRegistry.get(steps[steps.length - 1].toolId)!,
        allTools
      )
    : allTools

  // Used in tool picker modal for compatibility filtering
  void compatibleNextTools

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <SectionHeading>Queue Builder</SectionHeading>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowToolPicker(true)}>
            <Plus size={13} aria-hidden />
            Add step
          </Button>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={() => { setPresetName(''); setSteps([]); setEditingId(undefined); }}>
              <X size={13} aria-hidden />
              New
            </Button>
          )}
        </div>
      </div>

      {/* Preset selector */}
      {presets.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <Select
            aria-label="Load preset"
            value=""
            onChange={(e) => {
              const preset = presets.find((p) => p.id === e.target.value)
              if (preset) handleLoadPreset(preset)
            }}
          >
            <option value="">— Select preset —</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {lastUsedId === p.id && '(last used)'}
              </option>
            ))}
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setPresetName(''); setSteps([]); setEditingId(undefined); }}>
            <FileText size={13} aria-hidden />
            New
          </Button>
        </div>
      )}

      {/* Step list */}
      <Panel className="flex-1 overflow-y-auto space-y-2">
        {steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-faint">
            <Plus size={24} className="mb-2 opacity-40" aria-hidden />
            <p className="text-[12.5px]">No steps yet. Click "Add step" or drag a tool here.</p>
            <p className="text-[11px] mt-1">Steps run sequentially — output of each feeds the next.</p>
          </div>
        ) : (
          <ul className="flex-1 space-y-2">
            {steps.map((step, i) => {
              const tool = toolRegistry.get(step.toolId)
              const isLast = i === steps.length - 1
              const Icon = tool ? getIcon(tool.icon) : null
              const category = tool ? getCategory(tool.category)?.label ?? tool.category : ''
              return (
                <li
                  key={`step-${i}`}
                  className="group flex items-center gap-2 rounded-md border border-line bg-surface/70 p-2 transition-colors duration-150"
                >
                  <button
                    type="button"
                    className="cursor-grip p-1 text-faint hover:text-dim"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <GripVertical size={14} aria-hidden />
                  </button>
                  {Icon && <Icon size={15} strokeWidth={1.75} className="shrink-0 text-dim" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12.5px] font-medium text-ink">
                        {tool?.name ?? 'Unknown tool'}
                      </span>
                      <span className="shrink-0 font-mono text-[9.5px] tracking-wide text-faint uppercase">
                        {category}
                      </span>
                    </div>
                    {step.params && Object.keys(step.params).length > 0 && (
                      <p className="mt-0.5 truncate text-[10.5px] text-faint">
                        {Object.entries(step.params).map(([k, v]) => `${k}: ${v}`).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-60 transition-opacity duration-150 group-hover:opacity-100">
                    {!isLast && (
                      <button
                        type="button"
                        className="cursor-pointer rounded-xs p-1 text-faint hover:text-dim"
                        onClick={() => moveStep(i, 'down')}
                        aria-label="Move down"
                      >
                        <ChevronDown size={12} />
                      </button>
                    )}
                    {i > 0 && (
                      <button
                        type="button"
                        className="cursor-pointer rounded-xs p-1 text-faint hover:text-dim"
                        onClick={() => moveStep(i, 'up')}
                        aria-label="Move up"
                      >
                        <ChevronUp size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="cursor-pointer rounded-xs p-1 text-faint hover:text-danger"
                      onClick={() => removeStep(i)}
                      aria-label="Remove step"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Add step drop zone */}
        <button
          type="button"
          onClick={() => { setPickerInsertIndex(steps.length); setShowToolPicker(true); }}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-line py-3 text-faint transition-colors duration-150 hover:border-accent/50 hover:text-dim"
        >
          <Plus size={18} aria-hidden />
          Add step at end
        </button>
      </Panel>

      {/* Validation messages */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="mt-3 space-y-1">
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

      {/* Preset name + save */}
      {steps.length > 0 && (
        <div className="mt-4 flex items-center gap-2">
          <Input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name (e.g. Web-optimize images)"
            className="flex-1"
          />
          <Button variant="primary" onClick={handleSavePreset} disabled={!presetName.trim()}>
            <Save size={13} aria-hidden />
            {editingId ? 'Update' : 'Save'} preset
          </Button>
        </div>
      )}

      {/* Presets list (saved) */}
      {presets.length > 0 && (
        <div className="mt-6">
          <SectionHeading>Saved Presets</SectionHeading>
          <ul className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
            {presets.map((preset) => (
              <li key={preset.id} className="flex items-center justify-between gap-2 rounded-sm border border-line bg-surface/70 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <span className="truncate text-[12.5px] font-medium text-ink">{preset.name}</span>
                  <span className="mt-0.5 block text-[10.5px] text-faint">{preset.steps.length} step(s)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleLoadPreset(preset)}>
                    <FileText size={12} aria-hidden />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeletePreset(preset.id)}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tool picker modal */}
      {showToolPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/75">
          <div className="w-[min(480px,calc(100vw-2rem))] max-h-[70vh] overflow-hidden rounded-md border border-line-strong bg-overlay shadow-2xl shadow-black/40">
            <div className="border-b border-line px-4 py-3 flex items-center justify-between">
              <h3 className="text-[13px] font-medium text-ink">
                {pickerInsertIndex !== null ? 'Insert step' : 'Add step'}
              </h3>
              <button
                type="button"
                onClick={() => { setShowToolPicker(false); setPickerInsertIndex(null); }}
                className="cursor-pointer rounded-xs p-1 text-faint hover:text-dim"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <Input
                placeholder="Search tools…"
                className="m-3 w-[calc(100%-1.5rem)]"
                onChange={(e) => setToolSearch(e.target.value)}
                autoFocus
              />
              <ul className="px-3 pb-3 space-y-1">
                {filteredTools.map((tool) => {
                  const Icon = getIcon(tool.icon)
                  const category = getCategory(tool.category)?.label ?? tool.category
                  const isCompatible = steps.length === 0 || getCompatibleNextTools(
        toolRegistry.get(steps[steps.length - 1].toolId)!,
        allTools
      ).some((t) => t.id === tool.id)
                  return (
                    <li key={tool.id}>
                      <button
                        type="button"
                        disabled={!isCompatible}
                        onClick={() => handleToolSelect(tool)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-sm transition-colors duration-150 ${
                          isCompatible
                            ? 'text-ink hover:bg-surface'
                            : 'text-faint/50 cursor-not-allowed'
                        }`}
                      >
                        <Icon size={15} strokeWidth={1.75} className={`shrink-0 ${isCompatible ? 'text-dim' : 'text-faint/30'}`} aria-hidden />
                        <div className="min-w-0 flex-1">
                          <span className="truncate text-[12.5px] font-medium">{tool.name}</span>
                          <span className="font-mono text-[9.5px] tracking-wide text-faint uppercase">{category}</span>
                        </div>
                        {!isCompatible && <span className="text-[10px] text-faint">incompatible</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}