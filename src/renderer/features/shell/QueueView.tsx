import { useEffect, useState } from 'react'
import { Play, Wrench } from 'lucide-react'
import { useQueueStore } from '../../stores/queue'
import { useNav } from '../../stores/nav'
import { QueueRunner } from './QueueRunner'
import { QueueBuilder } from './QueueBuilder'

type QueueTab = 'runner' | 'builder'

/**
 * QueueView — unified workspace hosting both the Queue Runner and Queue Builder.
 */
export function QueueView() {
  const view = useNav((s) => s.view)
  const { initialize } = useQueueStore()

  const presetIdFromNav = view.type === 'queue' ? view.presetId : undefined
  const [activeTab, setActiveTab] = useState<QueueTab>(presetIdFromNav ? 'runner' : 'runner')
  const [activePresetId, setActivePresetId] = useState<string | undefined>(presetIdFromNav)

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (presetIdFromNav) {
      setActivePresetId(presetIdFromNav)
      setActiveTab('runner')
    }
  }, [presetIdFromNav])

  return (
    <div className="flex h-full flex-col px-6 py-5">
      {/* Tab Switcher */}
      <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
        <div className="flex items-center gap-1 rounded-md border border-line bg-surface/50 p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('runner')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-sm px-3 py-1 text-[12px] font-medium transition-colors ${
              activeTab === 'runner'
                ? 'bg-raised text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]'
                : 'text-faint hover:text-dim'
            }`}
          >
            <Play size={12} className={activeTab === 'runner' ? 'text-accent' : ''} aria-hidden />
            Runner
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`flex cursor-pointer items-center gap-1.5 rounded-sm px-3 py-1 text-[12px] font-medium transition-colors ${
              activeTab === 'builder'
                ? 'bg-raised text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]'
                : 'text-faint hover:text-dim'
            }`}
          >
            <Wrench
              size={12}
              className={activeTab === 'builder' ? 'text-accent' : ''}
              aria-hidden
            />
            Builder
          </button>
        </div>
      </div>

      {/* Main tab content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === 'runner' ? (
          <QueueRunner
            initialPresetId={activePresetId}
            onEditPreset={(id) => {
              setActivePresetId(id)
              setActiveTab('builder')
            }}
          />
        ) : (
          <QueueBuilder
            initialPresetId={activePresetId}
            onRunPreset={(id) => {
              setActivePresetId(id)
              setActiveTab('runner')
            }}
          />
        )}
      </div>
    </div>
  )
}

export default QueueView
