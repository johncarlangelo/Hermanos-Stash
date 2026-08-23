import { useEffect } from 'react'
import { Check, TriangleAlert, X } from 'lucide-react'
import { useToasts } from '../stores/toasts'

const AUTO_DISMISS_MS = 4200

function ToastRow({
  id,
  kind,
  title,
  detail
}: {
  id: number
  kind: string
  title: string
  detail?: string
}) {
  const dismiss = useToasts((s) => s.dismiss)

  useEffect(() => {
    const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [id, dismiss])

  const isError = kind === 'error'
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className="anim-slide-up pointer-events-auto flex w-80 items-start gap-2.5 rounded-md border border-line-strong bg-overlay px-3 py-2.5 shadow-lg shadow-black/25"
    >
      {isError ? (
        <TriangleAlert size={14} className="mt-0.5 shrink-0 text-danger" aria-hidden />
      ) : kind === 'success' ? (
        <Check size={14} className="mt-0.5 shrink-0 text-ok" aria-hidden />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className={`text-[12.5px] leading-snug ${isError ? 'text-danger' : 'text-ink'}`}>
          {title}
        </p>
        {detail && (
          <p className="mt-0.5 truncate font-mono text-[11px] text-faint" title={detail}>
            {detail}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(id)}
        className="shrink-0 cursor-pointer rounded-sm p-0.5 text-faint transition-colors duration-150 hover:bg-surface hover:text-ink"
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function ToastViewport() {
  const toasts = useToasts((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col-reverse gap-2">
      {toasts.map((t) => (
        <ToastRow key={t.id} {...t} />
      ))}
    </div>
  )
}
