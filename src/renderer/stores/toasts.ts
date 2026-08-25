import { toast } from 'sonner'
import { normalizeError } from '../../shared/errors'

/**
 * Toast API (Milestone 8 — sonner backend).
 *
 * The public surface is unchanged: `toastSuccess(title, detail?)` and
 * `toastError(err)` — 14 tool call sites keep working. Rendering moved to
 * sonner (glass-styled `<Toaster />` mounted in App.tsx): stacked depth,
 * swipe-to-dismiss, pause-on-hover.
 */

/** Bridge detail lines into sonner's description slot. */
function emit(kind: 'success' | 'error' | 'info', title: string, detail?: string): void {
  toast[kind](title, { description: detail })
}

export function toastSuccess(title: string, detail?: string): void {
  emit('success', title, detail)
}

export function toastError(err: unknown): void {
  const normalized = normalizeError(err)
  emit('error', normalized.userMessage, normalized.technicalMessage)
}

export function toastInfo(title: string, detail?: string): void {
  emit('info', title, detail)
}
