import { CheckCircle2, Clock, Copy, FileCheck, FolderOpen, X } from 'lucide-react'
import type { WorkflowExecutionResult } from './types'
import { toastSuccess } from '../../stores/toasts'

interface WorkflowOutputDrawerProps {
  open: boolean
  onClose: () => void
  result: WorkflowExecutionResult | null
}

export function WorkflowOutputDrawer({ open, onClose, result }: WorkflowOutputDrawerProps) {
  if (!open || !result) return null

  const handleCopyPath = (path: string) => {
    void navigator.clipboard.writeText(path)
    toastSuccess('File path copied to clipboard')
  }

  const handleRevealPath = async (path: string) => {
    if (window.stash?.shell?.revealPath) {
      try {
        await window.stash.shell.revealPath(path)
      } catch (err) {
        console.warn('Failed to reveal path', err)
      }
    }
  }

  const handleCopyText = (text: string) => {
    void navigator.clipboard.writeText(text)
    toastSuccess('Output text copied to clipboard')
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 z-30 flex max-h-72 flex-col rounded-xl border border-line/80 bg-shell/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 bg-surface/60 rounded-t-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 size={14} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-ink">
              Pipeline Execution Finished{' '}
              {result.success ? (
                <span className="text-emerald-400 font-mono text-[11px]">(Completed)</span>
              ) : (
                <span className="text-danger font-mono text-[11px]">(Partial/Failed)</span>
              )}
            </h4>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-mono text-faint ml-3">
            <Clock size={11} /> {result.durationMs}ms
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-base px-2.5 py-0.5 font-mono text-[10px] text-accent border border-line">
            {result.finalOutputFiles.length} file(s) generated
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-faint hover:text-ink hover:bg-surface"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body: List files and text */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {result.finalOutputFiles.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-faint uppercase tracking-wider">
              Output Files
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {result.finalOutputFiles.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface/50 p-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCheck size={14} className="text-emerald-400 shrink-0" />
                    <span className="truncate font-mono text-[11px] text-ink" title={file}>
                      {file}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleRevealPath(file)}
                      className="cursor-pointer rounded p-1 text-faint hover:text-ink hover:bg-base"
                      title="Reveal in Explorer"
                    >
                      <FolderOpen size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyPath(file)}
                      className="cursor-pointer rounded p-1 text-faint hover:text-ink hover:bg-base"
                      title="Copy path"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.finalOutputText && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-faint uppercase tracking-wider">
                Output Text
              </p>
              <button
                type="button"
                onClick={() => handleCopyText(result.finalOutputText!)}
                className="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[10.5px] text-faint hover:text-ink hover:bg-surface"
              >
                <Copy size={11} /> Copy
              </button>
            </div>
            <pre className="max-h-28 overflow-y-auto rounded-lg border border-line bg-base/80 p-2.5 font-mono text-[11px] text-dim leading-relaxed whitespace-pre-wrap select-text">
              {result.finalOutputText}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
