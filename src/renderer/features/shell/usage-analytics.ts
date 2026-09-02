import type { HistoryEntry } from '../../../shared/ipc'
import { toolRegistry } from '../../../shared/tool-registry/registry'

export type TimeRange = '7d' | '30d' | '90d' | 'all'

export interface DashboardMetrics {
  total: number
  success: number
  failure: number
  successRate: number
  avgDuration: number
  uniqueTools: number
  totalFilesIn: number
  totalFilesOut: number
}

export interface TimelineDataPoint {
  date: string
  fullDate: string
  runs: number
  success: number
  failure: number
  avgDuration: number
}

export interface ToolUsageStat {
  toolId: string
  name: string
  category: string
  icon: string
  runs: number
  success: number
  failure: number
  successRate: number
  avgDuration: number
}

export interface CategoryStat {
  name: string
  label: string
  value: number
  percentage: number
  color: string
}

export const CATEGORY_COLORS: Record<string, string> = {
  files: '#f59e0b',
  documents: '#3b82f6',
  images: '#ec4899',
  video: '#8b5cf6',
  audio: '#06b6d4',
  text: '#10b981',
  developer: '#6366f1',
  future: '#a855f7',
  other: '#71717a'
}

/**
 * Filter activity entries by selected time range
 */
export function filterEntriesByTimeRange(
  entries: HistoryEntry[],
  range: TimeRange,
  nowMs = Date.now()
): HistoryEntry[] {
  if (range === 'all') return entries

  const daysMap: Record<Exclude<TimeRange, 'all'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90
  }

  const cutoff = nowMs - daysMap[range] * 24 * 60 * 60 * 1000
  return entries.filter((e) => e.timestampMs >= cutoff)
}

/**
 * Compute key dashboard summary statistics
 */
export function computeDashboardMetrics(entries: HistoryEntry[]): DashboardMetrics {
  const total = entries.length
  const success = entries.filter((e) => e.status === 'success').length
  const failure = entries.filter((e) => e.status === 'failure').length
  const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 100

  const totalDuration = entries.reduce((sum, e) => sum + (e.durationMs ?? 0), 0)
  const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0

  const uniqueTools = new Set(entries.map((e) => e.toolId)).size
  const totalFilesIn = entries.reduce((sum, e) => sum + (e.inputs?.length ?? 0), 0)
  const totalFilesOut = entries.reduce((sum, e) => sum + (e.outputs?.length ?? 0), 0)

  return {
    total,
    success,
    failure,
    successRate,
    avgDuration,
    uniqueTools,
    totalFilesIn,
    totalFilesOut
  }
}

/**
 * Aggregate timeline data points over time with continuous dates
 */
export function aggregateActivityTimeline(
  entries: HistoryEntry[],
  range: TimeRange,
  nowMs = Date.now()
): TimelineDataPoint[] {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 14

  // Group existing entries by YYYY-MM-DD
  const map = new Map<
    string,
    { runs: number; success: number; failure: number; totalDuration: number }
  >()

  for (const entry of entries) {
    const d = new Date(entry.timestampMs)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    if (!map.has(key)) {
      map.set(key, { runs: 0, success: 0, failure: 0, totalDuration: 0 })
    }
    const stat = map.get(key)!
    stat.runs++
    if (entry.status === 'success') stat.success++
    else stat.failure++
    stat.totalDuration += entry.durationMs ?? 0
  }

  // Generate complete continuous series up to today
  const result: TimelineDataPoint[] = []
  const startDate = new Date(nowMs - (days - 1) * 24 * 60 * 60 * 1000)

  for (let i = 0; i < days; i++) {
    const curr = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
    const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`
    const shortLabel = curr.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

    const existing = map.get(key)
    if (existing) {
      result.push({
        date: shortLabel,
        fullDate: key,
        runs: existing.runs,
        success: existing.success,
        failure: existing.failure,
        avgDuration: existing.runs ? Math.round(existing.totalDuration / existing.runs) : 0
      })
    } else {
      result.push({
        date: shortLabel,
        fullDate: key,
        runs: 0,
        success: 0,
        failure: 0,
        avgDuration: 0
      })
    }
  }

  return result
}

/**
 * Aggregate top tools by total volume
 */
export function aggregateTopTools(entries: HistoryEntry[], limit = 8): ToolUsageStat[] {
  const map = new Map<
    string,
    { runs: number; success: number; failure: number; totalDuration: number }
  >()

  for (const e of entries) {
    if (!map.has(e.toolId)) {
      map.set(e.toolId, { runs: 0, success: 0, failure: 0, totalDuration: 0 })
    }
    const s = map.get(e.toolId)!
    s.runs++
    if (e.status === 'success') s.success++
    else s.failure++
    s.totalDuration += e.durationMs ?? 0
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1].runs - a[1].runs)
    .slice(0, limit)
    .map(([toolId, stat]) => {
      const tool = toolRegistry.get(toolId)
      return {
        toolId,
        name: tool?.name ?? toolId,
        category: tool?.category ?? 'other',
        icon: tool?.icon ?? 'wrench',
        runs: stat.runs,
        success: stat.success,
        failure: stat.failure,
        successRate: stat.runs ? Math.round((stat.success / stat.runs) * 100) : 100,
        avgDuration: stat.runs ? Math.round(stat.totalDuration / stat.runs) : 0
      }
    })
}

/**
 * Aggregate category distribution
 */
export function aggregateCategoryBreakdown(entries: HistoryEntry[]): CategoryStat[] {
  const counts = new Map<string, number>()
  const total = entries.length || 1

  for (const e of entries) {
    const tool = toolRegistry.get(e.toolId)
    const cat = tool?.category ?? 'other'
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => {
      const percentage = Math.round((count / total) * 1000) / 10
      return {
        name,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        value: count,
        percentage,
        color: CATEGORY_COLORS[name] ?? CATEGORY_COLORS.other
      }
    })
}

/**
 * Format relative timestamp (e.g. "2m ago", "Just now", "Yesterday")
 */
export function formatRelativeTime(timestampMs: number, nowMs = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000))
  if (diffSec < 30) return 'Just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(timestampMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Export entries as CSV string
 */
export function exportActivityToCsv(entries: HistoryEntry[]): string {
  const headers = [
    'ID',
    'Tool ID',
    'Tool Name',
    'Operation',
    'Status',
    'Duration (ms)',
    'Timestamp (ISO)'
  ]
  const rows = entries.map((e) => {
    const tool = toolRegistry.get(e.toolId)
    return [
      e.id,
      `"${e.toolId}"`,
      `"${tool?.name ?? e.toolId}"`,
      `"${(e.operation || '').replace(/"/g, '""')}"`,
      e.status,
      e.durationMs ?? 0,
      `"${new Date(e.timestampMs).toISOString()}"`
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

/**
 * Export entries as formatted JSON string
 */
export function exportActivityToJson(entries: HistoryEntry[]): string {
  return JSON.stringify(entries, null, 2)
}
