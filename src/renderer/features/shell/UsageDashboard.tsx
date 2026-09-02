import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  Activity,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileStack,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  XCircle,
  Zap
} from 'lucide-react'
import type { HistoryEntry } from '../../../shared/ipc'
import { toolRegistry } from '../../../shared/tool-registry/registry'
import { getIcon } from '../../components/icons'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../../components/ui/dialog'
import { EmptyState } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'
import { useNav } from '../../stores/nav'
import {
  CATEGORY_COLORS,
  aggregateActivityTimeline,
  aggregateCategoryBreakdown,
  aggregateTopTools,
  computeDashboardMetrics,
  exportActivityToCsv,
  exportActivityToJson,
  filterEntriesByTimeRange,
  formatRelativeTime,
  type TimeRange
} from './usage-analytics'

// Custom Shadcn Recharts Tooltip
function ChartTooltipWrapper({
  active,
  payload,
  label
}: {
  active?: boolean
  payload?: Array<{
    name?: string
    value?: number
    color?: string
    payload?: Record<string, unknown>
  }>
  label?: string
}) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-line/80 bg-surface/95 px-3 py-2 text-xs shadow-2xl backdrop-blur-md">
        <p className="font-medium text-ink">{label}</p>
        <div className="mt-1 space-y-1">
          {payload.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: item.color || 'var(--color-accent)' }}
              />
              <span className="text-dim">{item.name || 'Count'}:</span>
              <span className="font-mono font-semibold text-ink">
                {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export function UsageDashboard() {
  const openTool = useNav((s) => s.openTool)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Load activity logs from local SQLite
  const loadActivity = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.stash.history.list(1000)
      setEntries(data)
    } catch (err) {
      setEntries([])
      toastError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadActivity()
  }, [loadActivity])

  // Filter entries based on time range
  const timeFilteredEntries = useMemo(() => {
    if (!entries) return []
    return filterEntriesByTimeRange(entries, timeRange)
  }, [entries, timeRange])

  // Aggregated metrics
  const metrics = useMemo(() => {
    return computeDashboardMetrics(timeFilteredEntries)
  }, [timeFilteredEntries])

  // Continuous timeline data points
  const timelineData = useMemo(() => {
    return aggregateActivityTimeline(timeFilteredEntries, timeRange)
  }, [timeFilteredEntries, timeRange])

  // Top tools ranking
  const topTools = useMemo(() => {
    return aggregateTopTools(timeFilteredEntries, 7)
  }, [timeFilteredEntries])

  // Category distribution
  const categoryBreakdown = useMemo(() => {
    return aggregateCategoryBreakdown(timeFilteredEntries)
  }, [timeFilteredEntries])

  // Filtered entries for the activity log table
  const tableEntries = useMemo(() => {
    return timeFilteredEntries.filter((entry) => {
      const tool = toolRegistry.get(entry.toolId)
      const matchesSearch =
        !searchQuery ||
        entry.operation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tool?.name && tool.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        entry.toolId.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || entry.status === statusFilter
      const matchesCat = categoryFilter === 'all' || tool?.category === categoryFilter

      return matchesSearch && matchesStatus && matchesCat
    })
  }, [timeFilteredEntries, searchQuery, statusFilter, categoryFilter])

  // Selected tool details for the modal
  const selectedToolStats = useMemo(() => {
    if (!selectedToolId) return null
    const tool = toolRegistry.get(selectedToolId)
    const toolSpecificEntries = timeFilteredEntries.filter((e) => e.toolId === selectedToolId)
    const toolMetrics = computeDashboardMetrics(toolSpecificEntries)

    return {
      tool,
      metrics: toolMetrics,
      entries: toolSpecificEntries
    }
  }, [selectedToolId, timeFilteredEntries])

  // Export handlers
  const handleExportCsv = () => {
    if (!timeFilteredEntries.length) return
    const csv = exportActivityToCsv(timeFilteredEntries)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stash-activity-${timeRange}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess('Exported activity telemetry as CSV')
  }

  const handleExportJson = () => {
    if (!timeFilteredEntries.length) return
    const json = exportActivityToJson(timeFilteredEntries)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stash-activity-${timeRange}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toastSuccess('Exported activity telemetry as JSON')
  }

  return (
    <div className="mx-auto w-full max-w-6xl 2xl:max-w-7xl px-6 sm:px-8 py-8 space-y-7">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-raised/80 shadow-[0_0_24px_-8px_var(--color-accent-glow)]">
            <BarChart3 size={22} className="text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                Analytics & Insights
              </h1>
              <Badge
                variant="outline"
                className="border-accent/40 text-accent font-mono text-[10px]"
              >
                LOCAL TELEMETRY
              </Badge>
            </div>
            <p className="text-[13px] text-dim mt-0.5">
              Zero-cloud execution telemetry, tool activity trends, and system throughput.
            </p>
          </div>
        </div>

        {/* Time Range Pill Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center rounded-lg border border-line bg-surface/80 p-0.5 backdrop-blur-sm">
            {(['7d', '30d', '90d', 'all'] as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  timeRange === r
                    ? 'bg-accent text-base shadow-sm font-semibold'
                    : 'text-dim hover:text-ink hover:bg-raised/50'
                }`}
              >
                {r === '7d'
                  ? '7 Days'
                  : r === '30d'
                    ? '30 Days'
                    : r === '90d'
                      ? '90 Days'
                      : 'All Time'}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadActivity}
            disabled={loading}
            className="gap-1.5 cursor-pointer text-xs"
            title="Refresh statistics"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden md:inline">Refresh</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={!timeFilteredEntries.length}
            className="gap-1.5 cursor-pointer text-xs"
            title="Export telemetry CSV"
          >
            <Download size={13} />
            <span className="hidden md:inline">CSV</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportJson}
            disabled={!timeFilteredEntries.length}
            className="gap-1.5 cursor-pointer text-xs"
            title="Export telemetry JSON"
          >
            <Download size={13} />
            <span className="hidden md:inline">JSON</span>
          </Button>
        </div>
      </div>

      {/* 4 Main Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Operations */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md transition-all hover:border-accent/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-dim uppercase tracking-wider">
              Total Operations
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
              <Activity size={16} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-ink font-mono">
              {metrics.total.toLocaleString()}
            </div>
            <p className="text-xs text-faint mt-1 flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent shrink-0" />
              <span>{metrics.uniqueTools} distinct tools utilized</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Success Rate */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md transition-all hover:border-accent/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-dim uppercase tracking-wider">
              Success Rate
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-ok/10 text-ok">
              <CheckCircle2 size={16} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-ink font-mono">
              {metrics.successRate}%
            </div>
            <p className="text-xs text-faint mt-1 flex items-center gap-1.5">
              <span className="text-ok font-medium">{metrics.success.toLocaleString()} ok</span>
              <span>·</span>
              <span className={metrics.failure > 0 ? 'text-danger font-medium' : 'text-faint'}>
                {metrics.failure} failed
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Files I/O Throughput */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md transition-all hover:border-accent/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-dim uppercase tracking-wider">
              Files Processed
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
              <FileStack size={16} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-ink font-mono">
              {(metrics.totalFilesIn + metrics.totalFilesOut).toLocaleString()}
            </div>
            <p className="text-xs text-faint mt-1 flex items-center gap-1.5">
              <ArrowUpDown size={12} className="text-dim shrink-0" />
              <span>
                {metrics.totalFilesIn} in → {metrics.totalFilesOut} out
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Avg Execution Latency */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md transition-all hover:border-accent/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-dim uppercase tracking-wider">
              Avg Latency
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-500/10 text-purple-400">
              <Zap size={16} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-ink font-mono">
              {metrics.avgDuration} <span className="text-sm font-normal text-dim">ms</span>
            </div>
            <p className="text-xs text-faint mt-1 flex items-center gap-1.5">
              <Clock size={12} className="text-dim shrink-0" />
              <span>Zero-latency local processing</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Activity Timeline Area Chart */}
      <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base font-semibold text-ink flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              Execution Activity Timeline
            </CardTitle>
            <CardDescription className="text-xs text-dim mt-0.5">
              Daily operation volume across all local utilities over the selected period.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs text-dim">
            {metrics.total} Operations Total
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="var(--color-faint)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-line)' }}
                />
                <YAxis
                  stroke="var(--color-faint)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-line)' }}
                  allowDecimals={false}
                />
                <RechartsTooltip content={<ChartTooltipWrapper />} />
                <Area
                  type="monotone"
                  dataKey="runs"
                  name="Operations"
                  stroke="var(--color-accent)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#activityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Two Grid Cards: Top Tools & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Tools Bar Chart (7 Cols) */}
        <Card className="lg:col-span-7 border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-ink">Most Utilized Tools</CardTitle>
            <CardDescription className="text-xs text-dim">
              Ranked by execution volume. Click any tool to inspect detailed breakdown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {topTools.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-sm text-faint">
                No tool activity recorded yet.
              </div>
            ) : (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topTools}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <XAxis
                      type="number"
                      stroke="var(--color-faint)"
                      fontSize={11}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--color-dim)"
                      fontSize={11}
                      width={130}
                      interval={0}
                      tickFormatter={(val: string) =>
                        val.length > 16 ? `${val.slice(0, 16)}…` : val
                      }
                    />
                    <RechartsTooltip content={<ChartTooltipWrapper />} />
                    <Bar
                      dataKey="runs"
                      name="Executions"
                      fill="var(--color-accent)"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={22}
                      className="cursor-pointer transition-opacity hover:opacity-85"
                      onClick={(data: unknown) => {
                        const stat = data as { toolId?: string }
                        if (stat?.toolId) setSelectedToolId(stat.toolId)
                      }}
                    >
                      {topTools.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={CATEGORY_COLORS[entry.category] || 'var(--color-accent)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Share Donut Chart (5 Cols) */}
        <Card className="lg:col-span-5 border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-ink">Domain Share</CardTitle>
            <CardDescription className="text-xs text-dim">
              Distribution of operations by tool category.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-sm text-faint">
                No category data available.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-60">
                <div className="h-44 w-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryBreakdown.map((entry, idx) => (
                          <Cell
                            key={`pie-cell-${idx}`}
                            fill={entry.color}
                            stroke="var(--color-base)"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<ChartTooltipWrapper />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Category Legend List */}
                <div className="flex-1 w-full space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {categoryBreakdown.map((cat) => (
                    <div
                      key={cat.name}
                      className="flex items-center justify-between text-xs py-0.5 border-b border-line/40 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-dim capitalize">{cat.label}</span>
                      </div>
                      <span className="font-mono text-faint">{cat.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Activity Log Table */}
      <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4">
          <div>
            <CardTitle className="text-base font-semibold text-ink flex items-center gap-2">
              <Clock size={16} className="text-accent" />
              Activity Telemetry Log
            </CardTitle>
            <CardDescription className="text-xs text-dim mt-0.5">
              Detailed audit trail of all recent operations executed locally.
            </CardDescription>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search operations..."
                className="w-44 rounded-md border border-line bg-base/80 pl-8 pr-3 py-1 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
            </div>

            {/* Status Pills */}
            <div className="flex items-center rounded-md border border-line bg-base/80 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`cursor-pointer px-2 py-0.5 rounded text-[11px] ${
                  statusFilter === 'all'
                    ? 'bg-raised text-ink font-medium shadow-xs'
                    : 'text-faint hover:text-dim'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('success')}
                className={`cursor-pointer px-2 py-0.5 rounded text-[11px] ${
                  statusFilter === 'success'
                    ? 'bg-ok/20 text-ok font-medium shadow-xs'
                    : 'text-faint hover:text-dim'
                }`}
              >
                Success
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('failure')}
                className={`cursor-pointer px-2 py-0.5 rounded text-[11px] ${
                  statusFilter === 'failure'
                    ? 'bg-danger/20 text-danger font-medium shadow-xs'
                    : 'text-faint hover:text-dim'
                }`}
              >
                Failed
              </button>
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-md border border-line bg-base/80 px-2 py-1 text-xs text-dim focus:border-accent focus:outline-none"
            >
              <option value="all">All Categories</option>
              {Object.keys(CATEGORY_COLORS)
                .filter((c) => c !== 'other')
                .map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
            </select>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {tableEntries.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon="search"
                title="No matching telemetry entries"
                hint="Try adjusting your search query, status filters, or time range."
              />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {tableEntries.slice(0, 100).map((entry) => {
                const tool = toolRegistry.get(entry.toolId)
                const Icon = getIcon(tool?.icon ?? 'wrench')
                const isFailure = entry.status === 'failure'

                return (
                  <div
                    key={entry.id}
                    className={`group flex items-center justify-between gap-3 rounded-lg border border-line/60 bg-surface/50 px-3.5 py-2.5 transition-all hover:bg-surface hover:border-line ${
                      isFailure ? 'border-danger/20 bg-danger/5 hover:border-danger/30' : ''
                    }`}
                  >
                    {/* Left: Tool Icon + Name + Operation */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line/80 bg-raised/80 group-hover:border-accent/40"
                        title={tool?.name ?? entry.toolId}
                      >
                        <Icon size={15} className="text-accent shrink-0" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            onClick={() => setSelectedToolId(entry.toolId)}
                            className="truncate text-xs font-semibold text-ink cursor-pointer hover:underline"
                          >
                            {tool?.name ?? entry.toolId}
                          </span>
                          {tool && (
                            <span className="rounded bg-base px-1.5 py-0.2 font-mono text-[9px] uppercase tracking-wider text-faint border border-line/50">
                              {tool.category}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11.5px] text-dim">
                          {entry.operation || 'Execution'}
                        </p>
                      </div>
                    </div>

                    {/* Right: Status Pill + Duration + Time + Inspect Button */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                          isFailure ? 'bg-danger/15 text-danger' : 'bg-ok/15 text-ok'
                        }`}
                      >
                        {isFailure ? <XCircle size={11} /> : <CheckCircle2 size={11} />}
                        {isFailure ? 'Failed' : 'Success'}
                      </span>

                      {/* Duration */}
                      <span className="hidden sm:inline font-mono text-xs text-faint">
                        {entry.durationMs ? `${entry.durationMs}ms` : '—'}
                      </span>

                      {/* Relative Time */}
                      <span
                        className="font-mono text-xs text-dim"
                        title={new Date(entry.timestampMs).toLocaleString()}
                      >
                        {formatRelativeTime(entry.timestampMs)}
                      </span>

                      {/* Details / Drilldown Button */}
                      <button
                        type="button"
                        onClick={() => setSelectedToolId(entry.toolId)}
                        className="cursor-pointer rounded border border-line/70 bg-base/60 px-2 py-1 text-[11px] font-medium text-dim hover:text-ink hover:border-accent transition-colors"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tool Drilldown Modal Inspector */}
      {selectedToolStats && selectedToolStats.tool && (
        <Dialog
          open={Boolean(selectedToolId)}
          onOpenChange={(open) => !open && setSelectedToolId(null)}
        >
          <DialogContent className="max-w-xl border-line bg-surface text-ink">
            <DialogHeader>
              <div className="flex items-center gap-3">
                {(() => {
                  const ToolIcon = getIcon(selectedToolStats.tool?.icon ?? 'wrench')
                  return (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-raised">
                      <ToolIcon size={18} className="text-accent" />
                    </div>
                  )
                })()}
                <div>
                  <DialogTitle className="text-lg font-semibold text-ink flex items-center gap-2">
                    {selectedToolStats.tool.name}
                    {selectedToolStats.tool.isBeta && (
                      <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-amber-400">
                        BETA
                      </span>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-dim">
                    {selectedToolStats.tool.description}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Quick Metrics Matrix */}
            <div className="grid grid-cols-3 gap-3 my-3 text-center">
              <div className="rounded-lg border border-line bg-base/60 p-3">
                <div className="text-xl font-bold font-mono text-ink">
                  {selectedToolStats.metrics.total}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-faint mt-0.5">
                  Total Runs
                </div>
              </div>
              <div className="rounded-lg border border-line bg-base/60 p-3">
                <div className="text-xl font-bold font-mono text-ok">
                  {selectedToolStats.metrics.successRate}%
                </div>
                <div className="text-[10px] uppercase tracking-wider text-faint mt-0.5">
                  Success Rate
                </div>
              </div>
              <div className="rounded-lg border border-line bg-base/60 p-3">
                <div className="text-xl font-bold font-mono text-ink">
                  {selectedToolStats.metrics.avgDuration} <span className="text-xs">ms</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-faint mt-0.5">
                  Avg Latency
                </div>
              </div>
            </div>

            {/* Recent Executions List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-dim uppercase tracking-wider">
                Recent Executions
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {selectedToolStats.entries.slice(0, 20).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between text-xs rounded border border-line/60 bg-base/40 px-2.5 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={entry.status === 'failure' ? 'text-danger' : 'text-ok'}>
                        {entry.status === 'failure' ? '✕' : '✓'}
                      </span>
                      <span className="truncate text-ink">{entry.operation}</span>
                    </div>
                    <span className="font-mono text-faint shrink-0">
                      {formatRelativeTime(entry.timestampMs)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-line">
              <Button variant="ghost" size="sm" onClick={() => setSelectedToolId(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (selectedToolStats.tool) {
                    openTool(selectedToolStats.tool.id)
                  }
                }}
                className="gap-1.5"
              >
                <ExternalLink size={13} />
                Open Tool Workspace
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default UsageDashboard
