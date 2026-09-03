import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileBox,
  FileCode,
  FileText,
  FolderArchive,
  FolderOpen,
  HardDrive,
  ImageIcon,
  LayoutGrid,
  List,
  Music,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Video,
  Wrench,
  X
} from 'lucide-react'
import type { AssetRecord } from '../../../shared/ipc'
import { formatBytes } from '../../../shared/utils/files'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog'
import { DropZone } from '../../components/ui/DropZone'
import { EmptyState } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { useAssetTransfer } from '../../stores/asset-transfer'
import {
  filterAndSortAssets,
  getCompatibleTools,
  GALLERY_TABS,
  type GalleryFilterTab,
  type GallerySortOption
} from './gallery-routing'
import { formatRelativeTime } from '../shell/usage-analytics'

// Helper to render type icons
function AssetTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  switch (type) {
    case 'image':
      return <ImageIcon size={size} className="text-pink-400" />
    case 'document':
      return <FileText size={size} className="text-blue-400" />
    case 'audio':
      return <Music size={size} className="text-cyan-400" />
    case 'video':
      return <Video size={size} className="text-purple-400" />
    case 'archive':
      return <FolderArchive size={size} className="text-amber-400" />
    case 'code':
      return <FileCode size={size} className="text-emerald-400" />
    default:
      return <FileBox size={size} className="text-dim" />
  }
}

// Lazy thumbnail loader for images
function ImageThumbnail({ path }: { path: string }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let createdUrl: string | null = null

    async function load() {
      try {
        const { bytes } = await window.stash.fs.readFileBytes({
          path,
          maxBytes: 4 * 1024 * 1024
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
      <div className="flex h-full w-full items-center justify-center bg-base/40">
        <ImageIcon size={28} className="text-pink-400/60" />
      </div>
    )
  }

  return (
    <img
      src={thumbUrl}
      alt="thumbnail"
      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
      loading="lazy"
    />
  )
}

export function GalleryView({ initialFilter }: { initialFilter?: string }) {
  const [assets, setAssets] = useState<AssetRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<GalleryFilterTab>(
    (initialFilter as GalleryFilterTab) || 'all'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<GallerySortOption>('accessed')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [routeTargetAsset, setRouteTargetAsset] = useState<AssetRecord | null>(null)
  const routeToTool = useAssetTransfer((s) => s.routeToTool)

  // Load assets from SQLite
  const loadAssets = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.stash.assets.list({ limit: 1000 })
      setAssets(data)
    } catch (err) {
      setAssets([])
      toastError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAssets()
  }, [loadAssets])

  // Compute aggregate stats
  const stats = useMemo(() => {
    const total = assets.length
    const totalSize = assets.reduce((sum, a) => sum + (a.fileSize || 0), 0)
    const favCount = assets.filter((a) => a.favorite).length
    const missingCount = assets.filter((a) => a.exists === false).length
    return { total, totalSize, favCount, missingCount }
  }, [assets])

  // Filtered and sorted assets
  const displayedAssets = useMemo(() => {
    return filterAndSortAssets(assets, activeTab, searchQuery, sortOption)
  }, [assets, activeTab, searchQuery, sortOption])

  // Actions
  const handleAddFiles = async () => {
    try {
      const result = await window.stash.dialogs.openFile({
        title: 'Add local files to Asset Stash',
        multiSelections: true
      })
      if (!result.cancelled && result.paths.length > 0) {
        const added = await window.stash.assets.addBatch(result.paths)
        toastSuccess(`Added ${added.length} file reference${added.length > 1 ? 's' : ''} to Stash`)
        await loadAssets()
      }
    } catch (err) {
      toastError(err)
    }
  }

  const handleToggleFavorite = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      const newFav = await window.stash.assets.toggleFavorite(id)
      setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, favorite: newFav } : a)))
    } catch (err) {
      toastError(err)
    }
  }

  const handleRemoveAsset = async (id: number, fileName: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await window.stash.assets.remove(id)
      setAssets((prev) => prev.filter((a) => a.id !== id))
      toastSuccess(`Removed "${fileName}" reference from Stash`)
    } catch (err) {
      toastError(err)
    }
  }

  const handleReveal = async (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await window.stash.shell.revealPath(filePath)
    } catch (err) {
      toastError(err)
    }
  }

  const handleCopyPath = async (filePath: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await navigator.clipboard.writeText(filePath)
      toastSuccess('Copied path to clipboard')
    } catch (err) {
      toastError(err)
    }
  }

  const handleCleanupMissing = async () => {
    try {
      const removed = await window.stash.assets.cleanupMissing()
      if (removed > 0) {
        toastSuccess(`Cleaned up ${removed} missing file reference${removed > 1 ? 's' : ''}`)
        await loadAssets()
      } else {
        toastSuccess('All referenced files exist on disk')
      }
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl 2xl:max-w-7xl px-6 sm:px-8 py-8 space-y-7">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-raised/80 shadow-[0_0_24px_-8px_var(--color-accent-glow)]">
            <FolderArchive size={22} className="text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">Asset Stash</h1>
              <Badge
                variant="outline"
                className="border-accent/40 text-accent font-mono text-[10px]"
              >
                LOCAL REFERENCES · NO DUPLICATION
              </Badge>
            </div>
            <p className="text-[13px] text-dim mt-0.5">
              Instant access to your working files on PC. Zero byte duplication, zero cloud
              dependency.
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadAssets}
            disabled={loading}
            className="gap-1.5 cursor-pointer text-xs"
            title="Refresh local catalog"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden md:inline">Refresh</span>
          </Button>

          {stats.missingCount > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCleanupMissing}
              className="gap-1.5 cursor-pointer text-xs"
              title="Clean references to deleted files"
            >
              <Trash2 size={13} />
              <span>Clean Missing ({stats.missingCount})</span>
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={handleAddFiles}
            className="gap-1.5 cursor-pointer text-xs"
          >
            <Plus size={14} />
            <span>Add Files</span>
          </Button>
        </div>
      </div>

      {/* 4 Summary Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tracked Files */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-dim uppercase tracking-wider">
              Referenced Files
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
              <Boxes size={16} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-ink font-mono">
              {stats.total}
            </div>
            <p className="text-xs text-faint mt-1">Lightweight local pointers</p>
          </CardContent>
        </Card>

        {/* Card 2: Disk Size Represented */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-dim uppercase tracking-wider">
              Disk Footprint
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
              <HardDrive size={16} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-ink font-mono">
              {formatBytes(stats.totalSize)}
            </div>
            <p className="text-xs text-faint mt-1">0 bytes duplicated by Stash</p>
          </CardContent>
        </Card>

        {/* Card 3: Favorites Count */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-dim uppercase tracking-wider">
              Starred Assets
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
              <Star size={16} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-ink font-mono">
              {stats.favCount}
            </div>
            <p className="text-xs text-faint mt-1">Pinned for quick access</p>
          </CardContent>
        </Card>

        {/* Card 4: Integrity Status */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-dim uppercase tracking-wider">
              Integrity
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ok/10 text-ok">
              <CheckCircle2 size={16} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-ink font-mono">
              {stats.missingCount === 0
                ? '100%'
                : `${stats.total - stats.missingCount}/${stats.total}`}
            </div>
            <p className="text-xs text-faint mt-1">
              {stats.missingCount === 0
                ? 'All local paths verified'
                : `${stats.missingCount} file(s) moved`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Search & Layout Switcher */}
      <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {GALLERY_TABS.map((tab) => {
              const count =
                tab.id === 'all'
                  ? assets.length
                  : tab.id === 'favorites'
                    ? assets.filter((a) => a.favorite).length
                    : tab.id === 'media'
                      ? assets.filter((a) => a.fileType === 'audio' || a.fileType === 'video')
                          .length
                      : assets.filter((a) => a.fileType === tab.id).length

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-accent text-base font-semibold shadow-xs'
                      : 'text-dim hover:text-ink hover:bg-raised/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                      activeTab === tab.id ? 'bg-base/30 text-ink' : 'bg-base text-faint'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Search, Sort, and View Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files, paths, tags..."
                className="w-48 rounded-md border border-line bg-base/80 pl-8 pr-3 py-1 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as GallerySortOption)}
              className="rounded-md border border-line bg-base/80 px-2 py-1 text-xs text-dim focus:border-accent focus:outline-none cursor-pointer"
            >
              <option value="accessed">Recently Accessed</option>
              <option value="added">Recently Added</option>
              <option value="name">Name (A-Z)</option>
              <option value="size">Size (Largest)</option>
            </select>

            {/* Grid / List Switcher */}
            <div className="flex items-center rounded-md border border-line bg-base/80 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`cursor-pointer p-1 rounded ${
                  viewMode === 'grid' ? 'bg-raised text-ink' : 'text-faint hover:text-dim'
                }`}
                title="Grid View"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`cursor-pointer p-1 rounded ${
                  viewMode === 'list' ? 'bg-raised text-ink' : 'text-faint hover:text-dim'
                }`}
                title="List View"
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {displayedAssets.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon="search"
                title={
                  assets.length === 0 ? 'Your Asset Stash is empty' : 'No matching files found'
                }
                hint={
                  assets.length === 0
                    ? 'Add local files with the button above or drag-and-drop files anywhere into tools to index them.'
                    : 'Try clearing your search query or switching category tabs.'
                }
                action={
                  assets.length === 0 ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAddFiles}
                      className="gap-1.5"
                    >
                      <Plus size={14} />
                      Browse Files to Add
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayedAssets.map((asset) => {
                const isImage = asset.fileType === 'image'
                const isMissing = asset.exists === false

                return (
                  <div
                    key={asset.id}
                    className="group relative flex flex-col justify-between rounded-lg border border-line/70 bg-surface/50 p-3 transition-all hover:border-accent/40 hover:bg-surface hover:shadow-lg"
                  >
                    {/* Top Thumbnail / Banner Box */}
                    <div className="relative mb-3 aspect-video w-full overflow-hidden rounded-md border border-line/50 bg-base/50 flex items-center justify-center">
                      {isImage && !isMissing ? (
                        <ImageThumbnail path={asset.filePath} />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-center p-3">
                          <AssetTypeIcon type={asset.fileType} size={32} />
                          <span className="font-mono text-[10px] uppercase font-semibold text-faint">
                            {asset.fileName.split('.').pop() || asset.fileType}
                          </span>
                        </div>
                      )}

                      {/* Favorite Button Overlay */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(asset.id, e)}
                        className={`absolute top-1.5 right-1.5 cursor-pointer rounded-full p-1.5 backdrop-blur-md transition-all ${
                          asset.favorite
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-base/70 text-faint hover:text-ink opacity-0 group-hover:opacity-100'
                        }`}
                        title={asset.favorite ? 'Unstar' : 'Star'}
                      >
                        <Star size={13} fill={asset.favorite ? 'currentColor' : 'none'} />
                      </button>

                      {/* Missing Badge */}
                      {isMissing && (
                        <div className="absolute bottom-1.5 left-1.5 rounded bg-danger/90 px-1.5 py-0.5 text-[9px] font-semibold text-white flex items-center gap-1 shadow-md">
                          <AlertCircle size={10} />
                          <span>Missing</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className="truncate text-xs font-semibold text-ink group-hover:text-accent transition-colors"
                          title={asset.fileName}
                        >
                          {asset.fileName}
                        </h4>
                        <span className="shrink-0 font-mono text-[10.5px] text-faint">
                          {formatBytes(asset.fileSize)}
                        </span>
                      </div>

                      <p
                        className="truncate font-mono text-[10.5px] text-dim"
                        title={asset.filePath}
                      >
                        {asset.filePath}
                      </p>

                      <div className="flex items-center gap-2 pt-1 text-[10.5px] text-faint font-mono">
                        <span className="capitalize">{asset.fileType}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(asset.lastAccessedMs)}</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between gap-1.5 border-t border-line/50 pt-2.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRouteTargetAsset(asset)}
                        disabled={isMissing}
                        className="flex-1 gap-1 text-[11px] h-7 cursor-pointer"
                        title="Route into a Stash tool"
                      >
                        <Wrench size={12} className="text-accent" />
                        <span>Use in Tool</span>
                      </Button>

                      <button
                        type="button"
                        onClick={(e) => handleReveal(asset.filePath, e)}
                        className="cursor-pointer rounded p-1.5 text-dim hover:text-ink hover:bg-raised transition-colors"
                        title="Reveal in File Explorer"
                      >
                        <FolderOpen size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleCopyPath(asset.filePath, e)}
                        className="cursor-pointer rounded p-1.5 text-dim hover:text-ink hover:bg-raised transition-colors"
                        title="Copy file path"
                      >
                        <Copy size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleRemoveAsset(asset.id, asset.fileName, e)}
                        className="cursor-pointer rounded p-1.5 text-dim hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Remove reference from Stash (keeps file on disk)"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* List View */
            <div className="space-y-1.5">
              {displayedAssets.map((asset) => {
                const isMissing = asset.exists === false

                return (
                  <div
                    key={asset.id}
                    className={`group flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-surface/50 px-3.5 py-2.5 transition-all hover:bg-surface hover:border-line ${
                      isMissing ? 'border-danger/20 bg-danger/5' : ''
                    }`}
                  >
                    {/* Left: Type Icon + Name + Path */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line/80 bg-raised/80">
                        <AssetTypeIcon type={asset.fileType} size={15} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="truncate text-xs font-semibold text-ink group-hover:text-accent transition-colors"
                            title={asset.fileName}
                          >
                            {asset.fileName}
                          </span>
                          <span className="rounded bg-base px-1.5 py-0.2 font-mono text-[9px] uppercase tracking-wider text-faint border border-line/50">
                            {asset.fileType}
                          </span>
                          {isMissing && (
                            <span className="rounded bg-danger/20 text-danger border border-danger/30 px-1.5 py-0.2 font-mono text-[9px] font-semibold">
                              Missing
                            </span>
                          )}
                        </div>
                        <p
                          className="truncate font-mono text-[11px] text-dim"
                          title={asset.filePath}
                        >
                          {asset.filePath}
                        </p>
                      </div>
                    </div>

                    {/* Right: Size + Time + Action Buttons */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs text-faint">
                        {formatBytes(asset.fileSize)}
                      </span>

                      <span
                        className="font-mono text-xs text-dim hidden sm:inline"
                        title={new Date(asset.lastAccessedMs).toLocaleString()}
                      >
                        {formatRelativeTime(asset.lastAccessedMs)}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(asset.id, e)}
                        className={`cursor-pointer rounded p-1.5 transition-colors ${
                          asset.favorite ? 'text-amber-400' : 'text-faint hover:text-dim'
                        }`}
                        title={asset.favorite ? 'Unstar' : 'Star'}
                      >
                        <Star size={13} fill={asset.favorite ? 'currentColor' : 'none'} />
                      </button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setRouteTargetAsset(asset)}
                        disabled={isMissing}
                        className="gap-1 text-[11px] h-7 cursor-pointer"
                      >
                        <Wrench size={12} className="text-accent" />
                        <span>Use in Tool</span>
                      </Button>

                      <button
                        type="button"
                        onClick={(e) => handleReveal(asset.filePath, e)}
                        className="cursor-pointer rounded p-1.5 text-dim hover:text-ink hover:bg-raised transition-colors"
                        title="Reveal in File Explorer"
                      >
                        <FolderOpen size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleCopyPath(asset.filePath, e)}
                        className="cursor-pointer rounded p-1.5 text-dim hover:text-ink hover:bg-raised transition-colors"
                        title="Copy file path"
                      >
                        <Copy size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleRemoveAsset(asset.id, asset.fileName, e)}
                        className="cursor-pointer rounded p-1.5 text-dim hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Remove reference from Stash"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drop Surface Footer */}
      <div className="border border-dashed border-line rounded-xl p-6 bg-surface/30 text-center space-y-2">
        <DropZone
          multiple
          label="Drop any local files here to add them to your Asset Stash"
          hint="Files stay in their original location on your disk. No bytes are duplicated."
          onFiles={async (paths) => {
            if (paths.length > 0) {
              const added = await window.stash.assets.addBatch(paths)
              toastSuccess(
                `Added ${added.length} file reference${added.length > 1 ? 's' : ''} to Stash`
              )
              await loadAssets()
            }
          }}
        />
      </div>

      {/* Route to Tool Dialog Modal */}
      {routeTargetAsset && (
        <Dialog
          open={Boolean(routeTargetAsset)}
          onOpenChange={(open) => !open && setRouteTargetAsset(null)}
        >
          <DialogContent className="max-w-md border-line bg-surface text-ink">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-raised">
                  <AssetTypeIcon type={routeTargetAsset.fileType} size={20} />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-base font-semibold text-ink">
                    Open “{routeTargetAsset.fileName}”
                  </DialogTitle>
                  <DialogDescription className="truncate font-mono text-xs text-dim">
                    {routeTargetAsset.filePath}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 my-2">
              <h4 className="text-xs font-semibold text-dim uppercase tracking-wider">
                Compatible Utilities ({getCompatibleTools(routeTargetAsset).length})
              </h4>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {getCompatibleTools(routeTargetAsset).map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      routeToTool(tool.id, routeTargetAsset.filePath)
                      setRouteTargetAsset(null)
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-line/60 bg-base/50 hover:bg-raised hover:border-accent/40 transition-all text-left cursor-pointer group"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-ink group-hover:text-accent">
                        {tool.name}
                      </div>
                      <div className="truncate text-[11px] text-dim">{tool.description}</div>
                    </div>
                    <ExternalLink
                      size={13}
                      className="text-faint group-hover:text-accent shrink-0 ml-2"
                    />
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 border-t border-line pt-3">
              <Button variant="ghost" size="sm" onClick={() => setRouteTargetAsset(null)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void handleReveal(routeTargetAsset.filePath)
                  setRouteTargetAsset(null)
                }}
                className="gap-1.5"
              >
                <FolderOpen size={13} />
                Reveal in Explorer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default GalleryView
