import { useState } from 'react'
import { Eraser } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { EmptyState, Panel, SectionHeading } from '../../components/ui/Feedback'
import { TextArea } from '../../components/ui/Inputs'
import { diffLines, MAX_LINES, type DiffRow, type DiffSummary } from './logic'

type Computed = DiffSummary | { error: 'too large' }

export default function TextDiffTool() {
  const [original, setOriginal] = useState('')
  const [modified, setModified] = useState('')
  const [computed, setComputed] = useState<Computed | null>(null)

  const canCompute = original.length > 0 || modified.length > 0

  const compute = () => setComputed(diffLines(original, modified))
  const clearAll = () => {
    setOriginal('')
    setModified('')
    setComputed(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>Original</SectionHeading>
            <span role="status" className="font-mono text-[10.5px] text-faint tnum">
              {countLines(original)} lines
            </span>
          </div>
          <label htmlFor="diff-original" className="sr-only">
            Original text
          </label>
          <TextArea
            id="diff-original"
            mono
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            placeholder={'Paste the older version here…'}
            className="h-40"
          />
        </Panel>

        <Panel className="p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionHeading>Modified</SectionHeading>
            <span role="status" className="font-mono text-[10.5px] text-faint tnum">
              {countLines(modified)} lines
            </span>
          </div>
          <label htmlFor="diff-modified" className="sr-only">
            Modified text
          </label>
          <TextArea
            id="diff-modified"
            mono
            value={modified}
            onChange={(e) => setModified(e.target.value)}
            placeholder={'Paste the newer version here…'}
            className="h-40"
          />
        </Panel>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" disabled={!canCompute} onClick={compute}>
          Compute diff
        </Button>
        {(canCompute || computed) && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <Eraser size={13} aria-hidden />
            Clear
          </Button>
        )}
        <span className="ml-auto text-[11px] text-faint">
          Line-level comparison, up to {MAX_LINES.toLocaleString()} lines per side.
        </span>
      </div>

      {computed === null ? (
        <EmptyState
          icon="file-text"
          title="Add both versions and press “Compute diff”."
          hint="Removed lines show with a minus marker and added lines with a plus — nothing is uploaded anywhere."
        />
      ) : 'error' in computed ? (
        <EmptyState
          icon="alert"
          title="This comparison is too large to render."
          hint={`Each side is limited to ${MAX_LINES.toLocaleString()} lines so the app stays responsive. Trim the texts or split the comparison into chunks.`}
        />
      ) : (
        <DiffResults result={computed} />
      )}
    </div>
  )
}

function DiffResults({ result }: { result: DiffSummary }) {
  const unchanged = result.rows.filter((row: DiffRow) => row.type === 'equal').length

  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-line px-3.5 py-2.5">
        <p
          role="status"
          aria-label="Diff summary"
          className="font-mono text-[11.5px] text-dim tnum"
        >
          +{result.added} added · −{result.removed} removed · {unchanged} unchanged
        </p>
      </div>
      {result.rows.length === 0 ? (
        <div className="px-4 py-10 text-center text-[12.5px] text-dim">
          Both sides are empty — there is nothing to compare yet.
        </div>
      ) : (
        <ol
          aria-label="Unified diff"
          className="max-h-[28rem] overflow-y-auto font-mono text-[12px] leading-[1.7]"
        >
          {result.rows.map((row, index) =>
            row.type === 'removed' ? (
              <li key={index} className="flex bg-danger/8 px-2 text-danger">
                <span
                  aria-hidden
                  className="w-6 shrink-0 text-right pr-1.5 select-none opacity-70 tnum"
                >
                  −
                </span>
                <span className="truncate whitespace-pre">{row.text}</span>
                <span className="sr-only">{`Removed from original line ${row.aIndex}`}</span>
              </li>
            ) : row.type === 'added' ? (
              <li key={index} className="flex bg-ok/8 px-2 text-ok">
                <span
                  aria-hidden
                  className="w-6 shrink-0 text-right pr-1.5 select-none opacity-70 tnum"
                >
                  +
                </span>
                <span className="truncate whitespace-pre">{row.text}</span>
                <span className="sr-only">{`Added at modified line ${row.bIndex}`}</span>
              </li>
            ) : (
              <li key={index} className="flex px-2 text-faint">
                <span aria-hidden className="w-6 shrink-0 select-none" />
                <span className="truncate whitespace-pre">{row.text}</span>
              </li>
            )
          )}
        </ol>
      )}
    </Panel>
  )
}

function countLines(text: string): number {
  return text.length === 0 ? 0 : text.split('\n').length
}
