import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Check,
  Copy,
  Download,
  Eye,
  FileCode,
  FileText,
  Film,
  Folder,
  Image as ImageIcon,
  KeyRound,
  Lock,
  Music,
  Unlock,
  X
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { ErrorNote, Panel, Spinner } from '../../components/ui/Feedback'
import { IconButton } from '../../components/ui/IconButton'
import { ClearableTagInput } from '../../components/ui/Inputs'
import { stashError, type StashError } from '../../../shared/errors'
import type { ArchiveEntryInfo, ArchiveInspectResult } from '../../../shared/ipc'
import { formatBytes } from '../../../shared/utils/files'
import { toastError, toastSuccess } from '../../stores/toasts'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  categorizeEntry,
  filterArchiveEntries,
  formatCompressionRatio,
  guessMimeType,
  type ArchiveCategoryFilter,
  type EntryCategory
} from './logic'

interface PreviewState {
  bytes: Uint8Array
  mimeType: string
  blobUrl?: string
  text?: string
}

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
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ArchiveCategoryFilter>('all')
  const [selectedEntry, setSelectedEntry] = useState<ArchiveEntryInfo | null>(null)

  // Live In-Memory Preview State
  const [previewData, setPreviewData] = useState<PreviewState | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [extracting, setExtracting] = useState(false)

  // Cleanup object URLs when preview changes or tool unmounts
  useEffect(() => {
    return () => {
      if (previewData?.blobUrl) {
        URL.revokeObjectURL(previewData.blobUrl)
      }
    }
  }, [previewData])

  const clearArchive = useCallback(() => {
    if (previewData?.blobUrl) {
      URL.revokeObjectURL(previewData.blobUrl)
    }
    setArchivePath(null)
    setInspectResult(null)
    setSelectedEntry(null)
    setPreviewData(null)
    setPassword('')
    setError(null)
    setSearchQuery('')
    setCategoryFilter('all')
    setUnlocked(true)
  }, [previewData])

  const loadArchive = useCallback(async (targetPath: string, pass?: string) => {
    setLoading(true)
    setError(null)
    setSelectedEntry(null)
    setPreviewData(null)

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
      // 1. Inspect archive with password to load all entries (for header-encrypted RAR/ZIP)
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

      // 2. If entries are present and encrypted, verify password against the first encrypted file
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
      setError(null)

      if (previewData?.blobUrl) {
        URL.revokeObjectURL(previewData.blobUrl)
      }
      setPreviewData(null)

      try {
        const readRes = await window.stash.archives.readEntry({
          archivePath,
          entryPath: entry.path,
          ...(password ? { password } : {})
        })

        const category = categorizeEntry(entry.path, entry.isDirectory)
        const mimeType = readRes.mimeType || guessMimeType(entry.path)

        let blobUrl: string | undefined
        let textContent: string | undefined

        if (['image', 'video', 'audio', 'pdf'].includes(category)) {
          const blob = new Blob([readRes.bytes as unknown as BlobPart], { type: mimeType })
          blobUrl = URL.createObjectURL(blob)
        } else if (category === 'text') {
          textContent = new TextDecoder('utf-8').decode(readRes.bytes)
        }

        setPreviewData({
          bytes: readRes.bytes,
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
      const ext = selectedEntry.name.split('.').pop() ?? ''
      const defaultName = selectedEntry.name
      const dialogRes = await window.stash.dialogs.saveFile({
        title: `Extract ${selectedEntry.name}`,
        defaultName,
        filters: ext ? [{ name: 'Matching File', extensions: [ext] }] : undefined
      })

      if (dialogRes.cancelled || !dialogRes.path) return

      await window.stash.archives.extractEntry({
        archivePath,
        entryPath: selectedEntry.path,
        targetPath: dialogRes.path,
        ...(password ? { password } : {})
      })

      toastSuccess(`Extracted ${selectedEntry.name}`)
    } catch (err) {
      toastError(err)
    } finally {
      setExtracting(false)
    }
  }

  const filteredEntries = useMemo(() => {
    if (!inspectResult) return []
    return filterArchiveEntries(inspectResult.entries, {
      query: searchQuery,
      category: categoryFilter,
      sortBy: 'path',
      sortOrder: 'asc'
    })
  }, [inspectResult, searchQuery, categoryFilter])

  const renderTypeIcon = (cat: EntryCategory) => {
    switch (cat) {
      case 'folder':
        return <Folder size={14} className="text-accent" />
      case 'image':
        return <ImageIcon size={14} className="text-cyan-400" />
      case 'video':
        return <Film size={14} className="text-rose-400" />
      case 'audio':
        return <Music size={14} className="text-violet-400" />
      case 'pdf':
        return <FileText size={14} className="text-amber-400" />
      case 'text':
        return <FileCode size={14} className="text-emerald-400" />
      default:
        return <FileText size={14} className="text-faint" />
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
          <p className="mt-3 text-[13.5px] font-medium text-ink">Reading archive index…</p>
          <p className="mt-1 text-[11.5px] text-faint">
            Parsing archive central directory in-memory.
          </p>
        </Panel>
      ) : (
        <div className="space-y-4">
          {/* Top Bar with Archive info and Close Button */}
          {archivePath && inspectResult && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface/80 px-3.5 py-2 text-[12px] text-dim">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{fileNameOf(archivePath)}</span>
                {unlocked ? (
                  <>
                    <span className="text-faint">·</span>
                    <span>{inspectResult.fileCount} files</span>
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
              <IconButton
                aria-label="Close archive"
                onClick={clearArchive}
                disabled={loading || previewLoading}
              >
                <X size={14} />
              </IconButton>
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
              {/* Left Column: Explorer */}
              <div className="space-y-3 lg:col-span-6">
                <Panel className="space-y-3 p-3.5">
                  {/* Search & Category Tabs */}
                  <div className="space-y-2.5">
                    <ClearableTagInput
                      value={searchQuery}
                      onChange={setSearchQuery}
                      placeholder="Filter entries by name or path…"
                    />

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

                  {/* Entries Table */}
                  <div className="max-h-[460px] overflow-y-auto rounded border border-line/50 bg-base/50 divide-y divide-line/30">
                    {filteredEntries.length === 0 ? (
                      <div className="py-8 text-center text-[12px] text-faint">
                        No files matching &quot;{searchQuery}&quot;
                      </div>
                    ) : (
                      filteredEntries.map((entry) => {
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
                              <span className="truncate font-mono text-[11.5px]" title={entry.path}>
                                {entry.path}
                              </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-2 text-[11px] text-faint">
                              {!entry.isDirectory && (
                                <span>{formatBytes(entry.uncompressedSize)}</span>
                              )}
                              {entry.isEncrypted && <Lock size={10} className="text-amber-400" />}
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </Panel>
              </div>

              {/* Right Column: Live In-Memory Preview */}
              <div className="lg:col-span-6">
                <Panel className="flex flex-col h-[560px] p-4">
                  {selectedEntry ? (
                    <div className="flex flex-col h-full space-y-3">
                      {/* Preview Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                        <div className="min-w-0">
                          <p
                            className="truncate font-medium text-[13px] text-ink"
                            title={selectedEntry.name}
                          >
                            {selectedEntry.name}
                          </p>
                          <p className="text-[11px] text-faint">
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
                        </div>
                      </div>

                      {/* Preview Content Area */}
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
                            <video
                              controls
                              src={previewData.blobUrl}
                              className="max-h-full max-w-full rounded"
                            />
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
