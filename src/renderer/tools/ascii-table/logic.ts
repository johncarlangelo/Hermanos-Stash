export type TableStyle =
  | 'unicode-single'
  | 'unicode-double'
  | 'unicode-rounded'
  | 'markdown'
  | 'ascii-simple'
  | 'ascii-compact'
  | 'sql'

export interface TableOptions {
  style: TableStyle
  hasHeader: boolean
  includeRowIndex: boolean
  align: 'auto' | 'left' | 'center' | 'right'
  padding: number // 1 or 2 spaces
}

export const DEFAULT_TABLE_OPTIONS: TableOptions = {
  style: 'unicode-single',
  hasHeader: true,
  includeRowIndex: false,
  align: 'auto',
  padding: 1
}

/**
 * Parse input string (CSV, TSV, JSON, or Pipe text) into 2D string grid
 */
export function parseTableData(input: string): string[][] {
  const trimmed = input.trim()
  if (!trimmed) return []

  // Check if JSON
  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'object' && parsed[0] !== null) {
          const headers = Object.keys(parsed[0])
          const rows = parsed.map((item) =>
            headers.map((h) => (item[h] !== undefined ? String(item[h]) : ''))
          )
          return [headers, ...rows]
        }
      }
    } catch {
      // Fallback to text parsing
    }
  }

  // Parse as lines
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []

  // Detect delimiter: tab, pipe, or comma
  const first = lines[0]
  const tabCount = (first.match(/\t/g) || []).length
  const pipeCount = (first.match(/\|/g) || []).length
  const commaCount = (first.match(/,/g) || []).length

  if (tabCount > 0 && tabCount >= commaCount && tabCount >= pipeCount) {
    return lines.map((l) => l.split('\t').map((c) => c.trim()))
  }

  if (pipeCount > 0 && pipeCount >= commaCount) {
    return lines.map((l) =>
      l
        .split('|')
        .map((c) => c.trim())
        .filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''))
    )
  }

  // Default CSV with quote handling
  return lines.map((l) => {
    const cells: string[] = []
    let current = ''
    let insideQuote = false
    for (let i = 0; i < l.length; i++) {
      const char = l[i]
      if (char === '"') {
        insideQuote = !insideQuote
      } else if (char === ',' && !insideQuote) {
        cells.push(current.trim().replace(/^"|"$/g, ''))
        current = ''
      } else {
        current += char
      }
    }
    cells.push(current.trim().replace(/^"|"$/g, ''))
    return cells
  })
}

interface BoxChars {
  tl: string
  tm: string
  tr: string
  ml: string
  mm: string
  mr: string
  bl: string
  bm: string
  br: string
  h: string
  v: string
  sep?: string
}

const STYLE_BOXES: Record<TableStyle, BoxChars> = {
  'unicode-single': {
    tl: '┌',
    tm: '┬',
    tr: '┐',
    ml: '├',
    mm: '┼',
    mr: '┤',
    bl: '└',
    bm: '┴',
    br: '┘',
    h: '─',
    v: '│'
  },
  'unicode-double': {
    tl: '╔',
    tm: '╦',
    tr: '╗',
    ml: '╠',
    mm: '╬',
    mr: '╣',
    bl: '╚',
    bm: '╩',
    br: '╝',
    h: '═',
    v: '║'
  },
  'unicode-rounded': {
    tl: '╭',
    tm: '┬',
    tr: '╮',
    ml: '├',
    mm: '┼',
    mr: '┤',
    bl: '╰',
    bm: '┴',
    br: '╯',
    h: '─',
    v: '│'
  },
  'ascii-simple': {
    tl: '+',
    tm: '+',
    tr: '+',
    ml: '+',
    mm: '+',
    mr: '+',
    bl: '+',
    bm: '+',
    br: '+',
    h: '-',
    v: '|'
  },
  'ascii-compact': {
    tl: '.',
    tm: '.',
    tr: '.',
    ml: ':',
    mm: '+',
    mr: ':',
    bl: "'",
    bm: "'",
    br: "'",
    h: '-',
    v: '|'
  },
  sql: {
    tl: '+',
    tm: '+',
    tr: '+',
    ml: '+',
    mm: '+',
    mr: '+',
    bl: '+',
    bm: '+',
    br: '+',
    h: '-',
    v: '|'
  },
  markdown: {
    tl: '',
    tm: '',
    tr: '',
    ml: '|',
    mm: '|',
    mr: '|',
    bl: '',
    bm: '',
    br: '',
    h: '-',
    v: '|'
  }
}

/**
 * Format 2D table into formatted ASCII string
 */
export function generateAsciiTable(data: string[][], options: TableOptions): string {
  if (!data || data.length === 0 || data[0].length === 0) return ''

  let processed = data.map((row) => [...row])

  // Prepend Row Index if enabled
  if (options.includeRowIndex) {
    processed = processed.map((row, idx) => {
      if (idx === 0 && options.hasHeader) {
        return ['#', ...row]
      }
      const num = options.hasHeader ? idx : idx + 1
      return [String(num), ...row]
    })
  }

  // Calculate column counts & max width per column
  const numCols = Math.max(...processed.map((r) => r.length))
  const colWidths = Array(numCols).fill(0)

  for (let r = 0; r < processed.length; r++) {
    for (let c = 0; c < numCols; c++) {
      const val = processed[r][c] ?? ''
      colWidths[c] = Math.max(colWidths[c], val.length)
    }
  }

  const padStr = ' '.repeat(options.padding)
  const isNumberCol = (cIdx: number): boolean => {
    const startRow = options.hasHeader ? 1 : 0
    let numericCount = 0
    let total = 0
    for (let r = startRow; r < processed.length; r++) {
      const val = processed[r][cIdx] ?? ''
      if (val.trim() === '') continue
      total++
      if (!isNaN(Number(val.replace(/[$,%]/g, '')))) numericCount++
    }
    return total > 0 && numericCount === total
  }

  const alignCell = (val: string, width: number, cIdx: number): string => {
    const diff = width - val.length
    if (diff <= 0) return val

    const alignment =
      options.align === 'auto' ? (isNumberCol(cIdx) ? 'right' : 'left') : options.align

    if (alignment === 'right') {
      return ' '.repeat(diff) + val
    } else if (alignment === 'center') {
      const left = Math.floor(diff / 2)
      const right = diff - left
      return ' '.repeat(left) + val + ' '.repeat(right)
    } else {
      return val + ' '.repeat(diff)
    }
  }

  // Markdown Special Case
  if (options.style === 'markdown') {
    const mdLines: string[] = []
    const headerRow = processed[0] ?? []
    const headerCells = colWidths.map((w, i) => alignCell(headerRow[i] ?? '', w, i))
    mdLines.push(`| ${headerCells.join(' | ')} |`)

    // Separator line
    const sepCells = colWidths.map((w, i) => {
      const align = options.align === 'auto' && isNumberCol(i) ? 'right' : options.align
      if (align === 'right') return '-'.repeat(Math.max(w - 1, 1)) + ':'
      if (align === 'center') return ':' + '-'.repeat(Math.max(w - 2, 1)) + ':'
      return '-'.repeat(w)
    })
    mdLines.push(`| ${sepCells.join(' | ')} |`)

    // Rows
    for (let r = 1; r < processed.length; r++) {
      const row = processed[r]
      const cells = colWidths.map((w, i) => alignCell(row[i] ?? '', w, i))
      mdLines.push(`| ${cells.join(' | ')} |`)
    }
    return mdLines.join('\n')
  }

  const box = STYLE_BOXES[options.style]
  const lines: string[] = []

  // Top Border
  if (box.tl) {
    const topSegments = colWidths.map((w) => box.h.repeat(w + options.padding * 2))
    lines.push(box.tl + topSegments.join(box.tm) + box.tr)
  }

  for (let r = 0; r < processed.length; r++) {
    const row = processed[r]
    const cells = colWidths.map((w, i) => padStr + alignCell(row[i] ?? '', w, i) + padStr)
    lines.push(box.v + cells.join(box.v) + box.v)

    // Divider under header or between rows
    if (r === 0 && options.hasHeader && r < processed.length - 1) {
      const midSegments = colWidths.map((w) => box.h.repeat(w + options.padding * 2))
      lines.push(box.ml + midSegments.join(box.mm) + box.mr)
    }
  }

  // Bottom Border
  if (box.bl) {
    const botSegments = colWidths.map((w) => box.h.repeat(w + options.padding * 2))
    lines.push(box.bl + botSegments.join(box.bm) + box.br)
  }

  return lines.join('\n')
}
