import { useEffect, useState } from 'react'
import { FolderOpen, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FieldRow, Select } from '../../components/ui/Inputs'
import { Panel, SectionHeading, SuccessNote } from '../../components/ui/Feedback'
import { AccentPicker } from './AccentPicker'
import { toastError, toastSuccess } from '../../stores/toasts'
import { clampZoomFactor, DEFAULT_ZOOM_FACTOR } from '../../../shared/utils/zoom'

interface AppInfo {
  version: string
  dataFolder: string
}

const ZOOM_OPTIONS = [
  { value: 1, label: '100%' },
  { value: 1.1, label: '110%' },
  { value: 1.25, label: '125%' }
]

const ZOOM_PREF_KEY = 'ui.zoom'
// Same key the accent-runtime module persists under; declared here only for
// the initial load in this view.
const ACCENT_PREF_KEY = 'ui.accent'

/**
 * Settings shell. Only real functions live here — no decorative placeholders.
 */
export function SettingsView() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [clearedAt, setClearedAt] = useState<string | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM_FACTOR)
  const [accent, setAccent] = useState<string | null>(null)

  useEffect(() => {
    window.stash.app
      .getInfo()
      .then(setInfo)
      .catch((err) => toastError(err))
    window.stash.prefs
      .get<number>(ZOOM_PREF_KEY)
      .then((value) => {
        if (typeof value === 'number') setZoom(clampZoomFactor(value))
      })
      .catch(() => {
        // No saved preference — keep the default zoom.
      })
    window.stash.prefs
      .get<string>(ACCENT_PREF_KEY)
      .then((value) => {
        if (typeof value === 'string') setAccent(value)
      })
      .catch(() => {
        // No saved accent — keep the amber default.
      })
  }, [])

  const changeZoom = async (next: number): Promise<void> => {
    setZoom(next)
    try {
      await window.stash.prefs.set(ZOOM_PREF_KEY, next)
      await window.stash.app.setZoom(next)
    } catch (err) {
      toastError(err)
    }
  }

  const clearHistory = async () => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      setTimeout(() => setConfirmingClear(false), 3000)
      return
    }
    try {
      await window.stash.history.clear()
      setClearedAt(new Date().toLocaleTimeString())
      toastSuccess('Activity history cleared')
    } catch (err) {
      toastError(err)
    } finally {
      setConfirmingClear(false)
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
        <SectionHeading>Appearance</SectionHeading>
        <p className="mt-2 text-[12px] text-dim">Accent color</p>
        <AccentPicker current={accent} />
        <div className="mt-3 flex items-center gap-3">
          <FieldRow label="Zoom" htmlFor="settings-zoom">
            <Select
              id="settings-zoom"
              value={zoom}
              onChange={(e) => void changeZoom(Number(e.target.value))}
              className="w-24"
            >
              {ZOOM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FieldRow>
          <p className="text-[11.5px] text-faint">Applied immediately and remembered.</p>
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
          <Button
            variant={confirmingClear ? 'primary' : 'danger'}
            size="sm"
            onClick={() => void clearHistory()}
          >
            <Trash2 size={13} aria-hidden />
            {confirmingClear ? 'Confirm clear?' : 'Clear activity history'}
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
