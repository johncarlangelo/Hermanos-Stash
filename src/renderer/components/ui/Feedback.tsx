import { Check, Loader2, TriangleAlert } from 'lucide-react'
import { getIcon } from '../icons'
import type { StashError } from '../../../shared/errors'

export function Panel({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={`rounded-lg border border-line bg-surface ${className}`}>{children}</div>
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">{children}</h2>
  )
}

export function EmptyState({
  icon = 'folder',
  title,
  hint,
  action
}: {
  icon?: string
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  const Icon = getIcon(icon)
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Icon size={22} strokeWidth={1.5} className="text-faint" aria-hidden />
      <p className="text-[13px] text-dim">{title}</p>
      {hint && <p className="max-w-xs text-[12px] leading-relaxed text-faint">{hint}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  )
}

export function ErrorNote({ error }: { error: StashError }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-danger/35 bg-danger/8 px-3 py-2.5"
    >
      <TriangleAlert size={14} className="mt-0.5 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0">
        <p className="text-[12.5px] leading-snug text-danger">{error.userMessage}</p>
        {error.technicalMessage && (
          <p
            className="mt-1 truncate font-mono text-[11px] text-faint"
            title={error.technicalMessage}
          >
            {error.technicalMessage}
          </p>
        )}
      </div>
    </div>
  )
}

export function SuccessNote({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-md border border-ok/30 bg-ok/8 px-3 py-2.5"
    >
      <Check size={14} className="shrink-0 text-ok" aria-hidden />
      <p className="text-[12.5px] leading-snug text-ok">{message}</p>
    </div>
  )
}

export function ProgressBar({
  ratio,
  indeterminate = false,
  label
}: {
  ratio: number | null
  indeterminate?: boolean
  label?: string
}) {
  return (
    <div
      role="progressbar"
      aria-label={label ?? 'Progress'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate || ratio === null ? undefined : Math.round(ratio * 100)}
      className="h-1 w-full overflow-hidden rounded-full bg-line"
    >
      <div
        className={`h-full rounded-full bg-accent transition-all duration-200 ease-out ${
          indeterminate || ratio === null ? 'anim-indeterminate w-1/3' : ''
        }`}
        style={
          !indeterminate && ratio !== null ? { width: `${Math.round(ratio * 100)}%` } : undefined
        }
      />
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span role="status" aria-label={label ?? 'Loading'} className="inline-flex items-center gap-2">
      <Loader2 size={15} className="animate-spin text-dim" aria-hidden />
    </span>
  )
}
