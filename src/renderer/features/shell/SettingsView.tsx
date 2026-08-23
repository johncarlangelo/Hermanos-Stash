import { useEffect, useState } from 'react'
import { FolderOpen, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel, SectionHeading, SuccessNote } from '../../components/ui/Feedback'
import { toastError, toastSuccess } from '../../stores/toasts'

interface AppInfo {
  version: string
  dataFolder: string
}

/**
 * Settings shell. Only real functions live here — no decorative placeholders.
 */
export function SettingsView() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [clearedAt, setClearedAt] = useState<string | null>(null)

  useEffect(() => {
    window.stash.app
      .getInfo()
      .then(setInfo)
      .catch((err) => toastError(err))
  }, [])

  const clearHistory = async () => {
    try {
      await window.stash.history.clear()
      setClearedAt(new Date().toLocaleTimeString())
      toastSuccess('Activity history cleared')
    } catch (err) {
      toastError(err)
    }
  }

  const revealData = async () => {
    try {
      await window.stash.app.revealDataFolder()
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-8 py-8">
      <div>
        <h1 className="text-[19px] font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-0.5 text-[12.5px] text-dim">
          Everything is stored locally on this machine. No account, no cloud.
        </p>
      </div>

      <Panel className="px-4 py-4">
        <SectionHeading>About</SectionHeading>
        <dl className="mt-3 space-y-2 text-[12.5px]">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-faint">Version</dt>
            <dd className="tnum font-mono text-dim">{info?.version ?? '…'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-faint">Data folder</dt>
            <dd
              className="min-w-0 truncate font-mono text-[11.5px] text-dim"
              title={info?.dataFolder}
            >
              {info?.dataFolder ?? '…'}
            </dd>
          </div>
        </dl>
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => void revealData()}>
            <FolderOpen size={13} aria-hidden />
            Open data folder
          </Button>
        </div>
      </Panel>

      <Panel className="px-4 py-4">
        <SectionHeading>Privacy</SectionHeading>
        <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
          Stash keeps a lightweight activity history (tool used, file names, outcome) so you can
          retrace recent work. File contents are never recorded, and clearing it below removes every
          entry immediately and permanently.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="danger" size="sm" onClick={() => void clearHistory()}>
            <Trash2 size={13} aria-hidden />
            Clear activity history
          </Button>
          {clearedAt && <SuccessNote message={`Cleared at ${clearedAt}`} />}
        </div>
      </Panel>

      <p className="text-center text-[11px] text-faint">
        Hermanos Stash runs entirely offline. Files you process never leave this machine.
      </p>
    </div>
  )
}
