import { describe, expect, it } from 'vitest'
import type { HistoryEntry } from '../../../shared/ipc'
import {
  aggregateActivityTimeline,
  aggregateCategoryBreakdown,
  aggregateTopTools,
  computeDashboardMetrics,
  exportActivityToCsv,
  exportActivityToJson,
  filterEntriesByTimeRange,
  formatRelativeTime
} from './usage-analytics'

describe('usage-analytics pure logic', () => {
  const mockNow = new Date('2026-09-02T12:00:00Z').getTime()

  const mockEntries: HistoryEntry[] = [
    {
      id: 1,
      toolId: 'svg-creator',
      operation: 'Export Vector (PNG)',
      inputs: ['512x512'],
      outputs: ['/path/to/icon.png'],
      status: 'success',
      durationMs: 45,
      timestampMs: mockNow - 1000 * 60 * 5 // 5 min ago
    },
    {
      id: 2,
      toolId: 'svg-creator',
      operation: 'Export Vector (SVG)',
      inputs: ['1024x1024'],
      outputs: ['/path/to/logo.svg'],
      status: 'success',
      durationMs: 15,
      timestampMs: mockNow - 1000 * 60 * 60 * 2 // 2 hours ago
    },
    {
      id: 3,
      toolId: 'image-to-ascii',
      operation: 'Convert Image to ASCII',
      inputs: ['/path/to/photo.jpg'],
      outputs: ['/path/to/photo.txt'],
      status: 'failure',
      durationMs: 120,
      timestampMs: mockNow - 1000 * 60 * 60 * 24 * 3 // 3 days ago
    },
    {
      id: 4,
      toolId: 'pdf-numberer',
      operation: 'Stamp Page Numbers',
      inputs: ['/path/to/doc.pdf'],
      outputs: ['/path/to/doc-numbered.pdf'],
      status: 'success',
      durationMs: 350,
      timestampMs: mockNow - 1000 * 60 * 60 * 24 * 15 // 15 days ago
    }
  ]

  it('filters entries correctly by time range', () => {
    const range7d = filterEntriesByTimeRange(mockEntries, '7d', mockNow)
    expect(range7d.length).toBe(3)

    const range30d = filterEntriesByTimeRange(mockEntries, '30d', mockNow)
    expect(range30d.length).toBe(4)

    const rangeAll = filterEntriesByTimeRange(mockEntries, 'all', mockNow)
    expect(rangeAll.length).toBe(4)
  })

  it('computes dashboard metrics accurately', () => {
    const metrics = computeDashboardMetrics(mockEntries)
    expect(metrics.total).toBe(4)
    expect(metrics.success).toBe(3)
    expect(metrics.failure).toBe(1)
    expect(metrics.successRate).toBe(75) // 3/4 = 75%
    expect(metrics.uniqueTools).toBe(3)
    expect(metrics.totalFilesIn).toBe(4)
    expect(metrics.totalFilesOut).toBe(4)
    expect(metrics.avgDuration).toBe(Math.round((45 + 15 + 120 + 350) / 4))
  })

  it('aggregates activity timeline with continuous dates', () => {
    const timeline = aggregateActivityTimeline(mockEntries, '7d', mockNow)
    expect(timeline.length).toBe(7)

    // Total runs in timeline should equal 7-day filtered count
    const totalRuns = timeline.reduce((sum, d) => sum + d.runs, 0)
    expect(totalRuns).toBe(3)
  })

  it('aggregates top tools ranked by runs', () => {
    const top = aggregateTopTools(mockEntries)
    expect(top.length).toBe(3)
    expect(top[0].toolId).toBe('svg-creator')
    expect(top[0].runs).toBe(2)
    expect(top[0].successRate).toBe(100)
  })

  it('aggregates category breakdown with percentages', () => {
    const categories = aggregateCategoryBreakdown(mockEntries)
    expect(categories.length).toBeGreaterThan(0)
    const sumPercent = categories.reduce((sum, c) => sum + c.percentage, 0)
    expect(Math.round(sumPercent)).toBe(100)
  })

  it('formats relative times correctly', () => {
    expect(formatRelativeTime(mockNow - 10 * 1000, mockNow)).toBe('Just now')
    expect(formatRelativeTime(mockNow - 45 * 1000, mockNow)).toBe('45s ago')
    expect(formatRelativeTime(mockNow - 5 * 60 * 1000, mockNow)).toBe('5m ago')
    expect(formatRelativeTime(mockNow - 3 * 3600 * 1000, mockNow)).toBe('3h ago')
    expect(formatRelativeTime(mockNow - 25 * 3600 * 1000, mockNow)).toBe('Yesterday')
    expect(formatRelativeTime(mockNow - 4 * 86400 * 1000, mockNow)).toBe('4d ago')
  })

  it('exports activity to CSV and JSON formats', () => {
    const csv = exportActivityToCsv(mockEntries)
    expect(csv).toContain('ID,Tool ID,Tool Name,Operation,Status')
    expect(csv).toContain('svg-creator')
    expect(csv).toContain('Export Vector (PNG)')

    const json = exportActivityToJson(mockEntries)
    const parsed = JSON.parse(json)
    expect(parsed.length).toBe(4)
    expect(parsed[0].toolId).toBe('svg-creator')
  })
})
