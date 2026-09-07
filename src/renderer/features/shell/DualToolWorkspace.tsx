import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, ChevronDown, GripVertical, Maximize2, X } from 'lucide-react'
import { getCategory } from '../../../shared/constants/categories'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { getIcon } from '../../components/icons'
import { useNav } from '../../stores/nav'
import { DEFAULT_SECONDARY_TOOL, useWorkspace } from '../../stores/workspace'
import { ToolPage } from './ToolPage'
import { ToolQuickPicker } from './ToolQuickPicker'

interface DualToolWorkspaceProps {
  primaryToolId: string
}

export function DualToolWorkspace({ primaryToolId }: DualToolWorkspaceProps) {
  const openTool = useNav((s) => s.openTool)
  const splitRatio = useWorkspace((s) => s.splitRatio)
  const setSplitRatio = useWorkspace((s) => s.setSplitRatio)
  const secondaryToolId = useWorkspace((s) => s.secondaryToolId)
  const setSecondaryToolId = useWorkspace((s) => s.setSecondaryToolId)
  const setSplitMode = useWorkspace((s) => s.setSplitMode)
  const swapPanes = useWorkspace((s) => s.swapPanes)
  const activePane = useWorkspace((s) => s.activePane)
  const setActivePane = useWorkspace((s) => s.setActivePane)

  // Quick picker states
  const [pickerTarget, setPickerTarget] = useState<'primary' | 'secondary' | null>(null)

  // Drag state
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Ensure secondaryTool is valid and not identical to primary if possible
  const effectiveSecondaryId = useMemo(() => {
    if (secondaryToolId && secondaryToolId !== primaryToolId) {
      return secondaryToolId
    }
    // Fallback if secondary is same or null
    return primaryToolId === DEFAULT_SECONDARY_TOOL ? 'json-formatter' : DEFAULT_SECONDARY_TOOL
  }, [secondaryToolId, primaryToolId])

  useEffect(() => {
    if (secondaryToolId !== effectiveSecondaryId) {
      setSecondaryToolId(effectiveSecondaryId)
    }
  }, [effectiveSecondaryId, secondaryToolId, setSecondaryToolId])

  const primaryTool = useMemo(() => toolRegistry.get(primaryToolId), [primaryToolId])
  const secondaryTool = useMemo(
    () => toolRegistry.get(effectiveSecondaryId),
    [effectiveSecondaryId]
  )

  const PrimaryIcon = primaryTool ? getIcon(primaryTool.icon) : null
  const SecondaryIcon = secondaryTool ? getIcon(secondaryTool.icon) : null

  const primaryCategory = primaryTool ? getCategory(primaryTool.category) : null
  const secondaryCategory = secondaryTool ? getCategory(secondaryTool.category) : null

  // Divider resize handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const newRatio = (moveEvent.clientX - rect.left) / rect.width
        void setSplitRatio(newRatio)
      }

      const handleMouseUp = () => {
        setIsDragging(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [setSplitRatio]
  )

  const handleResetDivider = () => {
    void setSplitRatio(0.5)
  }

  const handleKeyDownDivider = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      void setSplitRatio(splitRatio - 0.05)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      void setSplitRatio(splitRatio + 0.05)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleResetDivider()
    }
  }

  // Pane actions
  const handleSwap = () => {
    const newPrimary = swapPanes(primaryToolId)
    if (newPrimary) {
      openTool(newPrimary)
    }
  }

  const handleMaximizePrimary = () => {
    setSplitMode(false)
  }

  const handleMaximizeSecondary = () => {
    openTool(effectiveSecondaryId)
    setSplitMode(false)
  }

  const handleClose = () => {
    setSplitMode(false)
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full w-full select-none overflow-hidden ${
        isDragging ? 'cursor-col-resize select-none' : ''
      }`}
    >
      {/* LEFT PANE (Primary Tool) */}
      <div
        style={{ width: `${splitRatio * 100}%` }}
        className={`relative flex flex-col min-w-0 border-r border-line bg-shell/40 transition-colors ${
          activePane === 'primary' ? 'ring-1 ring-accent/30 z-10' : ''
        }`}
        onClick={() => setActivePane('primary')}
      >
        {/* Compact Pane Titlebar */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-line bg-surface/80 px-3 backdrop-blur-xs">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setPickerTarget('primary')}
              title="Click to switch tool in left pane"
              className="group flex items-center gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-raised cursor-pointer min-w-0"
            >
              {PrimaryIcon && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-raised border border-accent/30 text-accent">
                  <PrimaryIcon size={13} />
                </span>
              )}
              <div className="min-w-0 flex items-baseline gap-1.5">
                <span className="truncate text-[13px] font-medium text-ink group-hover:text-accent transition-colors">
                  {primaryTool?.name ?? primaryToolId}
                </span>
                <span className="hidden sm:inline font-mono text-[9.5px] uppercase text-faint">
                  {primaryCategory?.label ?? primaryTool?.category}
                </span>
              </div>
              <ChevronDown
                size={12}
                className="text-faint transition-transform group-hover:text-dim"
              />
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleSwap}
              title="Swap left and right tools (⇄)"
              aria-label="Swap tools"
              className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-raised hover:text-ink transition-colors cursor-pointer"
            >
              <ArrowLeftRight size={13} />
            </button>
            <button
              type="button"
              onClick={handleMaximizePrimary}
              title="Focus/Maximize this tool (⤢)"
              aria-label="Maximize left tool"
              className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-raised hover:text-ink transition-colors cursor-pointer"
            >
              <Maximize2 size={13} />
            </button>
            <button
              type="button"
              onClick={handleClose}
              title="Close split screen (✕)"
              aria-label="Close split screen"
              className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-danger/20 hover:text-danger transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Pane Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <ToolPage toolId={primaryToolId} embedded={true} />
        </div>
      </div>

      {/* RESIZER DIVIDER */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(splitRatio * 100)}
        aria-valuemin={25}
        aria-valuemax={75}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleResetDivider}
        onKeyDown={handleKeyDownDivider}
        title="Drag to resize, double-click to center (50/50)"
        className={`group relative -ml-1 -mr-1 w-2.5 z-20 flex cursor-col-resize items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-accent ${
          isDragging ? 'bg-accent/30' : 'hover:bg-accent/20'
        }`}
      >
        <div
          className={`flex h-8 w-3.5 items-center justify-center rounded border border-line bg-raised shadow-xs transition-transform group-hover:scale-110 ${
            isDragging ? 'scale-110 border-accent/60 bg-accent-soft text-accent' : 'text-faint'
          }`}
        >
          <GripVertical size={11} />
        </div>
      </div>

      {/* RIGHT PANE (Secondary Tool) */}
      <div
        style={{ width: `${(1 - splitRatio) * 100}%` }}
        className={`relative flex flex-col min-w-0 bg-shell/40 transition-colors ${
          activePane === 'secondary' ? 'ring-1 ring-accent/30 z-10' : ''
        }`}
        onClick={() => setActivePane('secondary')}
      >
        {/* Compact Pane Titlebar */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-line bg-surface/80 px-3 backdrop-blur-xs">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setPickerTarget('secondary')}
              title="Click to switch tool in right pane"
              className="group flex items-center gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-raised cursor-pointer min-w-0"
            >
              {SecondaryIcon && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-raised border border-accent/30 text-accent">
                  <SecondaryIcon size={13} />
                </span>
              )}
              <div className="min-w-0 flex items-baseline gap-1.5">
                <span className="truncate text-[13px] font-medium text-ink group-hover:text-accent transition-colors">
                  {secondaryTool?.name ?? effectiveSecondaryId}
                </span>
                <span className="hidden sm:inline font-mono text-[9.5px] uppercase text-faint">
                  {secondaryCategory?.label ?? secondaryTool?.category}
                </span>
              </div>
              <ChevronDown
                size={12}
                className="text-faint transition-transform group-hover:text-dim"
              />
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleSwap}
              title="Swap left and right tools (⇄)"
              aria-label="Swap tools"
              className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-raised hover:text-ink transition-colors cursor-pointer"
            >
              <ArrowLeftRight size={13} />
            </button>
            <button
              type="button"
              onClick={handleMaximizeSecondary}
              title="Focus/Maximize this tool (⤢)"
              aria-label="Maximize right tool"
              className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-raised hover:text-ink transition-colors cursor-pointer"
            >
              <Maximize2 size={13} />
            </button>
            <button
              type="button"
              onClick={handleClose}
              title="Close split screen (✕)"
              aria-label="Close split screen"
              className="flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-danger/20 hover:text-danger transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Pane Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <ToolPage toolId={effectiveSecondaryId} embedded={true} />
        </div>
      </div>

      {/* Quick Tool Switcher Dialog */}
      <ToolQuickPicker
        open={pickerTarget !== null}
        onOpenChange={(open) => !open && setPickerTarget(null)}
        currentToolId={pickerTarget === 'primary' ? primaryToolId : effectiveSecondaryId}
        title={pickerTarget === 'primary' ? 'Switch Left Pane Tool' : 'Switch Right Pane Tool'}
        onSelectTool={(newToolId) => {
          if (pickerTarget === 'primary') {
            openTool(newToolId)
          } else if (pickerTarget === 'secondary') {
            setSecondaryToolId(newToolId)
          }
        }}
      />
    </div>
  )
}
