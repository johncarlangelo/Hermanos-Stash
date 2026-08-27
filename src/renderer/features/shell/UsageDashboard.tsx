import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  XAxis,
  YAxis
} from 'recharts'
import {
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Download,
  Upload
} from 'lucide-react'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { getIcon } from '../../components/icons'
import { Button } from '../../components/ui/Button'
import { Panel, SectionHeading, EmptyState } from '../../components/ui/Feedback'
import { Select } from '../../components/ui/Inputs'

type TimeRange = '7d' | '30d' | '90d' | 'all'

interface ActivityEntry {
  id: number
  toolId: string
  operation: string
  inputs: string[]
  outputs: string[]
  status: 'success' | 'failure'
  durationMs?: number
  timestampMs: number
}

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  trend?: string
  trendUp?: boolean
}

function MetricCard({ icon, label, value, trend, trendUp }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line bg-surface/70 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-faint uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-[24px] font-semibold text-ink tnum">{value}</span>
        {trend && (
          <span className={`tnum text-[11px] ${trendUp ? 'text-ok' : 'text-danger'}`}>
            {trendUp ? '▲' : '▼'} {trend}
          </span>
        )}
      </div>
    </div>
  )
}

function TimeRangeSelector({
  value,
  onChange
}: {
  value: TimeRange
  onChange: (v: TimeRange) => void
}) {
  return (
    <Select
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as TimeRange)}
      className="w-[160px]"
    >
      <option value="7d">Last 7 days</option>
      <option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option>
      <option value="all">All time</option>
    </Select>
  )
}

function BarChartComponent({
  data,
  color
}: {
  data: { name: string; value: number }[]
  color: string
}) {
  if (data.length === 0)
    return <div className="h-48 flex items-center justify-center text-faint">No data</div>
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} interval={0} />
        <Tooltip
          formatter={(value: unknown) => [
            typeof value === 'number' ? `${value.toLocaleString()} runs` : String(value ?? ''),
            'Runs'
          ]}
        />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} maxBarSize={30}>
          {data.map((_, i) => (
            <Cell key={`cell-${i}`} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function PieChartComponent({
  data,
  colors
}: {
  data: { name: string; value: number }[]
  colors: string[]
}) {
  if (data.length === 0)
    return <div className="h-48 flex items-center justify-center text-faint">No data</div>
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }: { name?: string; percent?: number }) =>
            `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: unknown) => [
            typeof value === 'number' ? `${value.toLocaleString()} runs` : String(value ?? ''),
            'Runs'
          ]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

function ToolDrillDown({ toolId, entries }: { toolId: string; entries: ActivityEntry[] }) {
  const tool = toolRegistry.get(toolId)
  if (!tool) return null

  const successCount = entries.filter((e) => e.status === 'success').length
  const failureCount = entries.filter((e) => e.status === 'failure').length
  const avgDuration = entries.length
    ? Math.round(entries.reduce((sum, e) => sum + (e.durationMs ?? 0), 0) / entries.length)
    : 0

  const Icon = getIcon(tool.icon)

  return (
    <Panel className="mt-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={18} strokeWidth={1.6} className="text-accent" aria-hidden />
        <span className="text-[14px] font-medium text-ink">{tool.name}</span>
        <span className="font-mono text-[9.5px] tracking-wide text-faint uppercase">
          {tool.category}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center mb-3">
        <div className="rounded-sm border border-line bg-base/50 p-2">
          <div className="tnum text-[18px] font-semibold text-ok">{successCount}</div>
          <div className="text-[10px] text-faint uppercase">Success</div>
        </div>
        <div className="rounded-sm border border-line bg-base/50 p-2">
          <div className="tnum text-[18px] font-semibold text-danger">{failureCount}</div>
          <div className="text-[10px] text-faint uppercase">Failed</div>
        </div>
        <div className="rounded-sm border border-line bg-base/50 p-2">
          <div className="tnum text-[18px] font-semibold text-ink">{avgDuration}ms</div>
          <div className="text-[10px] text-faint uppercase">Avg Duration</div>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {entries.slice(-20).map((entry) => (
          <div
            key={entry.id}
            className={`flex items-center justify-between gap-2 rounded-sm border border-line bg-surface/70 px-2 py-1.5 ${
              entry.status === 'failure' ? 'bg-danger/5' : ''
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`tnum shrink-0 ${entry.status === 'failure' ? 'text-danger' : 'text-ok'}`}
              >
                {entry.status === 'failure' ? '✕' : '✓'}
              </span>
              <span className="truncate text-[11px] text-ink">{entry.operation}</span>
              <span className="tnum shrink-0 font-mono text-[10px] text-faint">
                {entry.durationMs ? `${entry.durationMs}ms` : '—'}
              </span>
            </div>
            <span className="tnum shrink-0 font-mono text-[10px] text-faint">
              {new Date(entry.timestampMs).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function UsageDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null)
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)

  // Load activity from main process
  useEffect(() => {
    const load = async () => {
      try {
        const data = await window.stash.history.list(1000)
        setEntries(data)
      } catch {
        setEntries([])
      }
    }
    load()
  }, [])

  // Filter by time range
  const filteredEntries = useMemo(() => {
    if (!entries) return []
    const now = Date.now()
    const msMap: Record<TimeRange, number> = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      all: Infinity
    }
    const cutoff = now - msMap[timeRange]
    return entries.filter((e) => e.timestampMs >= cutoff)
  }, [entries, timeRange])

  // Metrics
  const metrics = useMemo(() => {
    const total = filteredEntries.length
    const success = filteredEntries.filter((e) => e.status === 'success').length
    const failure = filteredEntries.filter((e) => e.status === 'failure').length
    const totalDuration = filteredEntries.reduce((sum, e) => sum + (e.durationMs ?? 0), 0)
    const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0
    const uniqueTools = new Set(filteredEntries.map((e) => e.toolId)).size
    const totalFilesIn = filteredEntries.reduce((sum, e) => sum + e.inputs.length, 0)
    const totalFilesOut = filteredEntries.reduce((sum, e) => sum + e.outputs.length, 0)

    return { total, success, failure, avgDuration, uniqueTools, totalFilesIn, totalFilesOut }
  }, [filteredEntries])

  // Top tools
  const topTools = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of filteredEntries) {
      counts.set(e.toolId, (counts.get(e.toolId) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([toolId, count]) => ({
        name: toolRegistry.get(toolId)?.name ?? toolId,
        value: count
      }))
  }, [filteredEntries])

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    const categoryColors: Record<string, string> = {
      files: '#f59e0b',
      documents: '#3b82f6',
      images: '#ec4899',
      video: '#8b5cf6',
      audio: '#06b6d4',
      text: '#10b981',
      developer: '#6366f1',
      future: '#a855f7'
    }
    for (const e of filteredEntries) {
      const tool = toolRegistry.get(e.toolId)
      const cat = tool?.category ?? 'other'
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value]) => ({
      name,
      value,
      color: categoryColors[name] ?? '#6b7280'
    }))
  }, [filteredEntries])

  // Status breakdown
  const statusBreakdown = useMemo(
    () => ({
      success: metrics.success,
      failure: metrics.failure
    }),
    [metrics]
  )

  // Tool entries for drill-down
  const toolEntries = useMemo(() => {
    const map = new Map<string, ActivityEntry[]>()
    for (const e of filteredEntries) {
      if (!map.has(e.toolId)) map.set(e.toolId, [])
      map.get(e.toolId)!.push(e)
    }
    return map
  }, [filteredEntries])

  if (!entries) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2">
          <span className="animate-spin">⟳</span>
          <span className="text-faint">Loading activity...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <SectionHeading>Usage Dashboard</SectionHeading>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Metric cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <MetricCard
          icon={<TrendingUp size={18} className="text-accent" />}
          label="Total Runs"
          value={metrics.total.toLocaleString()}
        />
        <MetricCard
          icon={<CheckCircle size={18} className="text-ok" />}
          label="Successful"
          value={metrics.success.toLocaleString()}
          trend={`${metrics.total ? Math.round((metrics.success / metrics.total) * 100) : 0}%`}
          trendUp={true}
        />
        <MetricCard
          icon={<AlertCircle size={18} className="text-danger" />}
          label="Failed"
          value={metrics.failure.toLocaleString()}
        />
        <MetricCard
          icon={<Clock size={18} className="text-ink" />}
          label="Avg Duration"
          value={`${metrics.avgDuration}ms`}
        />
        <MetricCard
          icon={<FileText size={18} className="text-ink" />}
          label="Unique Tools"
          value={metrics.uniqueTools}
        />
        <MetricCard
          icon={<Download size={18} className="text-ink" />}
          label="Files In"
          value={metrics.totalFilesIn.toLocaleString()}
        />
        <MetricCard
          icon={<Upload size={18} className="text-ink" />}
          label="Files Out"
          value={metrics.totalFilesOut.toLocaleString()}
        />
      </div>

      {/* Charts row */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel className="space-y-3">
          <SectionHeading>Top Tools</SectionHeading>
          <BarChartComponent data={topTools} color="var(--color-accent)" />
        </Panel>
        <Panel className="space-y-3">
          <SectionHeading>Categories</SectionHeading>
          <PieChartComponent
            data={categoryBreakdown}
            colors={categoryBreakdown.map((c) => c.color)}
          />
        </Panel>
      </div>

      {/* Second charts row */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel className="space-y-3">
          <SectionHeading>Status</SectionHeading>
          <PieChartComponent
            data={[
              { name: 'Success', value: statusBreakdown.success },
              { name: 'Failed', value: statusBreakdown.failure }
            ]}
            colors={['var(--color-ok)', 'var(--color-danger)']}
          />
        </Panel>
        <Panel className="space-y-3">
          <SectionHeading>Activity Timeline</SectionHeading>
          <div className="h-48 flex items-center justify-center text-faint">
            Timeline chart (TODO: add recharts LineChart)
          </div>
        </Panel>
      </div>

      {/* Tool drill-down */}
      {selectedToolId && (
        <ToolDrillDown toolId={selectedToolId} entries={toolEntries.get(selectedToolId) ?? []} />
      )}

      {/* All tools table */}
      <Panel className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <SectionHeading>All Tool Activity</SectionHeading>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-faint">Filter:</label>
            <Select
              value={selectedToolId ?? ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSelectedToolId(e.target.value || null)
              }
              className="w-[200px]"
            >
              <option value="">All tools</option>
              {Array.from(toolEntries.entries())
                .sort((a, b) => b[1].length - a[1].length)
                .map(([toolId, entries]) => {
                  const tool = toolRegistry.get(toolId)
                  return (
                    <option key={toolId} value={toolId}>
                      {tool?.name ?? toolId} ({entries.length})
                    </option>
                  )
                })}
            </Select>
            {selectedToolId && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedToolId(null)}>
                Clear filter
              </Button>
            )}
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <EmptyState
            icon="search"
            title="No activity in this range."
            hint="Try a different time range or run some tools."
          />
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {filteredEntries.slice(0, 50).map((entry) => {
              const tool = toolRegistry.get(entry.toolId)
              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between gap-2 rounded-sm border border-line bg-surface/70 px-2.5 py-1.5 ${
                    entry.status === 'failure' ? 'bg-danger/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`tnum shrink-0 ${entry.status === 'failure' ? 'text-danger' : 'text-ok'}`}
                    >
                      {entry.status === 'failure' ? '✕' : '✓'}
                    </span>
                    <span className="truncate text-[11px] text-ink">{entry.operation}</span>
                    <span className="tnum shrink-0 font-mono text-[10px] text-faint">
                      {entry.durationMs ? `${entry.durationMs}ms` : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {tool && (
                      <span className="font-mono text-[9.5px] tracking-wide text-faint uppercase shrink-0">
                        {tool.category}
                      </span>
                    )}
                    <span className="tnum shrink-0 font-mono text-[10px] text-faint">
                      {new Date(entry.timestampMs).toLocaleString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedToolId(entry.toolId)}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </div>
  )
}

export default UsageDashboard
