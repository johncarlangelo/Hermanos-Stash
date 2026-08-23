/**
 * Pure regex evaluation. Never throws — every failure mode becomes a typed
 * `{ error }` result so the live UI can surface actionable messages instead
 * of crashing on malformed patterns (TOOL_SPEC.md → Errors).
 */

export interface RegexMatch {
  /** Character offset of the match within the input. */
  index: number
  text: string
  /** Positional capture groups; unmatched groups become ''. */
  groups: string[]
  /** Named capture groups, present only when the pattern defines them. */
  named?: Record<string, string>
}

export interface RegexTestResult {
  matches: RegexMatch[]
  /**
   * Exact number of matches found — EXCEPT when the `maxMatches` cap was hit,
   * in which case `total === maxMatches` means "maxMatches or more"
   * (`total >= maxMatches` ⇒ possibly capped). Documented by tests.
   */
  total: number
  error?: string
}

/** JS-supported flag set (no duplicate aliases like `g`/`y` overlaps removed). */
export const REGEX_FLAGS = 'dgimsuvy'

export interface TestRegexOptions {
  maxMatches?: number
}

export function testRegex(
  pattern: string,
  flags: string,
  input: string,
  options?: TestRegexOptions
): RegexTestResult {
  const maxMatches = Math.max(1, options?.maxMatches ?? 100)

  const flagError = validateFlags(flags)
  if (flagError) return { matches: [], total: 0, error: flagError }

  let regex: RegExp
  try {
    regex = new RegExp(pattern, flags)
  } catch (err) {
    return {
      matches: [],
      total: 0,
      error: err instanceof Error ? err.message : String(err)
    }
  }

  const iterative = flags.includes('g') || flags.includes('y')
  if (!iterative) {
    const m = regex.exec(input)
    return m ? { matches: [toMatch(m)], total: 1 } : { matches: [], total: 0 }
  }

  const matches: RegexMatch[] = []
  let total = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(input)) !== null) {
    matches.push(toMatch(m))
    total += 1
    // Zero-length matches otherwise loop forever; step past the position.
    if (m[0].length === 0) {
      if (regex.lastIndex >= input.length) break
      regex.lastIndex += 1
    }
    if (total >= maxMatches) break
  }
  return { matches, total }
}

/** Reject unknown characters and duplicated letters before compilation. */
function validateFlags(flags: string): string | null {
  const seen = new Set<string>()
  for (const flag of flags) {
    if (!REGEX_FLAGS.includes(flag)) {
      return `"${flag}" is not a supported JavaScript regex flag.`
    }
    if (seen.has(flag)) {
      return `Flag "${flag}" appears more than once.`
    }
    seen.add(flag)
  }
  return null
}

function toMatch(m: RegExpExecArray): RegexMatch {
  const groups = m.slice(1).map((g) => g ?? '')
  const namedEntries = Object.entries(m.groups ?? {}).filter(
    (entry): entry is [string, string] => entry[1] !== undefined
  )
  return {
    index: m.index,
    text: m[0],
    groups,
    ...(namedEntries.length > 0 ? { named: Object.fromEntries(namedEntries) } : {})
  }
}

export interface PreviewSegment {
  text: string
  match: boolean
}

/**
 * Split the input into contiguous segments for highlight rendering.
 * Overlapping/unsorted matches are tolerated by clamping to lastEnd.
 */
export function buildPreviewSegments(input: string, matches: RegexMatch[]): PreviewSegment[] {
  if (matches.length === 0) return input.length > 0 ? [{ text: input, match: false }] : []
  const ordered = [...matches].sort((a, b) => a.index - b.index)
  const segments: PreviewSegment[] = []
  let cursor = 0
  for (const match of ordered) {
    if (match.index < cursor || match.text.length === 0) continue
    if (match.index > cursor)
      segments.push({ text: input.slice(cursor, match.index), match: false })
    segments.push({ text: input.slice(match.index, match.index + match.text.length), match: true })
    cursor = match.index + match.text.length
  }
  if (cursor < input.length) segments.push({ text: input.slice(cursor), match: false })
  return segments
}
