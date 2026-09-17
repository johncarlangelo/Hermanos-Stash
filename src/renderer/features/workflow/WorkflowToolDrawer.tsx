import { useMemo, useState } from 'react'
import { Layers, Plus, Search, X } from 'lucide-react'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { CATEGORIES } from '../../../shared/constants/categories'
import type { CategoryId } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'

interface WorkflowToolDrawerProps {
  open: boolean
  onClose: () => void
  onAddTool: (toolId: string) => void
}

export function WorkflowToolDrawer({ open, onClose, onAddTool }: WorkflowToolDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all')

  const allTools = useMemo(() => toolRegistry.all(), [])

  const filteredTools = useMemo(() => {
    let result = allTools

    if (selectedCategory !== 'all') {
      result = result.filter((t) => t.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    }

    return result
  }, [allTools, selectedCategory, searchQuery])

  return (
    <>
      {/* Slide Drawer with smooth in and out transition (no full-screen blur or drag blocking) */}
      <div
        data-drawer="workflow-tool-drawer"
        onWheel={(e) => e.stopPropagation()}
        className={`absolute top-16 right-4 bottom-6 z-30 flex w-84 max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-line/80 bg-shell/95 shadow-2xl backdrop-blur-xl transition-all duration-200 ease-out transform overscroll-contain ${
          open
            ? 'translate-x-0 opacity-100 pointer-events-auto scale-100'
            : 'translate-x-10 opacity-0 pointer-events-none scale-95'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3 bg-surface/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-accent" />
            <h3 className="text-sm font-semibold text-ink">Tool Palette</h3>
            <span className="rounded-full bg-base px-2 py-0.2 font-mono text-[10px] text-faint">
              {filteredTools.length}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-faint hover:text-ink hover:bg-surface transition-colors"
            title="Close tool drawer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-line/50 space-y-2.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 78 local tools…"
              className="w-full rounded-md border border-line bg-base/80 py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10.5px] scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`cursor-pointer rounded px-2 py-0.5 font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-accent text-base font-semibold shadow-xs'
                  : 'bg-surface/60 text-dim hover:text-ink hover:bg-surface'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`cursor-pointer rounded px-2 py-0.5 font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-accent text-base font-semibold shadow-xs'
                    : 'bg-surface/60 text-dim hover:text-ink hover:bg-surface'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tool List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-line/30">
          {filteredTools.map((tool) => {
            const Icon = getIcon(tool.icon)
            const acceptsFiles = tool.capabilities.acceptsFiles
            const acceptsText = tool.capabilities.acceptsText
            const producesFiles = tool.capabilities.producesFiles
            const producesText = tool.capabilities.producesText

            return (
              <div
                key={tool.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/stash-tool-id', tool.id)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                className="group pt-2 first:pt-0 flex flex-col gap-1.5 rounded-lg p-2 hover:bg-surface/70 border border-transparent hover:border-line/60 transition-all cursor-grab active:cursor-grabbing"
                title="Drag onto canvas or click + to add"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-line bg-base text-accent group-hover:border-accent/40">
                      <Icon size={12} />
                    </div>
                    <span className="text-[12px] font-medium text-ink truncate group-hover:text-accent transition-colors">
                      {tool.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddTool(tool.id)}
                    className="flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-line/70 bg-base/80 text-faint hover:border-accent hover:text-accent transition-colors shrink-0"
                    title="Add to canvas"
                  >
                    <Plus size={11} />
                  </button>
                </div>

                <p className="line-clamp-2 text-[11px] leading-relaxed text-dim">
                  {tool.description}
                </p>

                {/* Port Capability Badges */}
                <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                  {acceptsFiles && (
                    <span className="rounded bg-cyan-500/10 border border-cyan-500/30 px-1 py-0.2 font-mono text-[8.5px] text-cyan-400">
                      In: Files
                    </span>
                  )}
                  {acceptsText && (
                    <span className="rounded bg-purple-500/10 border border-purple-500/30 px-1 py-0.2 font-mono text-[8.5px] text-purple-400">
                      In: Text
                    </span>
                  )}
                  {producesFiles && (
                    <span className="rounded bg-cyan-500/10 border border-cyan-500/30 px-1 py-0.2 font-mono text-[8.5px] text-cyan-400">
                      Out: Files
                    </span>
                  )}
                  {producesText && (
                    <span className="rounded bg-purple-500/10 border border-purple-500/30 px-1 py-0.2 font-mono text-[8.5px] text-purple-400">
                      Out: Text
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {filteredTools.length === 0 && (
            <div className="py-12 text-center text-xs text-faint">
              No tools match &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>

        {/* Footer helper hint */}
        <div className="border-t border-line/50 p-2.5 text-center text-[10px] text-faint bg-base/40 rounded-b-xl">
          Drag tool card onto canvas, or click <Plus size={10} className="inline" /> to add
        </div>
      </div>
    </>
  )
}
