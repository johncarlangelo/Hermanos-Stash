/**
 * Pure batch-rename naming engine.
 *
 * Transformations operate on the BASE name (extension split off first);
 * the extension itself is replaced only when `changeExt.to` is provided.
 * No filesystem access here — the renderer previews with this module and
 * the main process applies the already-computed pairs (shared/ipc.ts).
 */

export type NumberingMode = 'none' | 'prefix-sep' | 'suffix-sep'
export type CaseMode = 'none' | 'lower' | 'upper' | 'title'

export interface RenameRules {
  find?: string
  replace?: string
  useRegex?: boolean
  prefix?: string
  suffix?: string
  numbering?: NumberingMode
  /** Separator used around numbering tokens; defaults to '-'. */
  sep?: string
  caseMode?: CaseMode
  changeExt?: { from?: string; to: string }
}

/** Split a base name into stem and extension ("a.b.txt" → ["a.b", ".txt"]). */
function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return [name, '']
  return [name.slice(0, dot), name.slice(dot)]
}

/** Normalize a user-typed extension to lowercase with a leading dot. */
function normalizeExt(ext: string): string {
  const trimmed = ext.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('.') ? trimmed.toLowerCase() : `.${trimmed.toLowerCase()}`
}

function titleCase(base: string): string {
  return base
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_, lead: string, ch: string) => lead + ch.toUpperCase())
}

function numberingToken(index: number): string {
  return String(index + 1).padStart(3, '0')
}

/**
 * Apply every rule to one base name. Throws on an invalid regex so callers
 * can surface a visible error instead of silently skipping entries.
 */
export function applyRenameRules(name: string, index: number, rules: RenameRules): string {
  const [base, ext] = splitExtension(name)

  let next = base

  // 1. find / replace (literal or regex).
  if (rules.find && rules.find.length > 0) {
    if (rules.useRegex) {
      // Throws SyntaxError for malformed patterns — caller-visible by design.
      const re = new RegExp(rules.find, 'g')
      next = next.replace(re, rules.replace ?? '')
    } else {
      next = next.split(rules.find).join(rules.replace ?? '')
    }
  }

  // 2. case mode.
  if (rules.caseMode === 'lower') next = next.toLowerCase()
  else if (rules.caseMode === 'upper') next = next.toUpperCase()
  else if (rules.caseMode === 'title') next = titleCase(next)

  // 3. prefix / suffix.
  if (rules.prefix) next = rules.prefix + next
  if (rules.suffix) next = next + rules.suffix

  // 4. numbering.
  if (rules.numbering === 'prefix-sep') {
    next = `${numberingToken(index)}${rules.sep ?? '-'}${next}`
  } else if (rules.numbering === 'suffix-sep') {
    next = `${next}${rules.sep ?? '-'}${numberingToken(index)}`
  }

  // 5. extension replacement (only when a target extension is given).
  if (rules.changeExt?.to && rules.changeExt.to.trim()) {
    const target = normalizeExt(rules.changeExt.to)
    const fromFilter = rules.changeExt.from ? normalizeExt(rules.changeExt.from) : null
    if (!fromFilter || fromFilter === ext.toLowerCase()) {
      return next + target
    }
  }

  return next + ext
}

export interface PlanEntry {
  name: string
  isDirectory: boolean
}

export interface RenamePlan {
  plan: Array<{ from: string; to: string }>
  /** Source names whose targets collide case-insensitively. */
  conflicts: string[]
  /** Set when the rules themselves are invalid (e.g. bad regex). */
  error?: string
}

/**
 * Compute the rename mapping for a folder listing. Directories are included
 * only when asked; identity mappings never appear in the plan; duplicate
 * targets are reported as conflicts rather than applied.
 */
export function buildRenamePlan(
  entries: PlanEntry[],
  rules: RenameRules,
  options?: { includeDirectories?: boolean }
): RenamePlan {
  const candidates = options?.includeDirectories ? entries : entries.filter((e) => !e.isDirectory)

  const plan: Array<{ from: string; to: string }> = []
  try {
    for (const entry of candidates) {
      const to = applyRenameRules(entry.name, plan.length, rules)
      if (to !== entry.name) {
        plan.push({ from: entry.name, to })
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { plan: [], conflicts: [], error: message || 'Invalid pattern.' }
  }

  const byTarget = new Map<string, string[]>()
  for (const item of plan) {
    const key = item.to.toLowerCase()
    const bucket = byTarget.get(key)
    if (bucket) bucket.push(item.from)
    else byTarget.set(key, [item.from])
  }
  const conflicts: string[] = []
  for (const names of byTarget.values()) {
    if (names.length > 1) conflicts.push(...names)
  }

  return { plan, conflicts }
}
