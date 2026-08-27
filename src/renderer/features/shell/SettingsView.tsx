import { useEffect, useState } from 'react'
import { Download, FolderOpen, Trash2, Upload } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FieldRow, Select } from '../../components/ui/Inputs'
import { Panel, SectionHeading, SuccessNote } from '../../components/ui/Feedback'
import { AccentPicker } from './AccentPicker'
import { setDensityPreference, type Density } from '../../accent-runtime'
import { DENSITY_PREF_KEY } from '../../accent-runtime'
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
  const [density, setDensity] = useState<Density>('comfortable')

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
    window.stash.prefs
      .get<string>(DENSITY_PREF_KEY)
      .then((value) => {
        if (value === 'compact' || value === 'comfortable') setDensity(value)
      })
      .catch(() => {
        // No saved density — keep comfortable.
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

  const exportProfile = async () => {
    try {
      const dialogResult = await window.stash.dialogs.saveFile({
        title: 'Export Stash Profile',
        defaultName: `stash-profile-${new Date().toISOString().slice(0, 10)}.stash-profile`,
        filters: [{ name: 'Stash Profile', extensions: ['stash-profile', 'json'] }]
      })
      if (dialogResult.cancelled || !dialogResult.path) return

      const [
        savedZoom,
        savedAccent,
        savedDensity,
        savedQueuePresets,
        savedLastUsedQueue,
        savedPins,
        favorites,
        prompts
      ] = await Promise.all([
        window.stash.prefs.get<number>(ZOOM_PREF_KEY),
        window.stash.prefs.get<string>(ACCENT_PREF_KEY),
        window.stash.prefs.get<string>(DENSITY_PREF_KEY),
        window.stash.prefs.get<unknown>('queue.presets'),
        window.stash.prefs.get<unknown>('queue.lastUsed'),
        window.stash.prefs.get<unknown>('pinnedTools'),
        window.stash.favorites.list().catch(() => []),
        window.stash.prompts.list().catch(() => [])
      ])

      const profile = {
        version: 1,
        exportedAt: new Date().toISOString(),
        prefs: {
          zoom: savedZoom ?? zoom,
          accent: savedAccent ?? accent,
          density: savedDensity ?? density,
          pinnedTools: savedPins ?? []
        },
        queue: {
          presets: savedQueuePresets ?? [],
          lastUsed: savedLastUsedQueue ?? null
        },
        favorites: favorites ?? [],
        prompts: prompts ?? []
      }

      await window.stash.fs.writeTextFile({
        path: dialogResult.path,
        content: JSON.stringify(profile, null, 2)
      })
      toastSuccess('Profile exported successfully')
    } catch (err) {
      toastError(err)
    }
  }

  const importProfile = async () => {
    try {
      const dialogResult = await window.stash.dialogs.openFile({
        title: 'Import Stash Profile',
        filters: [{ name: 'Stash Profile', extensions: ['stash-profile', 'json'] }]
      })
      if (dialogResult.cancelled || !dialogResult.paths || dialogResult.paths.length === 0) return

      const fileResult = await window.stash.fs.readTextFile({ path: dialogResult.paths[0] })
      const profile = JSON.parse(fileResult.content)

      if (!profile || typeof profile !== 'object') {
        throw new Error('Invalid profile file format')
      }

      // Restore preferences
      if (profile.prefs) {
        if (typeof profile.prefs.zoom === 'number') {
          const clamped = clampZoomFactor(profile.prefs.zoom)
          await window.stash.prefs.set(ZOOM_PREF_KEY, clamped)
          await window.stash.app.setZoom(clamped)
          setZoom(clamped)
        }
        if (typeof profile.prefs.accent === 'string') {
          await window.stash.prefs.set(ACCENT_PREF_KEY, profile.prefs.accent)
          setAccent(profile.prefs.accent)
        }
        if (profile.prefs.density === 'comfortable' || profile.prefs.density === 'compact') {
          await setDensityPreference(profile.prefs.density)
          setDensity(profile.prefs.density)
        }
        if (Array.isArray(profile.prefs.pinnedTools)) {
          await window.stash.prefs.set('pinnedTools', profile.prefs.pinnedTools)
        }
      }

      // Restore queue presets
      if (profile.queue) {
        if (Array.isArray(profile.queue.presets)) {
          await window.stash.prefs.set('queue.presets', profile.queue.presets)
        }
        if (profile.queue.lastUsed) {
          await window.stash.prefs.set('queue.lastUsed', profile.queue.lastUsed)
        }
      } else if (Array.isArray(profile.queuePresets)) {
        await window.stash.prefs.set('queue.presets', profile.queuePresets)
      }

      // Restore prompt library
      if (Array.isArray(profile.prompts)) {
        for (const prompt of profile.prompts) {
          if (prompt && typeof prompt.title === 'string' && typeof prompt.body === 'string') {
            await window.stash.prompts.save({
              title: prompt.title,
              body: prompt.body,
              tags: Array.isArray(prompt.tags) ? prompt.tags : []
            })
          }
        }
      }

      toastSuccess('Profile imported successfully')
    } catch (err) {
      toastError(err)
    }
  }

  return (
    <div className="relative">
      <div className="relative mx-auto w-full max-w-2xl space-y-6 px-8 py-8">
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
          <p className="mt-2 text-[12px] text-dim">Density</p>
          <div
            role="radiogroup"
            aria-label="Interface density"
            className="mt-2 inline-flex rounded-md border border-line p-0.5"
          >
            {(['comfortable', 'compact'] as Density[]).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={density === option}
                onClick={() => {
                  setDensity(option)
                  void setDensityPreference(option)
                }}
                className={`cursor-pointer rounded-sm px-3 py-1 text-[12px] capitalize transition-colors duration-150 ${
                  density === option
                    ? 'bg-raised text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]'
                    : 'text-faint hover:text-dim'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-faint">
            Compact fits more on screen. Applied immediately and remembered.
          </p>
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
          <SectionHeading>Backup & Portability</SectionHeading>
          <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
            Export your settings, theme choices, queue presets, prompt library, and pinned tools
            into a standalone{' '}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px] text-ink">
              .stash-profile
            </code>{' '}
            file to backup or migrate between machines.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => void exportProfile()}>
              <Download size={13} aria-hidden />
              Export Profile
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void importProfile()}>
              <Upload size={13} aria-hidden />
              Import Profile
            </Button>
          </div>
        </Panel>

        <Panel className="px-4 py-4">
          <SectionHeading>Privacy</SectionHeading>
          <p className="mt-2 text-[12.5px] leading-relaxed text-dim">
            Stash keeps a lightweight activity history (tool used, file names, outcome) so you can
            retrace recent work. File contents are never recorded, and clearing it below removes
            every entry immediately and permanently.
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
    </div>
  )
}
