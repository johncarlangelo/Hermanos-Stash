import { useMemo, useState } from 'react'
import { CheckCircle2, GitBranch, XCircle } from 'lucide-react'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import { bumpVersion, compareSemVer, parseSemVer, satisfiesRange, type BumpType } from './logic'

const SAMPLES = ['1.0.0', '1.4.2', '2.0.0-beta.1', '0.1.0']

export default function SemverCalculatorTool() {
  const [currentVersion, setCurrentVersion] = useState('1.4.2')
  const [testRange, setTestRange] = useState('^1.4.0')
  const [prereleaseTag, setPrereleaseTag] = useState('alpha')
  const [sortInput, setSortInput] = useState('1.10.0\n1.2.0\n2.0.0\n1.2.1-beta\n1.2.1')
  const [copied, setCopied] = useState<string | null>(null)

  const parsed = useMemo(() => parseSemVer(currentVersion), [currentVersion])

  const bumps = useMemo(() => {
    if (!parsed) return []
    const types: { id: BumpType; label: string; desc: string }[] = [
      { id: 'patch', label: 'Patch (Bug Fix)', desc: 'Backwards-compatible bug fixes' },
      { id: 'minor', label: 'Minor (New Feature)', desc: 'Backwards-compatible new features' },
      { id: 'major', label: 'Major (Breaking)', desc: 'Incompatible API changes' },
      { id: 'prepatch', label: 'Pre-patch', desc: 'Pre-release for upcoming patch' },
      { id: 'preminor', label: 'Pre-minor', desc: 'Pre-release for upcoming minor' },
      { id: 'premajor', label: 'Pre-major', desc: 'Pre-release for upcoming major' }
    ]

    return types.map((t) => ({
      ...t,
      nextVersion: bumpVersion(currentVersion, t.id, prereleaseTag) || ''
    }))
  }, [currentVersion, parsed, prereleaseTag])

  const rangeMatches = useMemo(() => {
    if (!parsed || !testRange.trim()) return false
    return satisfiesRange(currentVersion, testRange)
  }, [currentVersion, parsed, testRange])

  const sortedList = useMemo(() => {
    const lines = sortInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    return lines.sort((a, b) => compareSemVer(a, b))
  }, [sortInput])

  const handleCopy = async (val: string, id: string) => {
    await navigator.clipboard.writeText(val)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
    toastSuccess(`Copied ${val} to clipboard`)
    recordHistoryQuietly('semver-calculator', 'SemVer Calculator & Range Tester', 'developer')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <GitBranch size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">Semantic Versioning (SemVer) Calculator</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            SemVer 2.0.0
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] text-faint">Presets:</span>
          {SAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setCurrentVersion(s)}
              className="px-2 py-0.5 rounded border border-line bg-base/60 text-[11px] font-mono text-dim hover:text-ink cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left: Version Input & Bump Calculations */}
        <Panel className="lg:col-span-7 p-3.5 flex flex-col gap-3.5 overflow-y-auto">
          {/* Active Version Input */}
          <div className="space-y-2">
            <label className="text-[11px] uppercase font-semibold text-faint flex items-center justify-between">
              <span>Current Version</span>
              <span className="text-[10px] text-faint">Format: major.minor.patch[-prerelease]</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={currentVersion}
                onChange={(e) => setCurrentVersion(e.target.value)}
                placeholder="1.0.0"
                className="flex-1 rounded border border-line bg-base px-3 py-1.5 text-[14px] font-mono font-bold text-ink outline-none focus:border-accent"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-faint">Tag:</span>
                <input
                  type="text"
                  value={prereleaseTag}
                  onChange={(e) => setPrereleaseTag(e.target.value)}
                  placeholder="alpha"
                  className="w-16 rounded border border-line bg-base px-2 py-1.5 text-[12px] font-mono text-ink outline-none"
                />
              </div>
            </div>

            {/* Version Parts Breakdown */}
            {parsed && (
              <div className="grid grid-cols-4 gap-1.5 pt-1 text-[11px]">
                <div className="rounded border border-line bg-base/50 p-1.5 text-center">
                  <span className="text-faint text-[10px] block uppercase">Major</span>
                  <span className="font-mono font-bold text-ink">{parsed.major}</span>
                </div>
                <div className="rounded border border-line bg-base/50 p-1.5 text-center">
                  <span className="text-faint text-[10px] block uppercase">Minor</span>
                  <span className="font-mono font-bold text-ink">{parsed.minor}</span>
                </div>
                <div className="rounded border border-line bg-base/50 p-1.5 text-center">
                  <span className="text-faint text-[10px] block uppercase">Patch</span>
                  <span className="font-mono font-bold text-ink">{parsed.patch}</span>
                </div>
                <div className="rounded border border-line bg-base/50 p-1.5 text-center">
                  <span className="text-faint text-[10px] block uppercase">Pre-release</span>
                  <span className="font-mono text-ink truncate block">
                    {parsed.prerelease || 'None'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Version Bumps Grid */}
          <div className="space-y-2 border-t border-line/60 pt-3">
            <span className="text-[11px] uppercase font-semibold text-faint block">
              Calculate Next Releases
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {bumps.map((b) => (
                <div
                  key={b.id}
                  className="p-2.5 rounded border border-line bg-base/60 flex flex-col justify-between gap-1.5 group hover:border-accent/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-semibold text-ink">{b.label}</span>
                    <span className="text-[14px] font-mono font-bold text-accent">
                      {b.nextVersion}
                    </span>
                  </div>
                  <div className="text-[10px] text-faint">{b.desc}</div>

                  <div className="flex items-center justify-end gap-1 pt-1 border-t border-line/40">
                    <button
                      type="button"
                      onClick={() => handleCopy(b.nextVersion, b.id)}
                      className="px-2 py-0.5 rounded border border-line bg-base text-[10.5px] text-dim hover:text-ink cursor-pointer"
                    >
                      {copied === b.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentVersion(b.nextVersion)}
                      className="px-2 py-0.5 rounded border border-accent/40 bg-accent/10 text-[10.5px] text-accent font-medium hover:bg-accent/20 cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* Right: Range Evaluator & Batch Sorter */}
        <div className="lg:col-span-5 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Range Tester */}
          <Panel className="p-3.5 space-y-3">
            <span className="text-[11px] uppercase font-semibold text-faint block border-b border-line/60 pb-1.5">
              SemVer Range Matcher
            </span>

            <div className="space-y-1.5">
              <label className="text-[11px] text-faint">Range / Expression to Test</label>
              <input
                type="text"
                value={testRange}
                onChange={(e) => setTestRange(e.target.value)}
                placeholder="e.g. ^1.4.0, ~1.4.0, >=1.0.0 <2.0.0"
                className="w-full rounded border border-line bg-base px-2.5 py-1 text-[12px] font-mono text-ink outline-none focus:border-accent"
              />
            </div>

            <div
              className={`p-2.5 rounded border flex items-center justify-between transition-colors ${
                rangeMatches
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 text-[12px] font-medium">
                {rangeMatches ? (
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                ) : (
                  <XCircle size={16} className="text-rose-400 shrink-0" />
                )}
                <span>
                  Version <strong className="font-mono">{currentVersion}</strong>{' '}
                  {rangeMatches ? 'SATISFIES' : 'DOES NOT SATISFY'} {testRange}
                </span>
              </div>
            </div>

            <div className="text-[10.5px] text-faint space-y-0.5">
              <div>
                • <code>^1.4.0</code>: Allows non-breaking updates within major version
              </div>
              <div>
                • <code>~1.4.0</code>: Allows patch updates within minor version
              </div>
              <div>
                • <code>1.x</code>: Wildcard range covering all 1.x.x releases
              </div>
            </div>
          </Panel>

          {/* Version Sorter */}
          <Panel className="p-3.5 space-y-2 flex-1 flex flex-col min-h-[200px]">
            <span className="text-[11px] uppercase font-semibold text-faint block border-b border-line/60 pb-1">
              Multi-Version Sorter
            </span>

            <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-faint">Unordered Input:</span>
                <textarea
                  value={sortInput}
                  onChange={(e) => setSortInput(e.target.value)}
                  className="flex-1 w-full rounded border border-line bg-base p-1.5 font-mono text-[11px] text-ink outline-none resize-none select-all"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-faint">SemVer Sorted:</span>
                <pre className="flex-1 rounded border border-line bg-base/90 p-1.5 font-mono text-[11px] text-accent overflow-auto select-all leading-tight">
                  {sortedList.join('\n')}
                </pre>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
