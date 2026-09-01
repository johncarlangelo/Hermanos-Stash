import { useEffect, useState } from 'react'
import { Check, CheckCircle2, Copy, HardDrive, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { findDuplicateGroups, formatBytes, type CandidateFile, type DuplicateGroup } from './logic'

export default function DuplicateFinderTool() {
  const [files, setFiles] = useState<CandidateFile[]>([])
  const [results, setResults] = useState<{
    groups: DuplicateGroup[]
    totalDuplicateCount: number
    totalWastedBytes: number
  }>({ groups: [], totalDuplicateCount: 0, totalWastedBytes: 0 })
  const [scanning, setScanning] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleFiles = (fileList: File[]) => {
    setScanning(true)
    const readPromises: Promise<CandidateFile>[] = fileList.map((file, idx) => {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          resolve({
            id: `f-${Date.now()}-${idx}`,
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            buffer: e.target?.result as ArrayBuffer
          })
        }
        reader.readAsArrayBuffer(file)
      })
    })

    Promise.all(readPromises).then((loaded) => {
      setFiles((prev) => [...prev, ...loaded])
      setScanning(false)
    })
  }

  const loadDemo = () => {
    const encoder = new TextEncoder()
    const b1 = encoder.encode('Hermanos Stash Document Content').buffer
    const b2 = encoder.encode('Different Unique File Content').buffer

    const demoFiles: CandidateFile[] = [
      {
        id: '1',
        name: 'report_2026_final.pdf',
        size: b1.byteLength,
        lastModified: 1725148800000,
        buffer: b1
      },
      {
        id: '2',
        name: 'report_2026_backup.pdf',
        size: b1.byteLength,
        lastModified: 1725149800000,
        buffer: b1
      },
      {
        id: '3',
        name: 'report_copy (1).pdf',
        size: b1.byteLength,
        lastModified: 1725150800000,
        buffer: b1
      },
      { id: '4', name: 'notes.txt', size: b2.byteLength, lastModified: 1725140000000, buffer: b2 }
    ]
    setFiles(demoFiles)
  }

  useEffect(() => {
    if (files.length > 1) {
      setScanning(true)
      findDuplicateGroups(files).then((res) => {
        setResults(res)
        setScanning(false)
      })
    } else {
      setResults({ groups: [], totalDuplicateCount: 0, totalWastedBytes: 0 })
    }
  }, [files])

  const handleCopyReport = async () => {
    if (results.groups.length === 0) return
    let report = `--- Duplicate Files Audit Report ---\nTotal Duplicates: ${results.totalDuplicateCount}\nReclaimable Space: ${formatBytes(results.totalWastedBytes)}\n\n`

    results.groups.forEach((g, idx) => {
      report += `[Group #${idx + 1}] SHA-256: ${g.hash.slice(0, 16)}... (${formatBytes(g.size)} each)\n`
      g.files.forEach((f) => {
        report += `  - ${f.name} (Modified: ${new Date(f.lastModified).toLocaleString()})\n`
      })
      report += '\n'
    })

    await navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toastSuccess('Duplicate audit report copied to clipboard')
    recordHistoryQuietly('duplicate-finder', 'Duplicate File & Hash Matcher', 'files')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <HardDrive size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">Duplicate File & Hash Matcher</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            Size Heuristics · SHA-256 Match
          </span>
        </div>

        {files.length === 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={loadDemo}
            className="gap-1.5 cursor-pointer text-[11.5px]"
          >
            <Sparkles size={13} className="text-accent" />
            Load Sample Dataset (3 Duplicates)
          </Button>
        )}
      </div>

      {/* Main Split Layout */}
      {files.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <DropZone
            onRawFiles={handleFiles}
            multiple
            label="Drop files or folder items here to scan for duplicates"
            hint="Analyzes files completely offline using cryptographic hashes"
            className="max-w-md w-full"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* Summary Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-line bg-surface/70">
            <div className="flex items-center gap-6 text-[12px]">
              <div>
                <span className="text-faint block text-[10.5px] uppercase">Scanned Files</span>
                <span className="font-mono font-bold text-ink text-[14px]">
                  {files.length} items
                </span>
              </div>
              <div className="border-l border-line pl-6">
                <span className="text-faint block text-[10.5px] uppercase">Duplicate Sets</span>
                <span className="font-mono font-bold text-accent text-[14px]">
                  {results.groups.length} sets ({results.totalDuplicateCount} redundant files)
                </span>
              </div>
              <div className="border-l border-line pl-6">
                <span className="text-faint block text-[10.5px] uppercase">
                  Reclaimable Disk Space
                </span>
                <span className="font-mono font-bold text-emerald-400 text-[14px]">
                  {formatBytes(results.totalWastedBytes)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyReport}
                disabled={results.groups.length === 0}
                className="gap-1.5 cursor-pointer text-[11.5px]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy Audit Log'}
              </Button>

              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-[11px] text-faint hover:text-ink cursor-pointer px-2"
              >
                Reset Scanner
              </button>
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {scanning ? (
              <div className="h-48 flex items-center justify-center text-faint italic">
                Scanning and computing SHA-256 hashes...
              </div>
            ) : results.groups.length === 0 ? (
              <Panel className="p-8 flex flex-col items-center justify-center text-center space-y-2">
                <CheckCircle2 size={32} className="text-emerald-400" />
                <h3 className="font-semibold text-ink text-[14px]">No Duplicate Files Found</h3>
                <p className="text-faint text-[12px] max-w-sm">
                  All {files.length} scanned files have distinct content hashes.
                </p>
              </Panel>
            ) : (
              results.groups.map((group, gIdx) => (
                <Panel key={gIdx} className="p-3 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-line/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-accent text-[12px]">
                        Set #{gIdx + 1}
                      </span>
                      <span className="text-[11px] text-faint font-mono bg-base px-2 py-0.5 rounded border border-line truncate max-w-xs">
                        SHA-256: {group.hash}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11.5px]">
                      <span className="text-faint font-mono">{formatBytes(group.size)} each</span>
                      <span className="text-emerald-400 font-bold font-mono">
                        Wasted: {formatBytes(group.wastedBytes)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {group.files.map((file, fIdx) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2 rounded bg-base/50 text-[11.5px] border border-line/40"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-[10px] font-mono text-faint">
                            {fIdx === 0 ? '[Original]' : '[Copy]'}
                          </span>
                          <span className="font-medium text-ink truncate">{file.name}</span>
                        </div>

                        <span className="text-faint text-[10.5px] font-mono shrink-0">
                          {new Date(file.lastModified).toLocaleDateString()}{' '}
                          {new Date(file.lastModified).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
