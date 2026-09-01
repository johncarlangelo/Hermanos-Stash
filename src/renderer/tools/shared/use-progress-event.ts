import { useEffect, useState } from 'react'
import type { HistoryEntryInput, ProgressEvent } from '../../../shared/ipc'

/**
 * Latest progress event pushed from main. Subscribing on mount (not on
 * operation start) guarantees no events are lost while the batch invoke is
 * still awaiting its result — the operation id arrives with the first event.
 */
export function useProgressEvent(): ProgressEvent | null {
  const [event, setEvent] = useState<ProgressEvent | null>(null)
  useEffect(() => window.stash?.progress?.subscribe?.(setEvent), [])
  return event
}

/** Best-effort history write; failures must never break the tool flow. */
export function recordHistoryQuietly(
  entryOrToolId: HistoryEntryInput | string,
  toolName?: string,
  _category?: string,
  summary?: string
): void {
  try {
    if (typeof entryOrToolId === 'string') {
      void window.stash?.history?.record?.({
        toolId: entryOrToolId,
        operation: toolName || entryOrToolId,
        inputs: [],
        outputs: [],
        status: 'success',
        message: summary || `${toolName || entryOrToolId} executed`
      })
    } else {
      void window.stash?.history?.record?.(entryOrToolId)
    }
  } catch {
    // Ignore — activity history must not surface errors into the tool UI.
  }
}
