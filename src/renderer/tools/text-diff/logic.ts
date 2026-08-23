export type DiffRowType = 'equal' | 'added' | 'removed'

export interface DiffRow {
  type: DiffRowType
  text: string
  /** 1-based index in the original text (removed/equal rows). */
  aIndex?: number
  /** 1-based index in the modified text (added/equal rows). */
  bIndex?: number
}

export interface DiffSummary {
  rows: DiffRow[]
  added: number
  removed: number
}

export const MAX_LINES = 2000

export type DiffResult = DiffSummary | { error: 'too large' }

function splitLines(text: string): string[] {
  if (text.length === 0) return []
  return text.split('\n')
}

/**
 * Line diff via LCS dynamic programming. Guarded: inputs beyond MAX_LINES per
 * side return `{ error: 'too large' }` instead of degrading the UI.
 */
export function diffLines(a: string, b: string): DiffResult {
  const aLines = splitLines(a)
  const bLines = splitLines(b)

  if (aLines.length > MAX_LINES || bLines.length > MAX_LINES) {
    return { error: 'too large' }
  }

  const n = aLines.length
  const m = bLines.length

  // LCS length table; row-major flat array keeps 2000×2000 affordable.
  const table = new Int32Array((n + 1) * (m + 1))
  const at = (i: number, j: number) => i * (m + 1) + j

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[at(i, j)] =
        aLines[i] === bLines[j]
          ? table[at(i + 1, j + 1)] + 1
          : Math.max(table[at(i + 1, j)], table[at(i, j + 1)])
    }
  }

  const rows: DiffRow[] = []
  let added = 0
  let removed = 0

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      rows.push({ type: 'equal', text: aLines[i], aIndex: i + 1, bIndex: j + 1 })
      i += 1
      j += 1
    } else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) {
      rows.push({ type: 'removed', text: aLines[i], aIndex: i + 1 })
      removed += 1
      i += 1
    } else {
      rows.push({ type: 'added', text: bLines[j], bIndex: j + 1 })
      added += 1
      j += 1
    }
  }
  while (i < n) {
    rows.push({ type: 'removed', text: aLines[i], aIndex: i + 1 })
    removed += 1
    i += 1
  }
  while (j < m) {
    rows.push({ type: 'added', text: bLines[j], bIndex: j + 1 })
    added += 1
    j += 1
  }

  return { rows, added, removed }
}
