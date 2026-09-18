import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Boxes,
  Check,
  CheckCircle2,
  FileBox,
  FileCode,
  FileText,
  FolderArchive,
  ImageIcon,
  Music,
  RefreshCw,
  Search,
  Star,
  Video,
  X
} from 'lucide-react'
import type { AssetCategory, AssetRecord } from '../../../shared/ipc'
import { formatBytes } from '../../../shared/utils/files'
import { formatRelativeTime } from '../shell/usage-analytics'

interface WorkflowStashPickerModalProps {
  open: boolean
  onClose: () => void
  onAttachAssets: (filePaths: string[]) => void
  alreadyAttachedPaths?: string[]
  recommendedCategory?: string
}

type StashTab =
  | 'all'
  | 'recommended'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'archive'
  | 'code'
  | 'favorites'

// Thumbnail preview component for image assets
function StashImageThumbnail({ path }: { path: string }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let createdUrl: string | null = null

    async function load() {
      try {
        if (!window.stash?.fs?.readFileBytes) return
        const { bytes } = await window.stash.fs.readFileBytes({
          path,
          maxBytes: 2 * 1024 * 1024
        })
        if (!active) return
        const blob = new Blob([bytes])
        createdUrl = URL.createObjectURL(blob)
        setThumbUrl(createdUrl)
      } catch {
        if (active) setFailed(true)
      }
    }

    void load()

    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [path])

  if (failed || !thumbUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-base/60">
        <ImageIcon size={20} className="text-pink-400/50" />
      </div>
    )
  }

  return (
    <img
      src={thumbUrl}
      alt="stash-asset"
      className="h-full w-full object-cover rounded"
      loading="lazy"
    />
  )
}

function StashAssetIcon({ type, size = 18 }: { type: AssetCategory; size?: number }) {
  switch (type) {
    case 'image':
      return <ImageIcon size={size} className="text-pink-400 shrink-0" />
    case 'document':
      return <FileText size={size} className="text-blue-400 shrink-0" />
    case 'audio':
      return <Music size={size} className="text-cyan-400 shrink-0" />
    case 'video':
      return <Video size={size} className="text-purple-400 shrink-0" />
    case 'archive':
      return <FolderArchive size={size} className="text-amber-400 shrink-0" />
    case 'code':
      return <FileCode size={size} className="text-emerald-400 shrink-0" />
    default:
      return <FileBox size={size} className="text-dim shrink-0" />
  }
}

export function WorkflowStashPickerModal({
  open,
  onClose,
  onAttachAssets,
  alreadyAttachedPaths = [],
  recommendedCategory
}: WorkflowStashPickerModalProps) {
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<StashTab>(recommendedCategory ? 'recommended' : 'all')
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())

  // Reset tab and selections whenever modal opens
  useEffect(() => {
    if (open) {
      setActiveTab(recommendedCategory ? 'recommended' : 'all')
      setSelectedPaths(new Set())
      setSearchQuery('')
    }
  }, [open, recommendedCategory])

  // Load assets from SQLite Stash store
  const loadAssets = useCallback(async () => {
    if (!window.stash?.assets?.list) {
      setAssets([])
      return
    }
    setLoading(true)
    try {
      const data = await window.stash.assets.list({ limit: 500 })
      setAssets(data)
    } catch (err) {
      console.warn('Failed to load stash assets', err)
      setAssets([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      void loadAssets()
    }
  }, [open, loadAssets])

  // Filter assets based on activeTab and searchQuery
  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return assets.filter((asset) => {
      // Search query
      if (q) {
        const matchesName = asset.fileName.toLowerCase().includes(q)
        const matchesPath = asset.filePath.toLowerCase().includes(q)
        if (!matchesName && !matchesPath) return false
      }

      // Tab filtering
      if (activeTab === 'all') return true
      if (activeTab === 'favorites') return Boolean(asset.favorite)
      if (activeTab === 'recommended' && recommendedCategory) {
        return asset.fileType === recommendedCategory
      }
      return asset.fileType === activeTab
    })
  }, [assets, activeTab, recommendedCategory, searchQuery])

  // Toggle selection
  const handleToggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  // Select all visible / filtered
  const handleSelectAllFiltered = () => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      filteredAssets.forEach((a) => next.add(a.filePath))
      return next
    })
  }

  // Clear selection
  const handleClearSelection = () => {
    setSelectedPaths(new Set())
  }

  // Animation lifecycle
  const [isRendered, setIsRendered] = useState(open)
  const [isClosing, setIsClosing] = useState(false)

  const prevOpenRef = useRef(open)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (open) {
      setIsRendered(true)
      setIsClosing(false)
    } else if (prevOpenRef.current && !open && isRendered) {
      setIsClosing(true)
      timer = setTimeout(() => {
        setIsRendered(false)
        setIsClosing(false)
      }, 180)
    } else if (!open) {
      setIsRendered(false)
      setIsClosing(false)
    }
    prevOpenRef.current = open
    return () => clearTimeout(timer)
  }, [open, isRendered])

  const handleRequestClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsRendered(false)
      setIsClosing(false)
      onClose()
    }, 180)
  }, [onClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        handleRequestClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleRequestClose])

  // Submit selection
  const handleConfirmAttach = () => {
    const paths = Array.from(selectedPaths)
    if (paths.length > 0) {
      onAttachAssets(paths)
      handleRequestClose()
    }
  }

  // Single asset instant attach
  const handleInstantAttach = (path: string) => {
    onAttachAssets([path])
    handleRequestClose()
  }

  if (!isRendered) return null

  return (
    <div
      data-modal="workflow-stash-picker"
      onWheel={(e) => e.stopPropagation()}
      onClick={handleRequestClose}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 ${
        isClosing ? 'anim-backdrop-out pointer-events-none' : 'anim-backdrop-in pointer-events-auto'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full max-w-2xl max-h-[85vh] flex-col rounded-xl border border-line bg-shell shadow-2xl overscroll-contain ${
          isClosing ? 'anim-modal-out' : 'anim-modal-in'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-surface/70 rounded-t-xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/30 bg-base text-accent">
              <Boxes size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Stash & Gallery Quick Access</h3>
              <p className="text-[11px] text-dim">
                Attach saved workspace assets directly into this workflow node
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void loadAssets()}
              title="Refresh stash assets"
              className="cursor-pointer rounded p-1.5 text-faint hover:text-ink hover:bg-surface transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleRequestClose}
              className="cursor-pointer rounded p-1.5 text-faint hover:text-ink hover:bg-surface transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="border-b border-line p-3 space-y-2.5 bg-base/40 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stash assets by filename or path..."
              className="w-full rounded-lg border border-line bg-base pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-faint outline-none focus:border-accent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-faint hover:text-ink cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            {recommendedCategory && (
              <button
                type="button"
                onClick={() => setActiveTab('recommended')}
                className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  activeTab === 'recommended'
                    ? 'bg-accent text-accent-contrast font-semibold'
                    : 'bg-surface/60 text-dim hover:text-ink hover:bg-raised'
                }`}
              >
                Recommended ({recommendedCategory})
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'all'
                  ? 'bg-accent text-accent-contrast font-semibold'
                  : 'bg-surface/60 text-dim hover:text-ink hover:bg-raised'
              }`}
            >
              All ({assets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('image')}
              className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'image'
                  ? 'bg-accent text-accent-contrast font-semibold'
                  : 'bg-surface/60 text-dim hover:text-ink hover:bg-raised'
              }`}
            >
              Images
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('document')}
              className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'document'
                  ? 'bg-accent text-accent-contrast font-semibold'
                  : 'bg-surface/60 text-dim hover:text-ink hover:bg-raised'
              }`}
            >
              Documents
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audio')}
              className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'audio'
                  ? 'bg-accent text-accent-contrast font-semibold'
                  : 'bg-surface/60 text-dim hover:text-ink hover:bg-raised'
              }`}
            >
              Audio
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('video')}
              className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeTab === 'video'
                  ? 'bg-accent text-accent-contrast font-semibold'
                  : 'bg-surface/60 text-dim hover:text-ink hover:bg-raised'
              }`}
            >
              Video
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('favorites')}
              className={`cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium transition-colors flex items-center gap-1 ${
                activeTab === 'favorites'
                  ? 'bg-accent text-accent-contrast font-semibold'
                  : 'bg-surface/60 text-dim hover:text-ink hover:bg-raised'
              }`}
            >
              <Star size={11} className={activeTab === 'favorites' ? 'fill-accent-contrast' : ''} />
              Favorites
            </button>
          </div>
        </div>

        {/* Assets List / Grid */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-dim space-y-2">
              <RefreshCw size={24} className="animate-spin text-accent" />
              <p className="text-xs">Loading stash assets...</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-dim space-y-2">
              <Boxes size={32} className="text-faint/60" />
              <p className="text-xs font-medium text-ink">No matching assets found</p>
              <p className="text-[11px] text-faint max-w-sm">
                Files generated by tools or imported into Hermanos Stash will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredAssets.map((asset) => {
                const isSelected = selectedPaths.has(asset.filePath)
                const isAlreadyAttached = alreadyAttachedPaths.includes(asset.filePath)

                return (
                  <div
                    key={asset.id}
                    onClick={() => handleToggleSelect(asset.filePath)}
                    onDoubleClick={() => handleInstantAttach(asset.filePath)}
                    className={`group relative flex flex-col rounded-lg border p-2 text-left cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'border-accent bg-accent/10 ring-1 ring-accent'
                        : isAlreadyAttached
                          ? 'border-line/80 bg-surface/30 opacity-75'
                          : 'border-line bg-surface/50 hover:bg-surface hover:border-line-strong'
                    }`}
                  >
                    {/* Visual Header / Thumbnail */}
                    <div className="relative h-20 w-full overflow-hidden rounded bg-base/70 mb-2">
                      {asset.fileType === 'image' ? (
                        <StashImageThumbnail path={asset.filePath} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <StashAssetIcon type={asset.fileType} size={28} />
                        </div>
                      )}

                      {/* Selection indicator */}
                      <div
                        className={`absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent text-accent-contrast'
                            : 'border-line-strong bg-base/80 text-transparent group-hover:border-line'
                        }`}
                      >
                        <Check size={11} className="stroke-[3]" />
                      </div>

                      {/* Attached pill */}
                      {isAlreadyAttached && (
                        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-base/90 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 size={9} /> Attached
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-[11.5px] font-medium text-ink group-hover:text-accent transition-colors"
                        title={asset.fileName}
                      >
                        {asset.fileName}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-faint font-mono">
                        <span>{formatBytes(asset.fileSize)}</span>
                        <span>{formatRelativeTime(asset.addedMs)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-line px-5 py-3 bg-surface/80 rounded-b-xl shrink-0">
          <div className="flex items-center gap-2">
            {filteredAssets.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="cursor-pointer text-[11px] text-dim hover:text-ink hover:underline"
                >
                  Select all ({filteredAssets.length})
                </button>
                {selectedPaths.size > 0 && (
                  <>
                    <span className="text-faint">•</span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="cursor-pointer text-[11px] text-faint hover:text-dim hover:underline"
                    >
                      Clear selection
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRequestClose}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs text-dim hover:text-ink hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAttach}
              disabled={selectedPaths.size === 0}
              className={`cursor-pointer rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
                selectedPaths.size > 0
                  ? 'bg-accent text-accent-contrast hover:bg-accent-hover shadow'
                  : 'bg-surface text-faint border border-line cursor-not-allowed opacity-60'
              }`}
            >
              Attach Selected ({selectedPaths.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
