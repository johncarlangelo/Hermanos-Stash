import { useEffect, useState } from 'react'
import { Check, CheckCircle2, Copy, Download, FileText, XCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { DropZone } from '../../components/ui/DropZone'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  calculateBufferHash,
  generateChecksumFileContent,
  parseChecksumFile,
  verifyChecksum,
  type ChecksumFileItem,
  type HashAlgorithm
} from './logic'

export default function ChecksumVerifierTool() {
  const [items, setItems] = useState<ChecksumFileItem[]>([])
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-256')
  const [manualExpectedHash, setManualExpectedHash] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const handleFiles = async (fileList: File[]) => {
    const newItems: ChecksumFileItem[] = []

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]

      // If user dropped a .sha256 or .sha256sum or .md5 signature file
      if (
        file.name.endsWith('.sha256') ||
        file.name.endsWith('.sha256sum') ||
        file.name.endsWith('.sha512') ||
        file.name.endsWith('.md5')
      ) {
        const text = await file.text()
        const checksumMap = parseChecksumFile(text)

        // Apply expected hashes to existing items
        setItems((prev) =>
          prev.map((item) => {
            const exp = checksumMap[item.name]
            if (exp) {
              return {
                ...item,
                expectedHash: exp,
                status: verifyChecksum(item.calculatedHash, exp)
              }
            }
            return item
          })
        )
        toastSuccess(`Loaded signatures from ${file.name}`)
        continue
      }

      const buffer = await file.arrayBuffer()
      const hash = await calculateBufferHash(buffer, algorithm)
      const status = verifyChecksum(hash, manualExpectedHash)

      newItems.push({
        id: `f-${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        calculatedHash: hash,
        expectedHash: manualExpectedHash || undefined,
        status
      })
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems])
    }
  }

  // Update validation when manual expected hash changes
  useEffect(() => {
    if (manualExpectedHash) {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          expectedHash: manualExpectedHash,
          status: verifyChecksum(item.calculatedHash, manualExpectedHash)
        }))
      )
    }
  }, [manualExpectedHash])

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
    toastSuccess('Hash copied to clipboard')
    recordHistoryQuietly('checksum-verifier', 'File Checksum Signature Verifier', 'files')
  }

  const handleExportChecksumFile = () => {
    if (items.length === 0) return
    const content = generateChecksumFileContent(items)
    const ext = algorithm.toLowerCase().replace('-', '')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checksums.${ext}sum`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess(`Downloaded checksums.${ext}sum`)
    recordHistoryQuietly('checksum-verifier', 'File Checksum Signature Verifier', 'files')
  }

  return (
    <div className="flex flex-col gap-4 text-[13px] text-ink">
      {/* Main Split Layout */}
      {items.length === 0 ? (
        <div className="flex flex-col gap-3">
          <DropZone
            onRawFiles={handleFiles}
            multiple
            label="Drop files (or .sha256sum signature file) here to calculate and verify checksums"
            hint="Supports single files, batch files, and .sha256/.md5 signature files · click to browse"
            dialogTitle="Choose files to verify checksums"
          />
          <div className="flex items-center justify-center gap-2 text-[11.5px]">
            <span className="text-faint">Default algorithm:</span>
            {(['SHA-256', 'SHA-512', 'SHA-1'] as HashAlgorithm[]).map((algo) => (
              <button
                key={algo}
                type="button"
                onClick={() => setAlgorithm(algo)}
                className={`px-2.5 py-1 rounded border font-mono cursor-pointer transition-colors ${
                  algorithm === algo
                    ? 'border-accent bg-accent/15 text-accent font-bold'
                    : 'border-line bg-surface/60 text-dim hover:text-ink'
                }`}
              >
                {algo}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 min-h-0">
          {/* Top Verification Bar & Manual Check */}
          <Panel className="p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[280px] space-y-1">
              <span className="text-[11px] text-faint block uppercase font-semibold">
                Compare with Expected Hash (Optional)
              </span>
              <input
                type="text"
                value={manualExpectedHash}
                onChange={(e) => setManualExpectedHash(e.target.value.trim())}
                placeholder="Paste expected SHA-256 / SHA-512 hash here to verify..."
                className="w-full rounded border border-line bg-base px-2.5 py-1 text-[11.5px] font-mono text-ink outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center gap-2 pt-3 sm:pt-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportChecksumFile}
                className="gap-1 cursor-pointer text-[11.5px]"
              >
                <Download size={12} />
                Export .sha256sum File
              </Button>

              <button
                type="button"
                onClick={() => {
                  setItems([])
                  setManualExpectedHash('')
                }}
                className="text-[11px] text-faint hover:text-ink cursor-pointer px-2"
              >
                Clear All
              </button>
            </div>
          </Panel>

          {/* Files List Table */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {items.map((item) => (
              <Panel key={item.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-line/60 pb-1.5 text-[12px]">
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={14} className="text-accent shrink-0" />
                    <span className="font-semibold text-ink truncate">{item.name}</span>
                    <span className="text-faint font-mono text-[10.5px]">
                      ({(item.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>

                  {/* Verification Status Badge */}
                  <div>
                    {item.status === 'match' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-[11px] flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        CHECKSUM MATCH
                      </span>
                    ) : item.status === 'mismatch' ? (
                      <span className="px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold text-[11px] flex items-center gap-1">
                        <XCircle size={12} />
                        HASH MISMATCH
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-base text-faint border border-line font-mono text-[10.5px]">
                        CALCULATED
                      </span>
                    )}
                  </div>
                </div>

                {/* Computed Hash Display */}
                <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-base/60 border border-line/40 font-mono text-[11px]">
                  <span className="truncate text-ink select-all">{item.calculatedHash}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(item.calculatedHash, item.id)}
                    className="text-accent hover:underline text-[10.5px] cursor-pointer shrink-0"
                  >
                    {copied === item.id ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
