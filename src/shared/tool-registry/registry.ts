import type { CategoryId, ToolDefinition } from '../types/tool'
import { CATEGORIES, getCategory } from '../constants/categories'

export interface ToolSearchMatch {
  tool: ToolDefinition
  score: number
}

/**
 * Score how well `query` matches a single string.
 * Returns null when there is no match at all.
 *
 * - exact start-of-string match scores highest
 * - substring matches score by position
 * - in-order subsequence matches score low
 */
export function fuzzyMatchScore(
  query: string,
  target: string,
  options?: { allowSubsequence?: boolean }
): number | null {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (!q) return 0

  const idx = t.indexOf(q)
  if (idx === 0) return 100
  if (idx > 0) {
    // Word-boundary hits (e.g. "pdf" in "Merge PDF") rank above mid-word hits.
    const prevChar = t[idx - 1]
    if (prevChar === ' ' || prevChar === '-') return 85 - Math.min(idx, 30)
    return 70 - Math.min(idx, 30)
  }

  if (options?.allowSubsequence === false) return null

  let searchFrom = 0
  for (let i = 0; i < q.length; i++) {
    const found = t.indexOf(q[i], searchFrom)
    if (found === -1) return null
    searchFrom = found + 1
  }
  return 20
}

function scoreTokenAgainstTool(token: string, tool: ToolDefinition): number | null {
  // Subsequence matching is allowed only on short identity fields; enabling
  // it on long descriptions produces noisy false positives.
  const fields: Array<[string, number, boolean]> = [
    [tool.name, 1, true],
    [tool.id, 0.9, true],
    ...tool.tags.map((tag) => [tag, 0.8, true] as [string, number, boolean]),
    [getCategory(tool.category)?.label ?? '', 0.5, false],
    [tool.description, 0.4, false]
  ]

  let best = -Infinity
  for (const [field, weight, allowSubsequence] of fields) {
    const raw = fuzzyMatchScore(token, field, { allowSubsequence })
    if (raw === null) continue
    const weighted = raw * weight
    if (weighted > best) best = weighted
  }
  return best < 0 ? null : Math.round(best)
}

/**
 * Rank a tool against a multi-token query. Every token must match somewhere
 * (AND semantics). Higher score is better; returns null when unmatched.
 */
export function scoreTool(tool: ToolDefinition, query: string): number | null {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0

  let total = 0
  for (const token of tokens) {
    const s = scoreTokenAgainstTool(token, tool)
    if (s === null) return null
    total += s
  }
  return total
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(definition: ToolDefinition): void {
    assertValidDefinition(definition)
    if (this.tools.has(definition.id)) {
      throw new Error(`Tool with id "${definition.id}" is already registered.`)
    }
    this.tools.set(definition.id, definition)
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id)
  }

  /** All tools sorted by category order then name. */
  all(): ToolDefinition[] {
    const order = new Map(CATEGORIES.map((c, i) => [c.id as string, i]))
    return [...this.tools.values()].sort((a, b) => {
      const catDiff = (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99)
      if (catDiff !== 0) return catDiff
      return a.name.localeCompare(b.name)
    })
  }

  count(): number {
    return this.tools.size
  }

  byCategory(category: CategoryId): ToolDefinition[] {
    return this.all().filter((t) => t.category === category)
  }

  byTag(tag: string): ToolDefinition[] {
    const needle = tag.trim().toLowerCase()
    if (!needle) return []
    return this.all().filter((t) => t.tags.some((x) => x.toLowerCase() === needle))
  }

  allTags(): string[] {
    const set = new Set<string>()
    for (const tool of this.all()) for (const tag of tool.tags) set.add(tag.toLowerCase())
    return [...set].sort()
  }

  categoriesWithCounts(): Array<{ id: CategoryId; label: string; icon: string; count: number }> {
    return CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      icon: c.icon,
      count: this.byCategory(c.id).length
    }))
  }

  search(query: string): ToolSearchMatch[] {
    const trimmed = query.trim()
    if (!trimmed) return []
    const matches: ToolSearchMatch[] = []
    for (const tool of this.all()) {
      const score = scoreTool(tool, trimmed)
      if (score !== null && score > 0) matches.push({ tool, score })
    }
    matches.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    return matches
  }
}

function assertValidDefinition(def: ToolDefinition): void {
  if (!def || typeof def !== 'object') throw new Error('Tool definition must be an object.')
  for (const field of ['id', 'name', 'description', 'icon', 'version'] as const) {
    if (typeof def[field] !== 'string' || !def[field].trim()) {
      throw new Error(`Tool definition is missing required string field "${field}".`)
    }
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(def.id)) {
    throw new Error(`Tool id "${def.id}" must be kebab-case (lowercase letters, digits, dashes).`)
  }
  if (!CATEGORIES.some((c) => c.id === def.category)) {
    throw new Error(`Tool "${def.id}" has unknown category "${String(def.category)}".`)
  }
  if (!Array.isArray(def.tags)) {
    throw new Error(`Tool "${def.id}" tags must be an array.`)
  }
  if (!/^\d+\.\d+\.\d+$/.test(def.version)) {
    throw new Error(`Tool "${def.id}" version must be semver-like (e.g. "1.0.0").`)
  }
}

/** Application-wide registry singleton. */
export const toolRegistry = new ToolRegistry()
