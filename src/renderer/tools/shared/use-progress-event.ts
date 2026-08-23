import { useEffect, useState } from 'react'
import type { ProgressEvent } from '../../../shared/ipc'

/**
 * Latest progress event pushed from main. Subscribing on mount (not on
 * operation start) guarantees no events are lost while the batch invoke is
 * still awaiting its result — the operation id arrives with the first event.
 */
export function useProgressEvent(): ProgressEvent | null {
  const [event, setEvent] = useState<ProgressEvent | null>(null)
  useEffect(() => window.stash.progress.subscribe(setEvent), [])
  return event
}

/** Best-effort history write; failures must never break the tool flow. */
export function recordHistoryQuietly(
  entry: Parameters<typeof window.stash.history.record>[0]
): void {
  try {
    void window.stash.history.record(entry)
  } catch {
    // Ignore — activity history must not surface errors into the tool UI.
  }
}
