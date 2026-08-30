import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  CornerLeftUp,
  Download,
  Eye,
  FileCode,
  FileText,
  Film,
  Folder,
  FolderOpen,
  ImageIcon,
  KeyRound,
  List,
  Lock,
  Maximize2,
  Minimize2,
  Music,
  PanelLeft,
  Unlock,
  X
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { DropZone } from '../../components/ui/DropZone'
import { ErrorNote, Panel, Spinner } from '../../components/ui/Feedback'
import { ClearableTagInput } from '../../components/ui/Inputs'
import { formatBytes } from '../../../shared/utils/files'
import { type StashError, stashError } from '../../../shared/errors'
import type { ArchiveEntryInfo, ArchiveInspectResult } from '../../../shared/ipc'
import { toastError, toastSuccess } from '../../stores/toasts'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  type ArchiveCategoryFilter,
  categorizeEntry,
  filterArchiveEntries,
  formatCompressionRatio,
  getFolderViewData,
  guessMimeType
} from './logic'

interface PreviewState {
  bytes: Uint8Array
  mimeType: string
  blobUrl?: string
  text?: string
}

type LayoutMode = 'split' | 'tree' | 'preview'

const SUPPORTED_ARCHIVES = ['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz']

const CATEGORY_TABS: Array<{ id: ArchiveCategoryFilter; label: string; icon: typeof Folder }> = [
  { id: 'all', label: 'All', icon: Archive },
  { id: 'image', label: 'Images', icon: ImageIcon },
  { id: 'video', label: 'Videos', icon: Film },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'text', label: 'Code & Text', icon: FileCode },
  { id: 'pdf', label: 'PDFs', icon: FileText }
]

export default function ArchiveInspectTool() {
  const [archivePath, setArchivePath] = useState<string | null>(null)
  const [inspectResult, setInspectResult] = useState<ArchiveInspectResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<StashError | null>(null)

  // Password & Security State
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [unlocked, setUnlocked] = useState(true)

  // Explorer State
  const [currentDir, setCurrentDir] = useState('')
  const [viewMode, setViewMode] = useState<'folder' | 'flat'>('folder')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split')
  const [showPreviewSidebar, setShowPreviewSidebar] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ArchiveCategoryFilter>('all')
  const [selectedEntry, setSelectedEntry] = useState<ArchiveEntryInfo | null>(null)

  // Live In-Memory Preview State
  const [previewData, setPreviewData] = useState<PreviewState | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [extracting, setExtracting] = useState(false)

  // Cleanup object URLs when preview changes or tool unmounts
  useEffect(() => {
    return () => {
      if (previewData?.blobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewData.blobUrl)
      }
    }
  }, [previewData])

  const clearArchive = useCallback(() => {
    if (previewData?.blobUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewData.blobUrl)
    }
    setArchivePath(null)
    setInspectResult(null)
    setSelectedEntry(null)
    setPreviewData(null)
    setPassword('')
    setError(null)
    setCurrentDir('')
    setLayoutMode('split')
    setShowPreviewSidebar(true)
    setSearchQuery('')
    setCategoryFilter('all')
    setUnlocked(true)
    setVideoError(false)
  }, [previewData])

  const loadArchive = useCallback(async (targetPath: string, pass?: string) => {
    setLoading(true)
    setError(null)
    setSelectedEntry(null)
    setPreviewData(null)
    setCurrentDir('')
    setLayoutMode('split')
    setShowPreviewSidebar(true)
    setVideoError(false)

    try {
      const result = await window.stash.archives.inspect({
        path: targetPath,
        ...(pass ? { password: pass } : {})
      })

      setArchivePath(targetPath)
      setInspectResult(result)
      setUnlocked(!result.isEncrypted || Boolean(pass))

      recordHistoryQuietly({
        toolId: 'archive-inspect',
        operation: 'Inspect Archive',
        inputs: [fileNameOf(targetPath)],
        outputs: [],
        status: 'success'
      })
    } catch (err) {
      setError(
        stashError(
          'FS_READ',
          `Could not inspect archive: ${err instanceof Error ? err.message : String(err)}`
        )
      )
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDrop = (paths: string[]) => {
    const p = paths[0]
    if (!p) return
    void loadArchive(p)
  }

  const handleUnlock = async () => {
    if (!archivePath) return
    setError(null)
    setLoading(true)

    try {
      // 1. Re-inspect archive with password to read entries if header was encrypted
      const freshResult = await window.stash.archives.inspect({
        path: archivePath,
        password: password.trim()
      })

      if (freshResult.isEncrypted && freshResult.entries.length === 0) {
        throw stashError(
          'VALIDATION',
          'Incorrect password for archive. Please verify and try again.'
        )
      }

      // 2. If archive has encrypted files, test-read the first encrypted file to verify key
      const firstFile = freshResult.entries.find((e) => !e.isDirectory && e.isEncrypted)
      if (firstFile) {
        await window.stash.archives.readEntry({
          archivePath,
          entryPath: firstFile.path,
          password: password.trim()
        })
      }

      setInspectResult(freshResult)
      setUnlocked(true)
      toastSuccess('Archive unlocked successfully')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(
        stashError(
          'VALIDATION',
          msg.toLowerCase().includes('password') || msg.toLowerCase().includes('passphrase')
            ? 'Incorrect password for archive. Please verify and try again.'
            : `Could not unlock archive: ${msg}`
        )
      )
    } finally {
      setLoading(false)
    }
  }

  // Load preview for a selected entry
  const selectEntry = useCallback(
    async (entry: ArchiveEntryInfo) => {
      if (!archivePath || entry.isDirectory) return

      setSelectedEntry(entry)
      setPreviewLoading(true)
      setVideoError(false)
      setError(null)

      if (previewData?.blobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewData.blobUrl)
      }
      setPreviewData(null)

      try {
        const readRes = await window.stash.archives.readEntry({
          archivePath,
          entryPath: entry.path,
          ...(password ? { password: password.trim() } : {})
        })

        const uint8 =
          readRes.bytes instanceof Uint8Array ? readRes.bytes : new Uint8Array(readRes.bytes)
        const category = categorizeEntry(entry.path, entry.isDirectory)
        let mimeType = readRes.mimeType || guessMimeType(entry.path)

        // Video MIME normalizer for Chromium media engine
        if (
          category === 'video' &&
          (entry.path.toLowerCase().endsWith('.mov') || entry.path.toLowerCase().endsWith('.m4v'))
        ) {
          mimeType = 'video/mp4'
        }

        let blobUrl: string | undefined
        let textContent: string | undefined

        if (readRes.streamUrl) {
          blobUrl = readRes.streamUrl
        } else if (['image', 'video', 'audio', 'pdf'].includes(category)) {
          const blob = new Blob([uint8 as unknown as BlobPart], { type: mimeType })
          blobUrl = URL.createObjectURL(blob)
        } else if (category === 'text') {
          textContent = new TextDecoder('utf-8').decode(uint8)
        }

        setPreviewData({
          bytes: uint8,
          mimeType,
          blobUrl,
          text: textContent
        })
      } catch (err) {
        setError(
          stashError(
            'FS_READ',
            `Could not preview "${entry.name}": ${err instanceof Error ? err.message : String(err)}`
          )
        )
      } finally {
        setPreviewLoading(false)
      }
    },
    [archivePath, password, previewData]
  )

  const handleCopyText = async () => {
    if (!previewData?.text) return
    try {
      await navigator.clipboard.writeText(previewData.text)
      setCopied(true)
      toastSuccess('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toastError('Failed to copy text')
    }
  }

  const handleExtractSingle = async () => {
    if (!archivePath || !selectedEntry) return

    setExtracting(true)
    try {
      const defaultName = selectedEntry.name
      const saveRes = await window.stash.dialogs.saveFile({
        title: `Extract ${selectedEntry.name}`,
        defaultName
      })

      if (saveRes.cancelled || !saveRes.path) return

      await window.stash.archives.extractEntry({
        archivePath,
        entryPath: selectedEntry.path,
        targetPath: saveRes.path,
        ...(password ? { password: password.trim() } : {})
      })

      toastSuccess(`Extracted "${selectedEntry.name}"`)
      recordHistoryQuietly({
        toolId: 'archive-inspect',
        operation: 'Extract Single Entry',
        inputs: [selectedEntry.name],
        outputs: [saveRes.path],
        status: 'success'
      })
    } catch (err) {
      toastError(err)
    } finally {
      setExtracting(false)
    }
  }

  // Folder View Data & Filtering
  const isGlobalFiltering = Boolean(searchQuery.trim() || categoryFilter !== 'all')

  const folderViewData = useMemo(() => {
    if (!inspectResult?.entries) return { currentPath: '', breadcrumbs: [], items: [] }
    return getFolderViewData(inspectResult.entries, currentDir)
  }, [inspectResult?.entries, currentDir])

  const flatFilteredEntries = useMemo(() => {
    if (!inspectResult?.entries) return []
    return filterArchiveEntries(inspectResult.entries, {
      query: searchQuery,
      category: categoryFilter
    })
  }, [inspectResult?.entries, searchQuery, categoryFilter])

  // Sequential File Stepping (Next / Previous)
  const activeFileList = useMemo(() => {
    if (isGlobalFiltering || viewMode === 'flat') {
      return flatFilteredEntries.filter((e) => !e.isDirectory)
    }
    return folderViewData.items.filter((i) => !i.isDirectory && i.entry).map((i) => i.entry!)
  }, [isGlobalFiltering, viewMode, flatFilteredEntries, folderViewData.items])

  const currentIndex = useMemo(() => {
    if (!selectedEntry) return -1
    return activeFileList.findIndex((e) => e.path === selectedEntry.path)
  }, [activeFileList, selectedEntry])

  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < activeFileList.length - 1

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      void selectEntry(activeFileList[currentIndex - 1])
    }
  }, [hasPrev, activeFileList, currentIndex, selectEntry])

  const goToNext = useCallback(() => {
    if (hasNext) {
      void selectEntry(activeFileList[currentIndex + 1])
    }
  }, [hasNext, activeFileList, currentIndex, selectEntry])

  // Keyboard navigation shortcuts in full preview mode
  useEffect(() => {
    if (layoutMode !== 'preview') return

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goToPrev()
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [layoutMode, goToPrev, goToNext])

  const navigateUp = () => {
    if (!currentDir) return
    const parts = currentDir.split('/').filter(Boolean)
    parts.pop()
    setCurrentDir(parts.join('/'))
  }

  const renderTypeIcon = (category: string, isDir = false) => {
    if (isDir) return <Folder size={14} className="text-amber-400" />
    switch (category) {
      case 'image':
        return <ImageIcon size={14} className="text-cyan-400" />
      case 'video':
        return <Film size={14} className="text-rose-400" />
      case 'audio':
        return <Music size={14} className="text-violet-400" />
      case 'pdf':
        return <FileText size={14} className="text-emerald-400" />
      case 'text':
        return <FileCode size={14} className="text-accent" />
      default:
        return <FileText size={14} className="text-dim" />
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorNote error={error} />}

      {!archivePath ? (
        <DropZone
          onFiles={handleDrop}
          accept={SUPPORTED_ARCHIVES}
          label="Drop an archive here"
          hint="Inspect, search, and preview files inside .zip, .rar, .7z, and .tar archives · click to browse"
          dialogTitle="Choose an archive to inspect"
          multiple={false}
        />
      ) : loading ? (
        <Panel className="flex h-72 flex-col items-center justify-center p-8 text-center">
          <Spinner />
          <p className="mt-3 text-[13.5px] font-medium text-ink">Reading archive structure…</p>
          <p className="mt-1 text-[11.5px] text-faint">
            Parsing archive headers and directory structure in-memory.
          </p>
        </Panel>
      ) : (
        <div className="space-y-4">
          {/* Top Bar with Archive info, View Mode Toggle, and Close Button */}
          {archivePath && inspectResult && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface/80 px-3.5 py-2 text-[12px] text-dim">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{fileNameOf(archivePath)}</span>
                {unlocked ? (
                  <>
                    <span className="text-faint">·</span>
                    <span>{inspectResult.fileCount} files</span>
                    {inspectResult.directoryCount > 0 && (
                      <>
                        <span className="text-faint">·</span>
                        <span>{inspectResult.directoryCount} folders</span>
                      </>
                    )}
                    <span className="text-faint">·</span>
                    <span>{formatBytes(inspectResult.totalUncompressedSize)}</span>
                    <span className="text-faint">·</span>
                    <span className="text-emerald-400">
                      {formatCompressionRatio(
                        inspectResult.totalUncompressedSize,
                        inspectResult.totalCompressedSize
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-faint">·</span>
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-400 border border-amber-500/20">
                      <Lock size={10} /> Password Protected
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Segmented Layout Mode Switcher */}
                {unlocked && (
                  <div className="flex items-center rounded border border-line bg-base/60 p-0.5 text-[11px]">
                    <button
                      type="button"
                      title="Split View (Tree & Preview)"
                      onClick={() => setLayoutMode('split')}
                      className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
                        layoutMode === 'split'
                          ? 'bg-surface text-accent font-medium shadow-xs'
                          : 'text-faint hover:text-ink'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Columns2 size={12} /> Split
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Expand File Tree View"
                      onClick={() => setLayoutMode('tree')}
                      className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
                        layoutMode === 'tree'
                          ? 'bg-surface text-accent font-medium shadow-xs'
                          : 'text-faint hover:text-ink'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <FolderOpen size={12} /> Full Tree
                      </span>
                    </button>
                    <button
                      type="button"
                      title={
                        selectedEntry
                          ? 'Expand Preview View'
                          : 'Select a file to expand full preview'
                      }
                      onClick={() => setLayoutMode('preview')}
                      disabled={!selectedEntry}
                      className={`rounded px-2 py-0.5 transition-colors cursor-pointer ${
                        layoutMode === 'preview'
                          ? 'bg-surface text-accent font-medium shadow-xs'
                          : !selectedEntry
                            ? 'opacity-40 cursor-not-allowed text-faint'
                            : 'text-faint hover:text-ink'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Eye size={12} /> Full Preview
                      </span>
                    </button>
                  </div>
                )}

                <IconButton
                  aria-label="Close archive"
                  onClick={clearArchive}
                  disabled={loading || previewLoading}
                >
                  <X size={14} />
                </IconButton>
              </div>
            </div>
          )}

          {inspectResult && inspectResult.isEncrypted && !unlocked ? (
            /* Password Unlock Panel */
            <Panel className="mx-auto max-w-md space-y-4 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
                <KeyRound size={22} />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-ink">Password Protected Archive</h2>
                <p className="mt-1 text-[12px] text-dim">
                  Enter the archive password to unlock and inspect its contents.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter archive password…"
                    value={password}
                    autoFocus
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleUnlock()
                    }}
                    className="h-9 w-full rounded-md border border-line bg-base px-3 pr-9 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-faint hover:text-ink cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <Unlock size={14} /> : <Lock size={14} />}
                  </button>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => void handleUnlock()}
                  className="w-full justify-center"
                  disabled={!password.trim() || loading}
                  loading={loading}
                >
                  <Unlock size={14} />
                  Unlock & Inspect Archive
                </Button>
              </div>
            </Panel>
          ) : (
            /* Workstation Layout */
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Explorer (File Tree) */}
              {(layoutMode === 'split' || layoutMode === 'tree') && (
                <div
                  className={`space-y-3 transition-all ${
                    layoutMode === 'tree' ? 'col-span-12' : 'lg:col-span-6'
                  }`}
                >
                  <Panel className="space-y-3 p-3.5">
                    {/* Search, Filter Tabs, View Mode Switcher, and Tree Expand Button */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <ClearableTagInput
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search files across all folders…"
                          />
                        </div>

                        {/* View Mode Switcher (Folder vs Flat) */}
                        <div className="flex items-center rounded border border-line bg-base/60 p-0.5">
                          <button
                            type="button"
                            title="Folder Hierarchy View"
                            onClick={() => setViewMode('folder')}
                            className={`rounded p-1 transition-colors cursor-pointer ${
                              viewMode === 'folder' && !isGlobalFiltering
                                ? 'bg-surface text-accent'
                                : 'text-faint hover:text-ink'
                            }`}
                          >
                            <FolderOpen size={14} />
                          </button>
                          <button
                            type="button"
                            title="Flat List View"
                            onClick={() => setViewMode('flat')}
                            className={`rounded p-1 transition-colors cursor-pointer ${
                              viewMode === 'flat' || isGlobalFiltering
                                ? 'bg-surface text-accent'
                                : 'text-faint hover:text-ink'
                            }`}
                          >
                            <List size={14} />
                          </button>
                        </div>

                        {/* Expand / Restore Tree Button */}
                        <IconButton
                          aria-label={
                            layoutMode === 'tree' ? 'Restore split view' : 'Expand file tree'
                          }
                          title={layoutMode === 'tree' ? 'Restore split view' : 'Expand file tree'}
                          onClick={() => setLayoutMode(layoutMode === 'tree' ? 'split' : 'tree')}
                          className={layoutMode === 'tree' ? 'text-accent' : ''}
                        >
                          {layoutMode === 'tree' ? (
                            <Minimize2 size={14} />
                          ) : (
                            <Maximize2 size={14} />
                          )}
                        </IconButton>
                      </div>

                      <div className="flex flex-wrap gap-1 border-b border-line/60 pb-2">
                        {CATEGORY_TABS.map((tab) => {
                          const Icon = tab.icon
                          const active = categoryFilter === tab.id
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setCategoryFilter(tab.id)}
                              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer ${
                                active
                                  ? 'bg-accent/15 text-accent border border-accent/30'
                                  : 'text-dim hover:bg-surface hover:text-ink'
                              }`}
                            >
                              <Icon size={12} />
                              {tab.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Breadcrumb Navigation Bar (when in Folder View without global search) */}
                    {!isGlobalFiltering && viewMode === 'folder' && (
                      <div className="flex items-center gap-1.5 overflow-x-auto rounded border border-line/60 bg-base/60 px-2.5 py-1.5 text-[11.5px]">
                        {currentDir ? (
                          <button
                            type="button"
                            onClick={navigateUp}
                            title="Go to parent folder"
                            className="flex items-center gap-1 rounded p-1 text-dim hover:bg-surface hover:text-ink cursor-pointer"
                          >
                            <ArrowLeft size={12} />
                          </button>
                        ) : (
                          <Folder size={13} className="text-amber-400 shrink-0" />
                        )}

                        {folderViewData.breadcrumbs.map((crumb, idx) => {
                          const isLast = idx === folderViewData.breadcrumbs.length - 1
                          return (
                            <React.Fragment key={crumb.path}>
                              {idx > 0 && (
                                <ChevronRight size={11} className="text-faint shrink-0" />
                              )}
                              <button
                                type="button"
                                onClick={() => setCurrentDir(crumb.path)}
                                disabled={isLast}
                                className={`truncate max-w-[140px] transition-colors cursor-pointer ${
                                  isLast
                                    ? 'font-semibold text-ink cursor-default'
                                    : 'text-dim hover:text-accent hover:underline'
                                }`}
                                title={crumb.label}
                              >
                                {crumb.label}
                              </button>
                            </React.Fragment>
                          )
                        })}
                      </div>
                    )}

                    {/* Entries List / Tree View */}
                    <div
                      className={`overflow-y-auto rounded border border-line/50 bg-base/50 divide-y divide-line/30 ${
                        layoutMode === 'tree'
                          ? 'max-h-[620px] min-h-[460px]'
                          : 'max-h-[490px] min-h-[380px]'
                      }`}
                    >
                      {isGlobalFiltering || viewMode === 'flat' ? (
                        /* Flat Filtered List */
                        flatFilteredEntries.length === 0 ? (
                          <div className="py-8 text-center text-[12px] text-faint">
                            No files matching &quot;{searchQuery}&quot;
                          </div>
                        ) : (
                          flatFilteredEntries.map((entry) => {
                            const cat = categorizeEntry(entry.path, entry.isDirectory)
                            const isSelected = selectedEntry?.path === entry.path

                            return (
                              <button
                                key={entry.path}
                                type="button"
                                onClick={() => void selectEntry(entry)}
                                disabled={entry.isDirectory}
                                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] transition-colors ${
                                  entry.isDirectory
                                    ? 'cursor-default bg-surface/30 text-dim'
                                    : 'cursor-pointer hover:bg-surface/80'
                                } ${isSelected ? 'bg-accent/10 text-accent font-medium border-l-2 border-accent' : 'text-ink'}`}
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="shrink-0">{renderTypeIcon(cat)}</span>
                                  <span
                                    className="truncate font-mono text-[11.5px]"
                                    title={entry.path}
                                  >
                                    {entry.path}
                                  </span>
                                </div>

                                <div className="flex shrink-0 items-center gap-3 text-[11px] text-faint">
                                  {!entry.isDirectory && (
                                    <>
                                      <span>{formatBytes(entry.uncompressedSize)}</span>
                                      {entry.compressedSize > 0 && (
                                        <span className="text-[10px] text-emerald-400">
                                          {formatCompressionRatio(
                                            entry.uncompressedSize,
                                            entry.compressedSize
                                          )}
                                        </span>
                                      )}
                                    </>
                                  )}
                                  {entry.isEncrypted && (
                                    <Lock size={10} className="text-amber-400" />
                                  )}
                                </div>
                              </button>
                            )
                          })
                        )
                      ) : (
                        /* Hierarchical Folder Structure */
                        <>
                          {/* Parent Folder item (..) */}
                          {currentDir && (
                            <button
                              type="button"
                              onClick={navigateUp}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-dim hover:bg-surface/80 hover:text-ink cursor-pointer border-b border-line/30"
                            >
                              <CornerLeftUp size={14} className="text-accent shrink-0" />
                              <span className="font-medium text-[11.5px]">.. (Parent folder)</span>
                            </button>
                          )}

                          {folderViewData.items.length === 0 ? (
                            <div className="py-8 text-center text-[12px] text-faint">
                              Empty folder
                            </div>
                          ) : (
                            folderViewData.items.map((item) => {
                              if (item.isDirectory) {
                                return (
                                  <button
                                    key={item.fullPath}
                                    type="button"
                                    onClick={() => setCurrentDir(item.fullPath)}
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] text-ink hover:bg-surface/80 cursor-pointer transition-colors"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <Folder size={14} className="text-amber-400 shrink-0" />
                                      <span className="truncate font-medium text-[12px]">
                                        {item.name}
                                      </span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2 text-[11px] text-faint">
                                      {item.itemCount !== undefined && (
                                        <span>
                                          {item.itemCount} item{item.itemCount === 1 ? '' : 's'}
                                        </span>
                                      )}
                                      <ChevronRight size={12} className="text-dim" />
                                    </div>
                                  </button>
                                )
                              }

                              const entry = item.entry
                              if (!entry) return null
                              const cat = categorizeEntry(entry.path, false)
                              const isSelected = selectedEntry?.path === entry.path

                              return (
                                <button
                                  key={entry.path}
                                  type="button"
                                  onClick={() => void selectEntry(entry)}
                                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-accent/10 text-accent font-medium border-l-2 border-accent'
                                      : 'text-ink hover:bg-surface/80'
                                  }`}
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="shrink-0">{renderTypeIcon(cat)}</span>
                                    <span
                                      className="truncate font-mono text-[11.5px]"
                                      title={entry.name}
                                    >
                                      {entry.name}
                                    </span>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-3 text-[11px] text-faint">
                                    <span>{formatBytes(entry.uncompressedSize)}</span>
                                    {entry.compressedSize > 0 && (
                                      <span className="text-[10px] text-emerald-400">
                                        {formatCompressionRatio(
                                          entry.uncompressedSize,
                                          entry.compressedSize
                                        )}
                                      </span>
                                    )}
                                    {entry.isEncrypted && (
                                      <Lock size={10} className="text-amber-400" />
                                    )}
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </>
                      )}
                    </div>

                    {/* Active Selection Banner when in Expanded Tree Mode */}
                    {layoutMode === 'tree' && selectedEntry && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-line bg-surface/70 px-3 py-2 text-[12px]">
                        <div className="flex items-center gap-2 truncate">
                          <Eye size={13} className="text-accent shrink-0" />
                          <span className="text-dim">Selected:</span>
                          <span className="font-medium text-ink truncate">
                            {selectedEntry.name}
                          </span>
                          <span className="text-faint">
                            ({formatBytes(selectedEntry.uncompressedSize)})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setLayoutMode('preview')}
                          >
                            <Eye size={12} /> Open in Full Preview
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setLayoutMode('split')}>
                            <Columns2 size={12} /> Split View
                          </Button>
                        </div>
                      </div>
                    )}
                  </Panel>
                </div>
              )}

              {/* Right Column: Live In-Memory Preview Workstation */}
              {(layoutMode === 'split' || layoutMode === 'preview') && (
                <div
                  className={`transition-all ${
                    layoutMode === 'preview' ? 'col-span-12' : 'lg:col-span-6'
                  }`}
                >
                  <Panel
                    className={`flex flex-col p-4 ${
                      layoutMode === 'preview' ? 'h-[700px]' : 'h-[600px]'
                    }`}
                  >
                    {selectedEntry ? (
                      <div className="flex flex-col h-full space-y-3">
                        {/* Preview Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {layoutMode === 'preview' && (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setLayoutMode('split')}
                                  className="shrink-0 text-faint hover:text-ink"
                                  title="Restore standard split view"
                                >
                                  <Columns2 size={13} />
                                  Split
                                </Button>
                                <Button
                                  variant={showPreviewSidebar ? 'secondary' : 'ghost'}
                                  size="sm"
                                  onClick={() => setShowPreviewSidebar(!showPreviewSidebar)}
                                  className="shrink-0"
                                  title={
                                    showPreviewSidebar ? 'Hide embedded tree' : 'Show embedded tree'
                                  }
                                >
                                  <PanelLeft size={13} />
                                  {showPreviewSidebar ? 'Hide Tree' : 'Browse Files'}
                                </Button>
                              </div>
                            )}

                            {/* Stepping controls (< Prev, Next >) */}
                            {activeFileList.length > 1 && (
                              <div className="flex items-center rounded border border-line bg-base/60 p-0.5 text-[11px]">
                                <button
                                  type="button"
                                  onClick={goToPrev}
                                  disabled={!hasPrev}
                                  title="Previous file (Left Arrow / PageUp)"
                                  className="rounded p-1 text-faint hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                >
                                  <ChevronLeft size={13} />
                                </button>
                                <span className="px-1.5 font-mono text-[10.5px] text-faint select-none">
                                  {currentIndex >= 0
                                    ? `${currentIndex + 1} / ${activeFileList.length}`
                                    : '—'}
                                </span>
                                <button
                                  type="button"
                                  onClick={goToNext}
                                  disabled={!hasNext}
                                  title="Next file (Right Arrow / PageDown)"
                                  className="rounded p-1 text-faint hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                >
                                  <ChevronRight size={13} />
                                </button>
                              </div>
                            )}

                            <div className="min-w-0">
                              <p
                                className="truncate font-medium text-[13px] text-ink"
                                title={selectedEntry.name}
                              >
                                {selectedEntry.name}
                              </p>
                              <p className="text-[11px] text-faint truncate">
                                {previewData?.mimeType || guessMimeType(selectedEntry.path)} ·{' '}
                                {formatBytes(selectedEntry.uncompressedSize)}
                                {selectedEntry.compressedSize > 0 && (
                                  <span>
                                    {' '}
                                    (
                                    {formatCompressionRatio(
                                      selectedEntry.uncompressedSize,
                                      selectedEntry.compressedSize
                                    )}
                                    )
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {previewData?.text !== undefined && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void handleCopyText()}
                              >
                                {copied ? (
                                  <Check size={13} className="text-emerald-400" />
                                ) : (
                                  <Copy size={13} />
                                )}
                                {copied ? 'Copied' : 'Copy'}
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => void handleExtractSingle()}
                              disabled={extracting}
                            >
                              <Download size={13} />
                              Extract
                            </Button>

                            {/* Expand / Restore Preview Button */}
                            <IconButton
                              aria-label={
                                layoutMode === 'preview' ? 'Restore split view' : 'Expand preview'
                              }
                              title={
                                layoutMode === 'preview' ? 'Restore split view' : 'Expand preview'
                              }
                              onClick={() =>
                                setLayoutMode(layoutMode === 'preview' ? 'split' : 'preview')
                              }
                              className={layoutMode === 'preview' ? 'text-accent' : ''}
                            >
                              {layoutMode === 'preview' ? (
                                <Minimize2 size={14} />
                              ) : (
                                <Maximize2 size={14} />
                              )}
                            </IconButton>
                          </div>
                        </div>

                        {/* Preview Content Area with Optional Embedded File Tree in Full Preview Mode */}
                        <div className="relative flex-1 overflow-hidden flex items-stretch gap-3">
                          {/* Embedded Mini Tree Sidebar in Full Preview Mode */}
                          {layoutMode === 'preview' && showPreviewSidebar && (
                            <div className="flex flex-col w-64 shrink-0 rounded border border-line/60 bg-base/60 p-2.5 space-y-2">
                              {/* Mini Breadcrumbs */}
                              <div className="flex items-center gap-1 text-[11px] font-medium text-dim border-b border-line/40 pb-1.5 overflow-x-auto">
                                {currentDir ? (
                                  <button
                                    type="button"
                                    onClick={navigateUp}
                                    title="Go up"
                                    className="text-faint hover:text-ink cursor-pointer p-0.5"
                                  >
                                    <ArrowLeft size={11} />
                                  </button>
                                ) : (
                                  <Folder size={11} className="text-amber-400 shrink-0" />
                                )}
                                <span className="truncate">
                                  {currentDir ? currentDir.split('/').pop() : 'Root'}
                                </span>
                                <span className="ml-auto text-[10px] text-faint">
                                  {folderViewData.items.length} items
                                </span>
                              </div>

                              {/* Mini Scrollable Entries */}
                              <div className="flex-1 overflow-y-auto divide-y divide-line/20 rounded border border-line/40 bg-surface/30">
                                {currentDir && (
                                  <button
                                    type="button"
                                    onClick={navigateUp}
                                    className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] text-dim hover:bg-surface/80 cursor-pointer"
                                  >
                                    <CornerLeftUp size={11} className="text-accent shrink-0" />
                                    <span>.. Up</span>
                                  </button>
                                )}

                                {folderViewData.items.map((item) => {
                                  if (item.isDirectory) {
                                    return (
                                      <button
                                        key={item.fullPath}
                                        type="button"
                                        onClick={() => setCurrentDir(item.fullPath)}
                                        className="flex w-full items-center justify-between gap-1.5 px-2 py-1.5 text-left text-[11px] text-ink hover:bg-surface/80 cursor-pointer transition-colors"
                                      >
                                        <div className="flex min-w-0 items-center gap-1.5">
                                          <Folder size={12} className="text-amber-400 shrink-0" />
                                          <span className="truncate">{item.name}</span>
                                        </div>
                                        <ChevronRight size={10} className="text-dim shrink-0" />
                                      </button>
                                    )
                                  }

                                  const entry = item.entry
                                  if (!entry) return null
                                  const cat = categorizeEntry(entry.path, false)
                                  const isSelected = selectedEntry?.path === entry.path

                                  return (
                                    <button
                                      key={entry.path}
                                      type="button"
                                      onClick={() => void selectEntry(entry)}
                                      className={`flex w-full items-center justify-between gap-1.5 px-2 py-1.5 text-left text-[11px] cursor-pointer transition-colors ${
                                        isSelected
                                          ? 'bg-accent/15 text-accent font-medium'
                                          : 'text-ink hover:bg-surface/80'
                                      }`}
                                    >
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        <span className="shrink-0">{renderTypeIcon(cat)}</span>
                                        <span
                                          className="truncate font-mono text-[10.5px]"
                                          title={entry.name}
                                        >
                                          {entry.name}
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-faint shrink-0">
                                        {formatBytes(entry.uncompressedSize)}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Live Preview Canvas */}
                          <div className="relative flex-1 overflow-hidden rounded border border-line/60 bg-base/60 flex items-center justify-center p-3">
                            {previewLoading ? (
                              <div className="flex flex-col items-center gap-2 text-center">
                                <Spinner />
                                <p className="text-[12px] text-dim">Streaming from archive…</p>
                              </div>
                            ) : previewData?.blobUrl ? (
                              categorizeEntry(selectedEntry.path, false) === 'image' ? (
                                <img
                                  src={previewData.blobUrl}
                                  alt={selectedEntry.name}
                                  className="max-h-full max-w-full object-contain rounded"
                                />
                              ) : categorizeEntry(selectedEntry.path, false) === 'video' ? (
                                <div className="flex flex-col items-center justify-center h-full w-full p-2">
                                  {videoError ? (
                                    <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm">
                                      <Film size={36} className="text-amber-400 mb-2" />
                                      <p className="text-[13px] font-medium text-ink">
                                        Video Codec Not Supported in Browser
                                      </p>
                                      <p className="mt-1 text-[11.5px] text-dim">
                                        This video format ({previewData.mimeType}) requires
                                        extraction to play in your media player.
                                      </p>
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        className="mt-3"
                                        onClick={() => void handleExtractSingle()}
                                        disabled={extracting}
                                      >
                                        <Download size={13} /> Extract & Play
                                      </Button>
                                    </div>
                                  ) : (
                                    <video
                                      controls
                                      autoPlay={false}
                                      playsInline
                                      preload="metadata"
                                      src={previewData.blobUrl}
                                      onError={() => setVideoError(true)}
                                      className="max-h-full max-w-full rounded shadow-md bg-black/40"
                                    />
                                  )}
                                </div>
                              ) : categorizeEntry(selectedEntry.path, false) === 'audio' ? (
                                <div className="w-full max-w-md p-4 text-center">
                                  <Music size={36} className="mx-auto text-violet-400 mb-3" />
                                  <audio controls src={previewData.blobUrl} className="w-full" />
                                </div>
                              ) : (
                                <iframe
                                  src={previewData.blobUrl}
                                  title={selectedEntry.name}
                                  className="h-full w-full rounded border-0"
                                />
                              )
                            ) : previewData?.text !== undefined ? (
                              <textarea
                                readOnly
                                value={previewData.text}
                                className="h-full w-full resize-none font-mono text-[12px] leading-relaxed text-ink bg-transparent border-0 outline-none p-1"
                              />
                            ) : (
                              <div className="text-center text-faint">
                                <FileText size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-[12.5px] font-medium text-dim">Binary File</p>
                                <p className="mt-1 text-[11px]">
                                  Click <strong>Extract</strong> to export this file to disk.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 text-faint">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface mb-3">
                          <Eye size={20} className="text-dim" />
                        </div>
                        <p className="text-[13.5px] font-medium text-ink">In-Memory Live Preview</p>
                        <p className="mt-1 max-w-xs text-[11.5px] text-faint">
                          Click any image, video, audio, code, or document on the left to preview it
                          directly from RAM.
                        </p>
                      </div>
                    )}
                  </Panel>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
