import { positionToLineColumn } from '../json-format/logic'

export type CsvDelimiter = ',' | ';' | '\t'

export interface CsvIssue {
  message: string
  line?: number
}

export type ParseCsvResult = { ok: true; rows: string[][] } | { ok: false; error: CsvIssue }

export type CsvJsonResult = { ok: true; output: string } | { ok: false; error: CsvIssue }

export interface CsvJsonOptions {
  delimiter: CsvDelimiter
  /** When on, the first parsed row supplies column names (array of objects). */
  headerRow: boolean
}

/**
 * Strict RFC 4180 parser: double quotes escape fields, `""` escapes a literal
 * quote inside a quoted field. CRLF/CR are normalized to LF before parsing and
 * a trailing final newline is tolerated rather than producing an extra row.
 */
export function parseCsv(text: string, delimiter: CsvDelimiter = ','): ParseCsvResult {
  if (text.length === 0) return { ok: true, rows: [] }

  const source = text.replace(/\r\n?/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let quoteOpenedAtLine = -1
  let line = 1

  const finalizeRow = () => {
    row.push(field)
    field = ''
    rows.push(row)
    row = []
  }

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (ch === '\n') line += 1

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
      quoteOpenedAtLine = line
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      finalizeRow()
    } else {
      field += ch
    }
  }

  if (inQuotes) {
    return {
      ok: false,
      error: {
        message: 'A quoted field was never closed — add the missing double quote.',
        line: Math.max(quoteOpenedAtLine, 1)
      }
    }
  }

  // Only emit a pending final row when it actually holds content, so a single
  // trailing newline does not create an empty record.
  if (row.length > 0 || field !== '') finalizeRow()

  return { ok: true, rows }
}

function needsQuoting(fieldText: string, delimiter: CsvDelimiter): boolean {
  return (
    fieldText.includes(delimiter) ||
    fieldText.includes('"') ||
    fieldText.includes('\n') ||
    /^\s/.test(fieldText) ||
    /\s$/.test(fieldText)
  )
}

function encodeField(fieldText: string, delimiter: CsvDelimiter): string {
  if (!needsQuoting(fieldText, delimiter)) return fieldText
  return `"${fieldText.replaceAll('"', '""')}"`
}

/** Serializes rows back to delimited text, quoting fields where required. */
export function serializeCsv(rows: string[][], delimiter: CsvDelimiter = ','): string {
  return rows
    .map((row) => row.map((fieldText) => encodeField(fieldText, delimiter)).join(delimiter))
    .join('\n')
}

function issueFromJsonParseError(err: unknown, input: string): CsvIssue {
  const raw = err instanceof Error ? err.message : String(err)
  const issue: CsvIssue = { message: raw.replace(/^JSON\.parse:\s*/i, '') }
  const positionMatch = /position (\d+)/i.exec(raw)
  if (positionMatch) {
    const { line } = positionToLineColumn(input, Number(positionMatch[1]))
    issue.line = line
  }
  return issue
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** CSV → pretty-printed JSON, either as objects (header on) or arrays (header off). */
export function csvToJson(text: string, options: CsvJsonOptions): CsvJsonResult {
  const parsed = parseCsv(text, options.delimiter)
  if (!parsed.ok) return parsed

  if (parsed.rows.length === 0) {
    return { ok: false, error: { message: 'Nothing to convert — the input is empty.' } }
  }

  const output = options.headerRow
    ? toObjectsWithHeader(parsed.rows)
    : JSON.stringify(parsed.rows, null, 2)

  return { ok: true, output }
}

function toObjectsWithHeader(rows: string[][]): string {
  const [header, ...dataRows] = rows
  const records = dataRows.map((row) => {
    const record: Record<string, string> = {}
    row.forEach((cell, index) => {
      record[header[index] ?? `column${index + 1}`] = cell
    })
    return record
  })
  return JSON.stringify(records, null, 2)
}

/** JSON (array of arrays, or array of objects with header mode) → delimited text. */
export function jsonToCsv(text: string, options: CsvJsonOptions): CsvJsonResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ok: false, error: { message: 'Nothing to convert — the input is empty.' } }
  }

  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch (err) {
    return { ok: false, error: issueFromJsonParseError(err, trimmed) }
  }

  if (!Array.isArray(data)) {
    return { ok: false, error: { message: 'Expected a JSON array of rows at the top level.' } }
  }

  const allArrays = data.every((item) => Array.isArray(item))
  const hasObjects = data.some(
    (item) => typeof item === 'object' && item !== null && !Array.isArray(item)
  )

  if (allArrays) {
    const rows = (data as unknown[][]).map((row) => row.map(cellToString))
    return { ok: true, output: serializeCsv(rows, options.delimiter) }
  }

  if (hasObjects && !options.headerRow) {
    return {
      ok: false,
      error: {
        message: 'Rows are named objects — enable “First row is a header” to export them.'
      }
    }
  }

  if (hasObjects) {
    const records = data.filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null && !Array.isArray(item)
    )
    const header: string[] = []
    for (const record of records) {
      for (const key of Object.keys(record)) {
        if (!header.includes(key)) header.push(key)
      }
    }
    const rows = [
      header,
      ...records.map((record) => header.map((key) => cellToString(record[key])))
    ]
    return { ok: true, output: serializeCsv(rows, options.delimiter) }
  }

  return {
    ok: false,
    error: { message: 'Mixing arrays and objects in one array is not supported.' }
  }
}

/** Row × column dimensions for the stats line. */
export function describeShape(rows: string[][]): string {
  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0)
  return `${rows.length} rows × ${columns} cols`
}
