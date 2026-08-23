import { extensionOf, formatBytes, guessMimeType } from '../../../shared/utils/files'
import type { FileMetadata } from '../../../shared/ipc'

export interface FileDisplayInfo {
  path: string
  name: string
  /** Lowercase extension including the dot; '' when the file has none. */
  extension: string
  sizeLabel: string
  mimeTypeLabel: string
  createdLabel: string
  modifiedLabel: string
  modifiedRelative: string
}

/**
 * Map raw stat results into presentation-ready rows. Pure and deterministic:
 * timestamps are formatted through Intl but `nowMs` is injected so relative
 * labels stay testable.
 */
export function buildFileDisplayInfos(metas: FileMetadata[], nowMs: number): FileDisplayInfo[] {
  return metas.map((meta) => {
    const extension = meta.extension || extensionOf(meta.name)
    const mime = guessMimeType(meta.name)
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
    return {
      path: meta.path,
      name: meta.name,
      extension,
      sizeLabel: formatBytes(meta.sizeBytes),
      mimeTypeLabel: mime ?? (meta.isDirectory ? 'Folder' : 'Unknown'),
      createdLabel: dateFormatter.format(new Date(meta.createdAtMs)),
      modifiedLabel: dateFormatter.format(new Date(meta.modifiedAtMs)),
      modifiedRelative: formatRelativeTime(meta.modifiedAtMs, nowMs)
    }
  })
}

/** Coarse humanized age ("just now", "5 minutes ago", "3 days ago"). */
export function formatRelativeTime(timestampMs: number, nowMs: number): string {
  const diffSeconds = Math.round((timestampMs - nowMs) / 1000)
  const abs = Math.abs(diffSeconds)

  if (abs < 60) return 'just now'

  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [86400 * 30, 'month'],
    [86400 * 365, 'year']
  ]
  let divisor = 1
  let unit: Intl.RelativeTimeFormatUnit = 'second'
  for (const [threshold, u] of units) {
    if (abs >= threshold) {
      divisor = threshold
      unit = u
    }
  }
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(
    Math.trunc(diffSeconds / divisor),
    unit
  )
}

/** Drop paths already present so re-dropping a file doesn't duplicate rows. */
export function mergeUniquePaths(existingPaths: readonly string[], incoming: string[]): string[] {
  const seen = new Set(existingPaths)
  return [...new Set(incoming.filter((p) => !seen.has(p)))]
}
