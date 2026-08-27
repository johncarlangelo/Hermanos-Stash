import { useEffect } from 'react'
import { FilePlus2, Play } from 'lucide-react'
import { useQueueStore } from '../../stores/queue'
import { useNav } from '../../stores/nav'
import { Panel, EmptyState } from '../../components/ui/Feedback'
import { Button } from '../../components/ui/Button'

/**
 * Queue view — combines the builder (when editing) and the runner (when running).
 * For now, just the builder since runner needs IPC work.
 */
export function QueueView() {
  const { presets, initialize } = useQueueStore()
  const openQueue = useNav((s) => s.openQueue)

  useEffect(() => {
    void initialize()
  }, [initialize])

  if (presets.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-8 py-8">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight text-ink">Queue Runner</h1>
            <p className="mt-0.5 text-[12.5px] text-dim">
              Build ordered tool chains. Output of each step feeds the next.
            </p>
          </div>
          <Button variant="primary" onClick={() => openQueue()}>
            <FilePlus2 size={13} aria-hidden />
            Create Queue
          </Button>
        </div>
        <EmptyState
          icon="git-merge"
          title="No saved queues yet."
          hint="Create your first queue from the builder."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink">Queue Runner</h1>
          <p className="mt-0.5 text-[12.5px] text-dim">
            {presets.length} saved queue{presets.length !== 1 ? 's' : ''} · Output of each step feeds the next
          </p>
        </div>
        <Button variant="primary" onClick={() => openQueue()}>
          <FilePlus2 size={13} aria-hidden />
          Create Queue
        </Button>
      </div>

      <ul className="space-y-2">
        {presets.map((p) => (
          <Panel key={p.id} className="flex items-center justify-between px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink">{p.name}</p>
              <p className="text-[11px] text-faint">{p.steps.length} step(s)</p>
            </div>
            <Button size="sm" variant="primary" onClick={() => openQueue(p.id)}>
              <Play size={12} aria-hidden />
              Run
            </Button>
          </Panel>
        ))}
      </ul>
    </div>
  )
}