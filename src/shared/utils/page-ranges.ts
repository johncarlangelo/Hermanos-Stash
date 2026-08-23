/**
 * Pure parser for human page-range specifications like "1-3, 7, 10-12".
 *
 * Ranges are 1-based and inclusive; groups may overlap but duplicates are
 * removed while preserving first-appearance order. Validation is total:
 * callers receive either groups or one actionable error message.
 */
export type PageRangeParse = { groups: number[][] } | { error: string }

export function parsePageRanges(spec: string, pageCount: number): PageRangeParse {
  if (pageCount < 1) {
    return { error: 'This document has no pages to split.' }
  }
  const trimmed = spec.trim()
  if (trimmed.length === 0) {
    return { error: 'Enter a page range first — e.g. "1-3, 7".' }
  }

  const groups: number[][] = []
  const seen = new Set<number>()
  for (const part of trimmed.split(',')) {
    const token = part.trim()
    if (token.length === 0) {
      return { error: 'The range has an empty section — check for extra commas.' }
    }
    const bounds = token.split('-')
    if (bounds.length > 2) {
      return { error: `"${token}" isn't a valid page or range.` }
    }
    const start = Number(bounds[0])
    const end = bounds.length === 2 ? Number(bounds[1]) : start
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      return { error: `"${token}" isn't a whole page number or range.` }
    }
    if (start < 1 || end < 1) {
      return { error: `Page numbers start at 1 — "${token}" is out of range.` }
    }
    if (end < start) {
      return { error: `"${token}" runs backwards — ranges go low to high.` }
    }
    if (start > pageCount || end > pageCount) {
      return {
        error: `"${token}" exceeds this document's ${pageCount} page${pageCount === 1 ? '' : 's'}.`
      }
    }
    const group: number[] = []
    for (let page = start; page <= end; page += 1) {
      if (!seen.has(page)) {
        seen.add(page)
        group.push(page)
      }
    }
    // A group made entirely of already-seen pages is dropped so no empty
    // output file can ever be produced.
    if (group.length > 0) groups.push(group)
  }
  if (groups.length === 0) {
    return { error: 'Enter a page range first — e.g. "1-3, 7".' }
  }
  return { groups }
}
