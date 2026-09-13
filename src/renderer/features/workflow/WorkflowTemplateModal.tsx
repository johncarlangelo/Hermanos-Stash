import React, { useState } from 'react'
import { FolderArchive, Save, X } from 'lucide-react'
import type { WorkflowGraph } from './types'

interface WorkflowTemplateModalProps {
  open: boolean
  onClose: () => void
  graph: WorkflowGraph
  onSave: (template: {
    name: string
    description: string
    category?: string
    tags: string[]
  }) => void
}

export function WorkflowTemplateModal({
  open,
  onClose,
  graph,
  onSave
}: WorkflowTemplateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('general')
  const [tagsInput, setTagsInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    onSave({
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      tags
    })

    onClose()
  }

  return (
    <div
      onClick={onClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all duration-200 ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-xl border border-line bg-shell p-6 shadow-2xl space-y-5 transition-all duration-200 transform ${
          open ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/40 bg-raised text-accent">
              <FolderArchive size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Save Workflow as Template</h3>
              <p className="text-[11px] text-faint">Save this pipeline for instant reuse</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-faint hover:text-ink hover:bg-surface"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Summary pill */}
          <div className="flex items-center gap-2 rounded-lg border border-line/60 bg-surface/50 p-2.5 font-mono text-[11px] text-dim">
            <span className="text-accent font-semibold">{graph.nodes.length} nodes</span>
            <span>·</span>
            <span>{graph.edges.length} connections</span>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-faint uppercase">
              Template Name <span className="text-accent">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Photo ID & Printable Sheet Maker"
              className="w-full rounded-md border border-line bg-base p-2 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-faint uppercase">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this workflow automates…"
              className="w-full rounded-md border border-line bg-base p-2 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-faint uppercase">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-line bg-base p-2 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="general">General Utility</option>
              <option value="images">Images & Design</option>
              <option value="documents">Documents & PDF</option>
              <option value="media">Audio & Video</option>
              <option value="developer">Developer & Code</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-faint uppercase">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="images, pdf, passport, automated"
              className="w-full rounded-md border border-line bg-base p-2 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line/60">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-xs text-dim hover:text-ink hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-4 py-1.5 text-xs font-medium text-base hover:opacity-90 disabled:opacity-50"
            >
              <Save size={13} /> Save Template
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
