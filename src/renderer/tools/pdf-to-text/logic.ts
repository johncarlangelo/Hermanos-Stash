/**
 * Pure helpers for PDF → Text extraction. The pdf.js walk itself lives in the
 * component (it needs a live document); everything testable is here.
 */

import { parsePageSequence } from '../../../shared/utils/page-ranges'

export interface PdfTextItemLike {
  str: string
  hasEOL: boolean
}

/**
 * Join text-content items into page text.
 *
 * pdf.js already embeds intra-line kerning/spacing inside `str`, so the only
 * dependable structural signal left is `hasEOL` (a true line end). We
 * concatenate `str` verbatim and turn `hasEOL` into either a newline
 * (preserve) or a single space (flow), then tidy the whitespace edges.
 * No gap-threshold heuristic: item widths are viewport-relative and less
 * reliable than `hasEOL`.
 */
export function assembleText(
  items: PdfTextItemLike[],
  options?: { preserveLineBreaks?: boolean }
): string {
  const preserve = options?.preserveLineBreaks ?? true
  let raw = ''
  for (const item of items) {
    raw += item.str
    if (item.hasEOL) raw += preserve ? '\n' : ' '
  }
  return preserve
    ? raw
        .replace(/[ \t]+(?=\n)/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd()
    : raw.replace(/\s+/g, ' ').trim()
}

/** Join per-page texts with a blank line between pages when preserving. */
export function joinPages(pages: string[], preserveLineBreaks: boolean): string {
  return pages.join(preserveLineBreaks ? '\n\n' : '\n')
}

export type PageSelection = { pages: number[] } | { error: string }

/**
 * Resolve the user's range spec against the document. Empty input or "all"
 * selects every page; anything else goes through the shared sequence parser.
 */
export function resolvePages(spec: string, pageCount: number): PageSelection {
  if (pageCount < 1) return { error: 'This document has no pages to read.' }
  const trimmed = spec.trim().toLowerCase()
  if (trimmed === '' || trimmed === 'all') {
    const pages = Array.from({ length: pageCount }, (_, index) => index + 1)
    return { pages }
  }
  const parsed = parsePageSequence(trimmed, pageCount)
  return 'pages' in parsed ? { pages: parsed.pages } : { error: parsed.error }
}

/** Whitespace-delimited word count for the stats line. */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
