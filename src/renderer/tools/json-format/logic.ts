/**
 * Pure JSON formatting/validation logic. No React, no DOM — fully unit-testable.
 */

export interface JsonIssue {
  message: string
  line?: number
  column?: number
}

export type FormatResult = { ok: true; output: string } | { ok: false; error: JsonIssue }

export interface ValidateResult {
  valid: boolean
  error?: JsonIssue
}

/**
 * Indentation for pretty mode. Extends the numeric contract with `'\t'`
 * (the UI offers a tab option) and `'minify'` for single-line output.
 */
export type JsonIndent = number | '\t' | 'minify'

/** Convert a 0-based character offset into 1-based line/column coordinates. */
export function positionToLineColumn(
  input: string,
  position: number
): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(Math.floor(position), input.length))
  const before = input.slice(0, clamped)
  let line = 1
  let lastNewline = -1
  for (let i = 0; i < before.length; i++) {
    if (before.charCodeAt(i) === 10) {
      line += 1
      lastNewline = i
    }
  }
  return { line, column: clamped - lastNewline }
}

function issueFromParseError(err: unknown, input: string): JsonIssue {
  const raw = err instanceof Error ? err.message : String(err)
  const issue: JsonIssue = { message: humanizeMessage(raw) }

  // V8 reports failures either as "… at position N (line L column C)" or,
  // for some token errors, without any offset. Prefer recomputing from the
  // character offset so behavior is identical across V8 versions; fall back
  // to V8's own line/column hint when present.
  const positionMatch = /position (\d+)/i.exec(raw)
  if (positionMatch) {
    const { line, column } = positionToLineColumn(input, Number(positionMatch[1]))
    issue.line = line
    issue.column = column
    return issue
  }

  const hintMatch = /\(line (\d+) column (\d+)\)/i.exec(raw)
  if (hintMatch) {
    issue.line = Number(hintMatch[1])
    issue.column = Number(hintMatch[2])
  }
  return issue
}

function humanizeMessage(raw: string): string {
  if (/unexpected end of json input/i.test(raw)) {
    return 'The JSON text ends unexpectedly — a value or closing bracket is missing.'
  }
  return raw.replace(/^JSON\.parse:\s*/i, '')
}

/** Format parsed JSON as pretty-printed or minified output. */
export function formatJson(input: string, indent: JsonIndent): FormatResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, error: { message: 'Nothing to format — the input is empty.' } }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (err) {
    return { ok: false, error: issueFromParseError(err, trimmed) }
  }

  const output =
    indent === 'minify'
      ? JSON.stringify(parsed)
      : JSON.stringify(parsed, null, typeof indent === 'number' ? clampIndent(indent) : indent)

  return { ok: true, output }
}

/** Validate without producing formatted output. */
export function validateJson(input: string): ValidateResult {
  const trimmed = input.trim()
  if (!trimmed) {
    return { valid: false, error: { message: 'Nothing to validate — the input is empty.' } }
  }
  try {
    JSON.parse(trimmed)
    return { valid: true }
  } catch (err) {
    return { valid: false, error: issueFromParseError(err, trimmed) }
  }
}

function clampIndent(n: number): number {
  return Math.max(0, Math.min(Math.floor(n), 10))
}
