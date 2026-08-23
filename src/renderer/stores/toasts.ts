import { create } from 'zustand'
import { normalizeError } from '../../shared/errors'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  detail?: string
}

interface ToastState {
  toasts: Toast[]
  push: (kind: ToastKind, title: string, detail?: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, title, detail) => {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts.slice(-4), { id, kind, title, detail }] }))
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}))

/** Convenience helpers for common call sites. */
export function toastSuccess(title: string, detail?: string): void {
  useToasts.getState().push('success', title, detail)
}

export function toastError(err: unknown): void {
  const normalized = normalizeError(err)
  useToasts.getState().push('error', normalized.userMessage, normalized.technicalMessage)
}
