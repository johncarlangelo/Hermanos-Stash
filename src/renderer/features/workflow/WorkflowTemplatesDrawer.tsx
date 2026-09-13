import { useRef, useState } from 'react'
import { Download, FolderArchive, Play, Trash2, Upload, X } from 'lucide-react'
import type { WorkflowGraph, WorkflowTemplate } from './types'
import { BUILT_IN_WORKFLOW_TEMPLATES } from './presets'
import { toastError, toastSuccess } from '../../stores/toasts'

interface WorkflowTemplatesDrawerProps {
  open: boolean
  onClose: () => void
  userTemplates: WorkflowTemplate[]
  onLoadTemplate: (graph: WorkflowGraph, templateName: string) => void
  onDeleteTemplate: (templateId: string) => void
  onImportTemplate: (template: WorkflowTemplate) => void
}

export function WorkflowTemplatesDrawer({
  open,
  onClose,
  userTemplates,
  onLoadTemplate,
  onDeleteTemplate,
  onImportTemplate
}: WorkflowTemplatesDrawerProps) {
  const [activeTab, setActiveTab] = useState<'official' | 'user'>('official')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleExport = (template: WorkflowTemplate) => {
    try {
      const dataStr =
        'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(template, null, 2))
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', dataStr)
      downloadAnchor.setAttribute(
        'download',
        `${template.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.stashflow.json`
      )
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      toastSuccess('Workflow exported as JSON')
    } catch {
      toastError('Failed to export workflow file')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as WorkflowTemplate
        if (!parsed.graph || !Array.isArray(parsed.graph.nodes)) {
          throw new Error('Invalid stashflow file format')
        }
        onImportTemplate(parsed)
        toastSuccess(`Imported "${parsed.name || 'Workflow'}"`)
      } catch {
        toastError('Failed to import workflow: Invalid file format')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <>
      {/* Slide Drawer with smooth in and out transition (no background blur) */}
      <div
        className={`absolute top-16 left-4 bottom-6 z-30 flex w-96 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-line/80 bg-shell/95 shadow-2xl backdrop-blur-xl transition-all duration-200 ease-out transform ${
          open
            ? 'translate-x-0 opacity-100 pointer-events-auto scale-100'
            : '-translate-x-10 opacity-0 pointer-events-none scale-95'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-surface/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <FolderArchive size={16} className="text-accent" />
            <h3 className="text-sm font-semibold text-ink">Workflow Templates</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-dim hover:text-ink hover:bg-surface border border-line"
              title="Import .stashflow.json file"
            >
              <Upload size={12} /> Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.stashflow.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded p-1 text-faint hover:text-ink hover:bg-surface"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-line/50 p-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('official')}
            className={`flex-1 cursor-pointer rounded-md py-1.5 font-medium transition-colors ${
              activeTab === 'official'
                ? 'bg-accent text-base font-semibold shadow-xs'
                : 'text-dim hover:text-ink hover:bg-surface/60'
            }`}
          >
            Built-in Recipes ({BUILT_IN_WORKFLOW_TEMPLATES.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('user')}
            className={`flex-1 cursor-pointer rounded-md py-1.5 font-medium transition-colors ${
              activeTab === 'user'
                ? 'bg-accent text-base font-semibold shadow-xs'
                : 'text-dim hover:text-ink hover:bg-surface/60'
            }`}
          >
            My Templates ({userTemplates.length})
          </button>
        </div>

        {/* Template Cards List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {(activeTab === 'official' ? BUILT_IN_WORKFLOW_TEMPLATES : userTemplates).map(
            (template) => (
              <div
                key={template.id}
                className="group rounded-lg border border-line/70 bg-surface/60 p-3 hover:border-accent/60 hover:bg-surface/90 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-ink group-hover:text-accent transition-colors">
                      {template.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 font-mono text-[9.5px] text-faint">
                      <span className="text-accent">{template.graph.nodes.length} nodes</span>
                      <span>·</span>
                      <span>{template.graph.edges.length} wires</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleExport(template)}
                      className="cursor-pointer rounded p-1 text-faint hover:text-ink hover:bg-base transition-colors"
                      title="Export template as JSON"
                    >
                      <Download size={12} />
                    </button>
                    {activeTab === 'user' && (
                      <button
                        type="button"
                        onClick={() => onDeleteTemplate(template.id)}
                        className="cursor-pointer rounded p-1 text-faint hover:text-danger hover:bg-base transition-colors"
                        title="Delete saved template"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="line-clamp-2 text-[11px] text-dim leading-relaxed">
                  {template.description}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    {template.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-line px-1.5 py-0.2 font-mono text-[8.5px] text-faint uppercase"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onLoadTemplate(template.graph, template.name)
                      onClose()
                    }}
                    className="flex cursor-pointer items-center gap-1 rounded bg-accent/15 border border-accent/30 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent hover:text-base transition-colors"
                  >
                    <Play size={10} className="fill-current" /> Load Workflow
                  </button>
                </div>
              </div>
            )
          )}

          {activeTab === 'user' && userTemplates.length === 0 && (
            <div className="py-12 text-center text-xs text-faint space-y-2">
              <FolderArchive size={28} className="mx-auto text-faint/50" />
              <p>No saved templates yet.</p>
              <p className="text-[10.5px]">
                Build a workflow on the canvas and click &ldquo;Save as Template&rdquo; to store it
                here.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
