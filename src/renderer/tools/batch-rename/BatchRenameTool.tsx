import { useEffect, useMemo, useRef, useState } from 'react'
import { FolderInput, PencilLine } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { FieldRow, Input, Select, Toggle } from '../../components/ui/Inputs'
import { normalizeError, type StashError } from '../../../shared/errors'
import type { BatchRenameResult, DirEntry, ListDirResult } from '../../../shared/ipc'
import {
  buildRenamePlan,
  type CaseMode,
  type NumberingMode,
  type RenameRules
} from '../../../shared/utils/rename-rules'
import { toastError, toastSuccess } from '../../stores/toasts'
import { RevealButton } from '../shared/result-actions'
import { fileNameOf } from '../shared/use-file-list'
import { recordHistoryQuietly } from '../shared/use-progress-event'

const NUMBERING_OPTIONS: Array<{ value: NumberingMode; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'prefix-sep', label: 'Before name' },
  { value: 'suffix-sep', label: 'After name' }
]

const CASE_OPTIONS: Array<{ value: CaseMode; label: string }> = [
  { value: 'none', label: 'No change' },
  { value: 'lower', label: 'lowercase' },
  { value: 'upper', label: 'UPPERCASE' },
  { value: 'title', label: 'Title Case' }
]

export default function BatchRenameTool() {
  const [dir, setDir] = useState<string | null>(null)
  const [entries, setEntries] = useState<DirEntry[] | null>(null)
  const [loadingDir, setLoadingDir] = useState(false)

  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [numbering, setNumbering] = useState<NumberingMode>('none')
  const [sep, setSep] = useState('-')
  const [caseMode, setCaseMode] = useState<CaseMode>('none')
  const [extFrom, setExtFrom] = useState('')
  const [extTo, setExtTo] = useState('')

  const [applying, setApplying] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [results, setResults] = useState<BatchRenameResult | null>(null)
  const [error, setError] = useState<StashError | null>(null)

  const filesOnly = useMemo(() => (entries ?? []).filter((e) => !e.isDirectory), [entries])

  const extError =
    extFrom.trim().length > 0 && extTo.trim().length === 0
      ? 'A target extension is required when a source extension is set.'
      : null

  const rules: RenameRules = useMemo(
    () => ({
      ...(find ? { find } : {}),
      ...(replace ? { replace } : {}),
      useRegex,
      ...(prefix ? { prefix } : {}),
      ...(suffix ? { suffix } : {}),
      numbering,
      sep,
      caseMode,
      ...(extTo.trim()
        ? {
            changeExt: {
              ...(extFrom.trim() ? { from: extFrom.trim() } : {}),
              to: extTo.trim()
            }
          }
        : {})
    }),
    [find, replace, useRegex, prefix, suffix, numbering, sep, caseMode, extFrom, extTo]
  )

  const preview = useMemo(() => buildRenamePlan(filesOnly, rules), [filesOnly, rules])

  // Editing any rule invalidates a previous run's results so the preview
  // (and its Apply gate) is always what the user sees.
  useEffect(() => {
    setResults(null)
  }, [rules])

  // Two renames may legitimately chain (a→b then b→c), so only planned
  // targets colliding with each other block Apply.
  const canApply =
    dir !== null &&
    entries !== null &&
    !loadingDir &&
    !applying &&
    !preview.error &&
    extError === null &&
    preview.plan.length > 0 &&
    preview.conflicts.length === 0

  const chooseFolder = async (): Promise<void> => {
    try {
      const res = await window.stash.dialogs.chooseDirectory({
        title: 'Choose folder to rename files in'
      })
      if (!res.cancelled && res.path) {
        setDir(res.path)
        setEntries(null)
        setResults(null)
        setError(null)
        setLoadingDir(true)
        try {
          const listing: ListDirResult = await window.stash.files.listDir(res.path)
          setEntries(listing.entries)
        } catch (err) {
          setError(normalizeError(err))
          toastError(err)
        } finally {
          setLoadingDir(false)
        }
      }
    } catch (err) {
      toastError(err)
    }
  }

  const apply = async (): Promise<void> => {
    if (!dir || preview.plan.length === 0) return
    if (!confirming) {
      setConfirming(true)
      clearTimeout(confirmTimer.current)
      confirmTimer.current = setTimeout(() => setConfirming(false), 3000)
      return
    }
    if (!dir || preview.plan.length === 0) return
    setApplying(true)
    setConfirming(false)
    try {
      const res = await window.stash.files.batchRename({ dir, renames: preview.plan })
      setResults(res)
      const ok = res.renamed.length
      toastSuccess(
        `Renamed ${ok} file${ok === 1 ? '' : 's'}`,
        res.skipped.length > 0 ? `${res.skipped.length} skipped.` : undefined
      )
      recordHistoryQuietly({
        toolId: 'batch-rename',
        operation: 'rename',
        inputs: [fileNameOf(dir)],
        outputs: [`${ok} file${ok === 1 ? '' : 's'} renamed`],
        status: ok > 0 ? 'success' : 'failure',
        ...(res.skipped.length > 0 ? { message: `${res.skipped.length} skipped` } : {})
      })
      const listing = await window.stash.files.listDir(dir)
      setEntries(listing.entries)
    } catch (err) {
      const normalized = normalizeError(err)
      setError(normalized)
      toastError(err)
    } finally {
      setApplying(false)
    }
  }

  const directories = (entries ?? []).filter((e) => e.isDirectory)

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-3.5">
        <SectionHeading>Folder</SectionHeading>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button size="sm" loading={loadingDir} onClick={() => void chooseFolder()}>
            <FolderInput size={13} /> Choose folder…
          </Button>
          {dir && (
            <span
              className="min-w-0 max-w-72 truncate font-mono text-[11px] text-faint"
              title={dir}
            >
              {dir}
            </span>
          )}
        </div>
      </Panel>

      {!dir && (
        <EmptyState
          icon="folder"
          title="No folder selected yet."
          hint="Choose a folder above to list its files. Renames happen inside that folder only — every target is re-checked against your approval before anything moves."
        />
      )}

      {dir && entries !== null && filesOnly.length === 0 && (
        <EmptyState
          icon="folder"
          title={directories.length > 0 ? 'This folder has no files.' : 'This folder is empty.'}
          hint={
            directories.length > 0
              ? `${directories.length} subfolder${directories.length === 1 ? '' : 's'} found — subfolders are never renamed here.`
              : 'Add some files first, then come back to rename them.'
          }
        />
      )}

      {dir && entries !== null && filesOnly.length > 0 && (
        <>
          <Panel className="p-3.5">
            <SectionHeading>Files</SectionHeading>
            <p className="tnum mt-1 text-[11.5px] text-faint">
              {filesOnly.length} file{filesOnly.length === 1 ? '' : 's'}
              {directories.length > 0
                ? ` · ${directories.length} subfolder${directories.length === 1 ? '' : 's'} excluded`
                : ''}
            </p>
            <ul className="mt-2 flex max-h-44 flex-col gap-0.5 overflow-y-auto">
              {(entries ?? []).map((entry) => (
                <li
                  key={entry.name}
                  className={`truncate font-mono text-[11.5px] ${
                    entry.isDirectory ? 'text-faint/70 italic' : 'text-dim'
                  }`}
                  title={entry.isDirectory ? `${entry.name} (excluded)` : entry.name}
                >
                  {entry.name}
                  {entry.isDirectory && ' · folder'}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="p-3.5">
            <SectionHeading>Rename rules</SectionHeading>
            <div className="mt-2 flex flex-col gap-1.5">
              <FieldRow
                label="Find"
                htmlFor="rename-find"
                hint="Text or regular expression to match inside each file name."
              >
                <Input
                  id="rename-find"
                  mono
                  value={find}
                  placeholder="old-name"
                  invalid={preview.error !== undefined && useRegex}
                  onChange={(e) => setFind(e.target.value)}
                />
              </FieldRow>
              <FieldRow label="Replace" htmlFor="rename-replace">
                <Input
                  id="rename-replace"
                  mono
                  value={replace}
                  placeholder="(leave blank to delete)"
                  onChange={(e) => setReplace(e.target.value)}
                />
              </FieldRow>
              <FieldRow label="Regex" htmlFor="rename-regex">
                <Toggle checked={useRegex} onChange={setUseRegex} label="Use regular expressions" />
                {preview.error !== undefined && (
                  <span role="alert" className="min-w-0 flex-1 truncate text-[11.5px] text-danger">
                    Invalid expression: {preview.error}
                  </span>
                )}
              </FieldRow>
              <FieldRow label="Prefix" htmlFor="rename-prefix">
                <Input
                  id="rename-prefix"
                  mono
                  value={prefix}
                  placeholder="(optional)"
                  onChange={(e) => setPrefix(e.target.value)}
                />
              </FieldRow>
              <FieldRow label="Suffix" htmlFor="rename-suffix">
                <Input
                  id="rename-suffix"
                  mono
                  value={suffix}
                  placeholder="(optional)"
                  onChange={(e) => setSuffix(e.target.value)}
                />
              </FieldRow>
              <FieldRow label="Numbering" htmlFor="rename-numbering">
                <Select
                  id="rename-numbering"
                  value={numbering}
                  onChange={(e) => setNumbering(e.target.value as NumberingMode)}
                  className="w-36"
                >
                  {NUMBERING_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                {numbering !== 'none' && (
                  <Input
                    id="rename-sep"
                    aria-label="Numbering separator"
                    mono
                    className="w-16"
                    maxLength={4}
                    value={sep}
                    onChange={(e) => setSep(e.target.value)}
                  />
                )}
              </FieldRow>
              <FieldRow label="Case" htmlFor="rename-case">
                <Select
                  id="rename-case"
                  value={caseMode}
                  onChange={(e) => setCaseMode(e.target.value as CaseMode)}
                  className="w-36"
                >
                  {CASE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FieldRow>
              <FieldRow
                label="Extension"
                htmlFor="rename-ext-to"
                hint="Optionally rewrite file extensions, e.g. .jpeg → .webp. Leave blank to keep them."
              >
                <Input
                  id="rename-ext-from"
                  aria-label="Current extension filter"
                  mono
                  className="w-20"
                  placeholder="from"
                  invalid={extError !== null}
                  value={extFrom}
                  onChange={(e) => setExtFrom(e.target.value)}
                />
                <Input
                  id="rename-ext-to"
                  aria-label="New extension"
                  mono
                  className="w-20"
                  placeholder="to"
                  invalid={extError !== null}
                  value={extTo}
                  onChange={(e) => setExtTo(e.target.value)}
                />
              </FieldRow>
              {extError && (
                <p role="alert" className="pl-[5.75rem] text-[11.5px] leading-snug text-danger">
                  {extError}
                </p>
              )}
            </div>
          </Panel>

          {results ? (
            <>
              <SectionHeading>Results</SectionHeading>
              <ul className="flex flex-col gap-1">
                {results.renamed.map((item) => (
                  <li key={item.from} className="flex items-center gap-2">
                    <p
                      className="min-w-0 flex-1 truncate font-mono text-[12px] text-ok"
                      title={`${fileNameOf(item.from)} → ${fileNameOf(item.to)}`}
                    >
                      {fileNameOf(item.from)} → {fileNameOf(item.to)}
                    </p>
                    <RevealButton path={item.to} />
                  </li>
                ))}
                {results.skipped.map((item) => (
                  <li key={item.from} className="flex items-center gap-2">
                    <p
                      className="min-w-0 flex-1 truncate font-mono text-[12px] text-danger"
                      title={item.from}
                    >
                      {fileNameOf(item.from)} — not renamed ({item.reason})
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : preview.plan.length === 0 && !preview.error ? (
            <p className="px-1 text-center text-[12px] text-faint">
              The current rules don't change any names yet — adjust a rule to build the preview.
            </p>
          ) : (
            <Panel className="p-3.5">
              <SectionHeading>Preview</SectionHeading>
              <p className="tnum mt-1 text-[12px] text-dim" aria-live="polite">
                {preview.plan.length} of {filesOnly.length} files will be renamed
                {preview.conflicts.length > 0
                  ? ` · ${preview.conflicts.length} conflict${preview.conflicts.length === 1 ? '' : 's'}`
                  : ''}
              </p>
              <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
                {preview.plan.map((item) => {
                  const conflict = preview.conflicts.includes(item.from)
                  return (
                    <li key={item.from} className="flex items-center gap-2">
                      <p
                        className={`min-w-0 flex-1 truncate font-mono text-[11.5px] ${
                          conflict ? 'text-danger' : 'text-dim'
                        }`}
                        title={`${item.from} → ${item.to}`}
                      >
                        <span className="text-faint">{item.from}</span> →{' '}
                        {conflict ? `${item.to} (duplicate target)` : item.to}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </Panel>
          )}

          <div className="flex items-center gap-2">
            {!results && (
              <Button
                variant={confirming ? 'danger' : 'primary'}
                loading={applying}
                disabled={!canApply && !confirming}
                onClick={() => void apply()}
              >
                {confirming ? (
                  <>Apply {preview.plan.length} renames?</>
                ) : (
                  <>
                    <PencilLine size={13} /> Apply
                  </>
                )}
              </Button>
            )}
            {!results && !canApply && !applying && (
              <span className="text-[11px] text-faint">
                {preview.conflicts.length > 0
                  ? 'Resolve duplicate targets before applying.'
                  : preview.error
                    ? 'Fix the find pattern first.'
                    : 'Adjust the rules until at least one file changes.'}
              </span>
            )}
          </div>
        </>
      )}

      {error && <ErrorNote error={error} />}
    </div>
  )
}
