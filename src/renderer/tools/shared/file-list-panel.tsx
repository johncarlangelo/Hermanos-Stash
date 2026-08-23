import { X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel, SectionHeading } from '../../components/ui/Feedback'
import { fileNameOf, type FileListItem } from './use-file-list'

/**
 * Compact accumulating file list with per-row removal — the shared input
 * surface for multi-file batch tools (DESIGN.md → Tool workspace pattern).
 */
export function FileListPanel({
  items,
  onRemove,
  onClearAll,
  heading = 'Files',
  detail
}: {
  items: FileListItem[]
  onRemove(path: string): void
  onClearAll(): void
  heading?: string
  detail?(item: FileListItem): string | null
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <SectionHeading>
          {heading} · {items.length}
        </SectionHeading>
        <Button size="sm" variant="ghost" onClick={onClearAll}>
          Clear all
        </Button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <Panel className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={item.path}>
                  {fileNameOf(item.path)}
                </span>
                {detail && (
                  <span className="tnum shrink-0 text-[11.5px] text-faint">{detail(item)}</span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${fileNameOf(item.path)} from the list`}
                  onClick={() => onRemove(item.path)}
                  className="shrink-0 cursor-pointer rounded-sm p-1 text-faint transition-colors duration-150 ease-out hover:bg-surface hover:text-danger"
                >
                  <X size={14} />
                </button>
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </>
  )
}
