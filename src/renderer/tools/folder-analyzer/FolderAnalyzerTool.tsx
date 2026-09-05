import { useMemo, useState } from 'react'
import {
  Check,
  Copy,
  FileCode,
  FileText,
  Film,
  Folder,
  Image as ImageIcon,
  Music,
  Package,
  Sparkles
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { analyzeFileList, formatBytes, type FileCategory, type FolderAnalysisResult } from './logic'

export default function FolderAnalyzerTool() {
  const [rawFiles, setRawFiles] = useState<Array<{ name: string; size: number; path?: string }>>([])
  const [copied, setCopied] = useState(false)

  const handleFiles = (fileList: File[]) => {
    const items = fileList.map((f) => ({
      name: f.name,
      size: f.size,
      path: (f as unknown as { path?: string }).path || f.name
    }))
    setRawFiles((prev) => [...prev, ...items])
  }

  const loadDemo = () => {
    const demoItems = [
      { name: '4k_drone_shot.mp4', size: 450 * 1024 * 1024 },
      { name: 'backup_archive.zip', size: 180 * 1024 * 1024 },
      { name: 'product_catalog.pdf', size: 45 * 1024 * 1024 },
      { name: 'hero_banner.png', size: 14 * 1024 * 1024 },
      { name: 'avatar_large.webp', size: 6 * 1024 * 1024 },
      { name: 'podcast_episode_12.mp3', size: 78 * 1024 * 1024 },
      { name: 'app_bundle.js', size: 8 * 1024 * 1024 },
      { name: 'schema_dump.sql', size: 12 * 1024 * 1024 },
      { name: 'dataset.csv', size: 22 * 1024 * 1024 },
      { name: 'readme.md', size: 24 * 1024 }
    ]
    setRawFiles(demoItems)
  }

  const analysis: FolderAnalysisResult = useMemo(() => {
    return analyzeFileList(rawFiles)
  }, [rawFiles])

  const handleCopyReport = async () => {
    if (analysis.totalFiles === 0) return
    let report = `--- Disk Space & Category Breakdown ---\nTotal Space: ${formatBytes(analysis.totalBytes)} (${analysis.totalFiles} files)\n\n`
    report += `Category Distribution:\n`
    analysis.categoryBreakdown.forEach((c) => {
      report += `  - ${c.category}: ${formatBytes(c.sizeBytes)} (${c.fileCount} files, ${c.percentage}%)\n`
    })
    report += `\nTop Largest Files:\n`
    analysis.largestFiles.forEach((f, i) => {
      report += `  ${i + 1}. ${f.name} — ${formatBytes(f.size)} (${f.category})\n`
    })

    await navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toastSuccess('Storage breakdown report copied')
    recordHistoryQuietly('folder-analyzer', 'Folder Space Analyzer', 'files')
  }

  const getCategoryIcon = (cat: FileCategory) => {
    switch (cat) {
      case 'Images':
        return <ImageIcon size={13} className="text-amber-400" />
      case 'Videos':
        return <Film size={13} className="text-pink-400" />
      case 'Documents':
        return <FileText size={13} className="text-blue-400" />
      case 'Audio':
        return <Music size={13} className="text-purple-400" />
      case 'Code & Data':
        return <FileCode size={13} className="text-emerald-400" />
      case 'Archives':
        return <Package size={13} className="text-cyan-400" />
      default:
        return <Folder size={13} className="text-zinc-400" />
    }
  }

  return (
    <div className="flex flex-col gap-4 text-[13px] text-ink">
      {/* Main Split Layout */}
      {rawFiles.length === 0 ? (
        <div className="flex flex-col gap-3">
          <DropZone
            onRawFiles={handleFiles}
            multiple
            label="Drop files or folder contents here to inspect storage breakdown"
            hint="Analyzes file sizes and categorizes by media type completely offline · click to browse"
            dialogTitle="Choose files to analyze"
          />
          <div className="flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadDemo}
              className="gap-1.5 cursor-pointer text-[11.5px]"
            >
              <Sparkles size={13} className="text-accent" />
              Load Sample Workspace (10 Files)
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 min-h-0">
          {/* Summary Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-line bg-surface/70">
            <div className="flex items-center gap-6 text-[12px]">
              <div>
                <span className="text-faint block text-[10.5px] uppercase">Total Size</span>
                <span className="font-mono font-bold text-accent text-[15px]">
                  {formatBytes(analysis.totalBytes)}
                </span>
              </div>
              <div className="border-l border-line pl-6">
                <span className="text-faint block text-[10.5px] uppercase">Files Count</span>
                <span className="font-mono font-bold text-ink text-[15px]">
                  {analysis.totalFiles.toLocaleString()} files
                </span>
              </div>
              <div className="border-l border-line pl-6">
                <span className="text-faint block text-[10.5px] uppercase">Dominant Category</span>
                <span className="font-semibold text-ink text-[13px]">
                  {analysis.categoryBreakdown[0]?.category || 'N/A'} (
                  {analysis.categoryBreakdown[0]?.percentage || 0}%)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyReport}
                className="gap-1.5 cursor-pointer text-[11.5px]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy Audit Log'}
              </Button>

              <button
                type="button"
                onClick={() => setRawFiles([])}
                className="text-[11px] text-faint hover:text-ink cursor-pointer px-2"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Multi-Color Segmented Storage Bar */}
          <div className="p-3 rounded-lg border border-line bg-base/60 space-y-2">
            <div className="flex justify-between text-[11px] text-faint font-semibold uppercase">
              <span>Storage Distribution</span>
              <span>100% Total Capacity</span>
            </div>

            <div className="w-full h-3 rounded-full overflow-hidden flex bg-surface border border-line/60">
              {analysis.categoryBreakdown.map((cat) => (
                <div
                  key={cat.category}
                  className="h-full transition-all duration-300 relative group"
                  style={{
                    width: `${cat.percentage}%`,
                    backgroundColor: cat.color
                  }}
                  title={`${cat.category}: ${cat.percentage}% (${formatBytes(cat.sizeBytes)})`}
                />
              ))}
            </div>

            {/* Category Legend Chips */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
              {analysis.categoryBreakdown.map((cat) => (
                <div key={cat.category} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-medium text-ink">{cat.category}</span>
                  <span className="text-faint font-mono text-[10.5px]">
                    {formatBytes(cat.sizeBytes)} ({cat.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Split: Category Summary & Largest Files */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
            {/* Category Breakdown Table */}
            <Panel className="lg:col-span-5 p-3 flex flex-col gap-2 overflow-hidden">
              <span className="text-[11px] uppercase font-semibold text-faint border-b border-line/60 pb-1">
                Category Summary
              </span>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {analysis.categoryBreakdown.map((cat) => (
                  <div
                    key={cat.category}
                    className="p-2 rounded border border-line bg-base/50 flex items-center justify-between text-[11.5px]"
                  >
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(cat.category)}
                      <span className="font-medium text-ink">{cat.category}</span>
                      <span className="text-faint text-[10.5px]">({cat.fileCount} files)</span>
                    </div>

                    <div className="text-right font-mono">
                      <span className="font-bold text-ink">{formatBytes(cat.sizeBytes)}</span>
                      <span className="text-faint text-[10px] block">{cat.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Top 10 Largest Files */}
            <Panel className="lg:col-span-7 p-3 flex flex-col gap-2 overflow-hidden">
              <span className="text-[11px] uppercase font-semibold text-faint border-b border-line/60 pb-1">
                Top Largest Files ({analysis.largestFiles.length})
              </span>

              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {analysis.largestFiles.map((file, idx) => (
                  <div
                    key={file.id}
                    className="p-1.5 px-2.5 rounded bg-base/50 border border-line/40 flex items-center justify-between text-[11.5px]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-faint text-[10px] w-4">#{idx + 1}</span>
                      {getCategoryIcon(file.category)}
                      <span className="font-medium text-ink truncate">{file.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-faint uppercase font-mono bg-base px-1.5 py-0.5 rounded border border-line">
                        {file.extension || file.category}
                      </span>
                      <span className="font-mono font-bold text-accent text-[11.5px]">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
