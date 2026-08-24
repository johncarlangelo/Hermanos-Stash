/**
 * Pure SQL formatting via `sql-formatter`. No React, no DOM — fully
 * unit-testable. Errors are returned as values, never thrown.
 */

import { format } from 'sql-formatter'

export type SqlLanguage = 'sql' | 'postgresql' | 'mysql' | 'sqlite'
export type KeywordCase = 'preserve' | 'upper' | 'lower'

export interface SqlFormatOptions {
  language?: SqlLanguage
  keywordCase?: KeywordCase
  /** Whitespace used for indentation; defaults to two spaces. */
  indent?: string
}

export type SqlFormatResult =
  { ok: true; output: string } | { ok: false; error: { message: string } }

function indentOptions(indent: string): { tabWidth: number; useTabs: boolean } {
  if (indent.includes('\t')) return { tabWidth: 1, useTabs: true }
  const width = Math.max(1, Math.min(indent.length || 2, 8))
  return { tabWidth: width, useTabs: false }
}

/** Format a SQL query, mapping library failures into structured errors. */
export function formatSql(input: string, options: SqlFormatOptions = {}): SqlFormatResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: true, output: '' }

  try {
    const output = format(trimmed, {
      language: options.language ?? 'sql',
      keywordCase: options.keywordCase ?? 'preserve',
      ...indentOptions(options.indent ?? '  ')
    })
    return { ok: true, output }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      error: { message: humanizeParseError(raw) }
    }
  }
}

/** sql-formatter appends a raw-token dump after parse errors; strip it. */
function humanizeParseError(raw: string): string {
  const cleaned = raw.replace(/\s*Unexpected token:[\s\S]*$/, '').replace(/\s+$/, '')
  return cleaned || 'This query could not be parsed as SQL.'
}
