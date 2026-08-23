import { randomUUID } from 'node:crypto'
import type { WebContents } from 'electron'
import type { ProgressEvent } from '../../shared/ipc'
import { IPC } from '../../shared/ipc'
import { serializeStashError } from '../../shared/errors'

export interface OperationHandle {
  report(ratio: number | null, message?: string): void
  done(message?: string): void
  fail(err: unknown): void
}

/**
 * Tracks long-running operations and pushes progress events to the renderer.
 * Cancellation is cooperative: handlers poll `isCancelled` between chunks.
 */
export class ProgressBus {
  private active = new Map<string, boolean>()
  /** Callbacks fired exactly once when a specific operation is cancelled. */
  private cancelHandlers = new Map<string, Set<() => void>>()
  private listeners: Array<(event: ProgressEvent) => void> = []

  constructor(private sender?: WebContents) {}

  setSender(sender: WebContents | undefined): void {
    this.sender = sender
  }

  /**
   * Register a callback invoked when `cancel(operationId)` fires — e.g. to
   * interrupt a spawned child process immediately instead of waiting for the
   * next poll. Cleared automatically on done/fail/cancel.
   */
  onCancel(operationId: string, fn: () => void): void {
    let handlers = this.cancelHandlers.get(operationId)
    if (!handlers) {
      handlers = new Set()
      this.cancelHandlers.set(operationId, handlers)
    }
    handlers.add(fn)
  }

  /** Subscribe to raw events (used by tests). Returns an unsubscribe fn. */
  subscribe(listener: (event: ProgressEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  begin(initialMessage?: string): { id: string; handle: OperationHandle } {
    const id = randomUUID()
    this.active.set(id, true)
    this.emit({ operationId: id, status: 'active', ratio: null, message: initialMessage })
    const handle: OperationHandle = {
      report: (ratio, message) => {
        if (!this.active.has(id)) return
        const clamped = ratio === null ? null : Math.min(1, Math.max(0, ratio))
        this.emit({ operationId: id, status: 'active', ratio: clamped, message })
      },
      done: (message) => {
        if (!this.active.has(id)) return
        this.active.delete(id)
        this.cancelHandlers.delete(id)
        this.emit({ operationId: id, status: 'done', ratio: 1, message })
      },
      fail: (err) => {
        if (!this.active.has(id)) return
        this.active.delete(id)
        this.cancelHandlers.delete(id)
        this.emit({
          operationId: id,
          status: 'error',
          ratio: null,
          error: serializeStashError(err)
        })
      }
    }
    return { id, handle }
  }

  isCancelled(operationId: string): boolean {
    return !this.active.has(operationId)
  }

  cancel(operationId: string): void {
    if (!this.active.has(operationId)) return
    this.active.delete(operationId)
    this.emit({ operationId, status: 'cancelled', ratio: null })
    const handlers = this.cancelHandlers.get(operationId)
    if (handlers) {
      this.cancelHandlers.delete(operationId)
      for (const fn of handlers) fn()
    }
  }

  cancelAll(): void {
    for (const id of [...this.active.keys()]) this.cancel(id)
  }

  get activeCount(): number {
    return this.active.size
  }

  private emit(event: ProgressEvent): void {
    for (const listener of this.listeners) listener(event)
    try {
      this.sender?.send(IPC.progressEvent, event)
    } catch {
      // Window may be gone mid-operation; nothing to do.
    }
  }
}
