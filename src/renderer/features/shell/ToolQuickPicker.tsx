import { useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { CATEGORIES } from '../../../shared/constants/categories'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import type { CategoryId } from '../../../shared/types/tool'
import { getIcon } from '../../components/icons'
import { Button } from '../../components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/Inputs'

interface ToolQuickPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTool: (toolId: string) => void
  currentToolId?: string | null
  title?: string
  description?: string
}

export function ToolQuickPicker({
  open,
  onOpenChange,
  onSelectTool,
  currentToolId,
  title = 'Switch Workspace Tool',
  description = 'Choose any tool from the Hermanos Stash suite to load into this pane.'
}: ToolQuickPickerProps) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all')

  const allTools = useMemo(() => toolRegistry.all(), [])

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allTools.filter((tool) => {
      if (selectedCategory !== 'all' && tool.category !== selectedCategory) {
        return false
      }
      if (!q) return true
      return (
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.tags.some((t) => t.toLowerCase().includes(q)) ||
        tool.id.toLowerCase().includes(q)
      )
    })
  }, [allTools, search, selectedCategory])

  const handleSelect = (toolId: string) => {
    onSelectTool(toolId)
    onOpenChange(false)
    setSearch('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-line bg-shell/95 p-0 backdrop-blur-md max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b border-line px-5 py-4">
          <DialogTitle className="text-[16px] font-semibold text-ink">{title}</DialogTitle>
          <DialogDescription className="text-[12px] text-dim">{description}</DialogDescription>
        </DialogHeader>

        {/* Search & Category Filter */}
        <div className="border-b border-line px-5 py-3 space-y-3 bg-surface/40">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search 75+ tools by name, tag, or description…"
              className="pl-8 text-[13px] bg-base/80"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-ink cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                selectedCategory === 'all'
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-line text-dim hover:text-ink'
              }`}
            >
              All ({allTools.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = allTools.filter((t) => t.category === cat.id).length
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                    selectedCategory === cat.id
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-line text-dim hover:text-ink'
                  }`}
                >
                  {cat.label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Tools List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredTools.map((tool) => {
              const Icon = getIcon(tool.icon)
              const isCurrent = tool.id === currentToolId
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => handleSelect(tool.id)}
                  className={`group relative flex items-start gap-3 rounded-md border p-3 text-left transition-all cursor-pointer ${
                    isCurrent
                      ? 'border-accent/60 bg-accent-soft/30 text-ink shadow-xs'
                      : 'border-line bg-surface/50 text-dim hover:border-line-strong hover:bg-surface hover:text-ink'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border ${
                      isCurrent
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-line bg-base text-faint group-hover:text-accent group-hover:border-accent/30'
                    }`}
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[13px] font-medium text-ink group-hover:text-accent transition-colors">
                        {tool.name}
                      </span>
                      {isCurrent && (
                        <span className="flex items-center gap-0.5 text-[10px] font-medium text-accent">
                          <Check size={12} /> Active
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-dim">
                      {tool.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {filteredTools.length === 0 && (
            <div className="py-12 text-center text-[12.5px] text-faint">
              No tools matched “{search}”. Try clearing the search or category filter.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line px-5 py-3 flex items-center justify-between text-[11.5px] text-faint bg-surface/30">
          <span>{filteredTools.length} tools available</span>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
