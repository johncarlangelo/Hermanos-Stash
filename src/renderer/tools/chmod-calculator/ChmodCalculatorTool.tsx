import { useMemo, useState } from 'react'
import { Check, Copy, Key, Terminal } from 'lucide-react'
import { Panel } from '../../components/ui/Feedback'
import { toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  DEFAULT_CHMOD_STATE,
  getBinaryString,
  getOctalString,
  getPermissionExplanation,
  getSymbolicString,
  parseOctal,
  type ChmodState
} from './logic'

const PRESETS: { label: string; octal: string; desc: string }[] = [
  { label: '755', octal: '755', desc: 'Executable / Directory (rwxr-xr-x)' },
  { label: '644', octal: '644', desc: 'Standard File (rw-r--r--)' },
  { label: '600', octal: '600', desc: 'Private Key / SSH (rw-------)' },
  { label: '700', octal: '700', desc: 'Private Dir / Script (rwx------)' },
  { label: '400', octal: '400', desc: 'Read-Only Cert (r--------)' },
  { label: '777', octal: '777', desc: 'Full Public Access (rwxrwxrwx)' }
]

export default function ChmodCalculatorTool() {
  const [state, setState] = useState<ChmodState>(DEFAULT_CHMOD_STATE)
  const [isDir, setIsDir] = useState(false)
  const [targetPath, setTargetPath] = useState('script.sh')
  const [recursive, setRecursive] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const octal = useMemo(() => getOctalString(state), [state])
  const octalWithSpecial = useMemo(() => getOctalString(state, true), [state])
  const symbolic = useMemo(() => getSymbolicString(state, isDir), [state, isDir])
  const binary = useMemo(() => getBinaryString(state), [state])
  const explanations = useMemo(() => getPermissionExplanation(state), [state])

  const chmodCmdNumeric = `chmod ${recursive ? '-R ' : ''}${state.suid || state.sgid || state.sticky ? octalWithSpecial : octal} ${targetPath || 'file'}`
  const chmodCmdSymbolic = `chmod ${recursive ? '-R ' : ''}u=${(state.ownerRead ? 'r' : '') + (state.ownerWrite ? 'w' : '') + (state.ownerExecute ? 'x' : '') || '-'},g=${(state.groupRead ? 'r' : '') + (state.groupWrite ? 'w' : '') + (state.groupExecute ? 'x' : '') || '-'},o=${(state.othersRead ? 'r' : '') + (state.othersWrite ? 'w' : '') + (state.othersExecute ? 'x' : '') || '-'} ${targetPath || 'file'}`

  const handlePreset = (oct: string) => {
    const next = parseOctal(oct)
    if (next) {
      setState(next)
      toastSuccess(`Applied permission preset ${oct}`)
    }
  }

  const handleOctalInput = (val: string) => {
    const next = parseOctal(val)
    if (next) {
      setState(next)
    }
  }

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
    toastSuccess('Copied to clipboard')
    recordHistoryQuietly('chmod-calculator', 'Chmod Permission Calculator', 'developer')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px] text-ink overflow-hidden">
      {/* Header & Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Key size={18} className="text-accent" />
          <h2 className="font-semibold text-[14px]">Chmod / Unix Permission Calculator</h2>
          <span className="text-[11px] text-faint bg-base px-2 py-0.5 rounded border border-line">
            Octal · Symbolic · SUID
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11.5px] text-faint">Presets:</span>
          {PRESETS.map((p) => (
            <button
              key={p.octal}
              type="button"
              onClick={() => handlePreset(p.octal)}
              className={`px-2 py-0.5 rounded border text-[11px] font-mono transition-colors cursor-pointer ${
                octal === p.octal
                  ? 'border-accent bg-accent/15 text-accent font-bold'
                  : 'border-line bg-base/60 text-dim hover:text-ink hover:border-accent'
              }`}
              title={p.desc}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* Left Interactive Matrix */}
        <Panel className="lg:col-span-7 p-3.5 flex flex-col gap-3.5 overflow-y-auto">
          {/* Permission Matrix Table */}
          <div className="space-y-2">
            <span className="text-[11px] uppercase font-semibold text-faint block">
              Permission Matrix
            </span>

            <div className="rounded border border-line bg-base/60 overflow-hidden">
              <table className="w-full text-left text-[12px]">
                <thead className="border-b border-line bg-surface/50 text-[11px] text-faint uppercase">
                  <tr>
                    <th className="p-2.5">Target</th>
                    <th className="p-2.5 text-center">Read (4)</th>
                    <th className="p-2.5 text-center">Write (2)</th>
                    <th className="p-2.5 text-center">Execute (1)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {/* Owner */}
                  <tr className="hover:bg-base/40">
                    <td className="p-2.5 font-medium text-ink">
                      Owner <span className="text-faint text-[10.5px]">(User / u)</span>
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={state.ownerRead}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, ownerRead: e.target.checked }))
                        }
                        className="rounded border-line accent-accent h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={state.ownerWrite}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, ownerWrite: e.target.checked }))
                        }
                        className="rounded border-line accent-accent h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={state.ownerExecute}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, ownerExecute: e.target.checked }))
                        }
                        className="rounded border-line accent-accent h-4 w-4 cursor-pointer"
                      />
                    </td>
                  </tr>

                  {/* Group */}
                  <tr className="hover:bg-base/40">
                    <td className="p-2.5 font-medium text-ink">
                      Group <span className="text-faint text-[10.5px]">(g)</span>
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={state.groupRead}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, groupRead: e.target.checked }))
                        }
                        className="rounded border-line accent-accent h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={state.groupWrite}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, groupWrite: e.target.checked }))
                        }
                        className="rounded border-line accent-accent h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={state.groupExecute}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, groupExecute: e.target.checked }))
                        }
                        className="rounded border-line accent-accent h-4 w-4 cursor-pointer"
                      />
                    </td>
                  </tr>

                  {/* Others */}
                  <tr className="hover:bg-base/40">
                    <td className="p-2.5 font-medium text-ink">
                      Public <span className="text-faint text-[10.5px]">(Others / o)</span>
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={state.othersRead}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, othersRead: e.target.checked }))
                        }
                        className="rounded border-line accent-accent h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={state.othersWrite}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, othersWrite: e.target.checked }))
                        }
                        className="rounded border-line accent-accent h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={state.othersExecute}
                        onChange={(e) =>
                          setState((prev) => ({ ...prev, othersExecute: e.target.checked }))
                        }
                        className="rounded border-line accent-accent h-4 w-4 cursor-pointer"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Special Permissions / Flags */}
          <div className="space-y-2 border-t border-line/60 pt-3">
            <span className="text-[11px] uppercase font-semibold text-faint block">
              Special Permissions & Type
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11.5px]">
              <label className="flex items-center gap-2 p-2 rounded border border-line bg-base cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.suid}
                  onChange={(e) => setState((prev) => ({ ...prev, suid: e.target.checked }))}
                  className="rounded border-line accent-accent"
                />
                <span>Setuid (4000)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded border border-line bg-base cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.sgid}
                  onChange={(e) => setState((prev) => ({ ...prev, sgid: e.target.checked }))}
                  className="rounded border-line accent-accent"
                />
                <span>Setgid (2000)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded border border-line bg-base cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.sticky}
                  onChange={(e) => setState((prev) => ({ ...prev, sticky: e.target.checked }))}
                  className="rounded border-line accent-accent"
                />
                <span>Sticky (1000)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded border border-line bg-base cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDir}
                  onChange={(e) => setIsDir(e.target.checked)}
                  className="rounded border-line accent-accent"
                />
                <span>Directory (d)</span>
              </label>
            </div>
          </div>
        </Panel>

        {/* Right Outputs Panel */}
        <div className="lg:col-span-5 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Representation Cards */}
          <div className="grid grid-cols-3 gap-2">
            <Panel className="p-3 text-center space-y-1">
              <span className="text-[10.5px] uppercase font-semibold text-faint">Octal</span>
              <div className="text-[24px] font-mono font-bold text-accent">{octal}</div>
              <input
                type="text"
                maxLength={4}
                value={octal}
                onChange={(e) => handleOctalInput(e.target.value)}
                className="w-14 mx-auto text-center rounded border border-line bg-base py-0.5 text-[11px] font-mono text-ink outline-none"
              />
            </Panel>

            <Panel className="p-3 text-center space-y-1">
              <span className="text-[10.5px] uppercase font-semibold text-faint">Symbolic</span>
              <div className="text-[16px] font-mono font-bold text-ink pt-1.5">{symbolic}</div>
              <button
                type="button"
                onClick={() => handleCopy(symbolic, 'sym')}
                className="text-[10.5px] text-faint hover:text-ink cursor-pointer pt-1"
              >
                {copied === 'sym' ? 'Copied' : 'Copy'}
              </button>
            </Panel>

            <Panel className="p-3 text-center space-y-1">
              <span className="text-[10.5px] uppercase font-semibold text-faint">Binary</span>
              <div className="text-[11px] font-mono text-dim pt-2 leading-tight">{binary}</div>
            </Panel>
          </div>

          {/* Natural Language Explanation */}
          <Panel className="p-3 space-y-2">
            <span className="text-[11px] uppercase font-semibold text-faint block border-b border-line/60 pb-1">
              Permission Explanation
            </span>
            <div className="space-y-1 text-[11.5px]">
              {explanations.map((exp, i) => (
                <div key={i} className="flex items-center gap-1.5 text-dim">
                  <span className="text-accent">•</span>
                  <span>{exp}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Generated Shell Commands */}
          <Panel className="p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-line/60 pb-1.5">
              <div className="flex items-center gap-1.5 text-faint text-[11px] font-semibold uppercase">
                <Terminal size={13} className="text-accent" />
                <span>Command Line</span>
              </div>
              <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={recursive}
                  onChange={(e) => setRecursive(e.target.checked)}
                  className="rounded border-line accent-accent"
                />
                <span>-R (Recursive)</span>
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-[10.5px] text-faint block">Target Path / File</label>
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                placeholder="e.g. /var/www/html or app.sh"
                className="w-full rounded border border-line bg-base px-2.5 py-1 text-[11.5px] font-mono text-ink outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between gap-2 p-2 rounded border border-line bg-base font-mono text-[11.5px]">
                <span className="truncate text-ink">{chmodCmdNumeric}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(chmodCmdNumeric, 'num')}
                  className="text-accent hover:underline text-[11px] cursor-pointer shrink-0"
                >
                  {copied === 'num' ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 p-2 rounded border border-line bg-base font-mono text-[11px]">
                <span className="truncate text-dim">{chmodCmdSymbolic}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(chmodCmdSymbolic, 'sym_cmd')}
                  className="text-accent hover:underline text-[11px] cursor-pointer shrink-0"
                >
                  {copied === 'sym_cmd' ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
