/**
 * Prompt template logic: `{{variable}}` extraction and fill-in.
 * Variables are case-sensitive, trimmed, and de-duplicated preserving
 * first-appearance order.
 */

const VARIABLE_PATTERN = /(?<!\{)\{\{\s*([^{}\s][^{}]*?)\s*\}\}(?!\})/g

export function extractVariables(body: string): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const match of body.matchAll(VARIABLE_PATTERN)) {
    const name = match[1]!.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    ordered.push(name)
  }
  return ordered
}

export function fillTemplate(
  body: string,
  values: Record<string, string>
): { ok: true; output: string } | { ok: false; error: string } {
  if (typeof values !== 'object' || values === null) {
    return { ok: false, error: 'Variable values must be provided as an object.' }
  }
  let missing = false
  const output = body.replace(VARIABLE_PATTERN, (_whole, rawName: string) => {
    const name = rawName.trim()
    const value = values[name]
    if (value === undefined) {
      missing = true
      return `{{${name}}}`
    }
    return value
  })
  if (missing) {
    return { ok: false, error: 'Fill in every variable before copying.' }
  }
  return { ok: true, output }
}

/** Parse a comma-separated tag string into clean, unique tags. */
export function parseTagInput(raw: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const part of raw.split(',')) {
    const tag = part.trim().toLowerCase().slice(0, 24)
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags.slice(0, 12)
}

/**
 * Parse an exported prompt-library JSON document into save inputs.
 * Accepts `{ prompts: [...] }` or a bare array; invalid entries are skipped.
 */
export interface ParsedImport {
  prompts: Array<{ title: string; body: string; tags: string[] }>
  skipped: number
}

export function parseLibraryImport(
  raw: string
): { ok: true; value: ParsedImport } | { ok: false; error: string } {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  const list = Array.isArray(data)
    ? data
    : typeof data === 'object' &&
        data !== null &&
        Array.isArray((data as { prompts?: unknown })['prompts'])
      ? ((data as { prompts: unknown[] })['prompts'] as unknown[])
      : null
  if (!list) {
    return { ok: false, error: 'Expected an array of prompts or an object with a "prompts" array.' }
  }

  const prompts: ParsedImport['prompts'] = []
  let skipped = 0
  for (const item of list.slice(0, 500)) {
    if (typeof item !== 'object' || item === null) {
      skipped += 1
      continue
    }
    const rec = item as Record<string, unknown>
    const title = typeof rec['title'] === 'string' ? rec['title'].trim().slice(0, 120) : ''
    const body = typeof rec['body'] === 'string' ? rec['body'].slice(0, 32_000) : ''
    if (!title || !body.trim()) {
      skipped += 1
      continue
    }
    const tags = Array.isArray(rec['tags'])
      ? (rec['tags'] as unknown[]).filter((t): t is string => typeof t === 'string')
      : []
    prompts.push({ title, body, tags })
  }
  return { ok: true, value: { prompts, skipped } }
}
