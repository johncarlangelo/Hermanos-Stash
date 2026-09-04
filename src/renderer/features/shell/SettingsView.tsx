import { useEffect, useState } from 'react'
import {
  Download,
  FolderOpen,
  Trash2,
  Upload,
  Sliders,
  Palette,
  Shield,
  HardDrive
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { FieldRow, Select } from '../../components/ui/Inputs'
import { SuccessNote } from '../../components/ui/Feedback'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { AccentPicker } from './AccentPicker'
import { setDensityPreference, type Density } from '../../accent-runtime'
import { DENSITY_PREF_KEY } from '../../accent-runtime'
import { useWorkspace, WORKSPACE_WIDTH_KEY } from '../../stores/workspace'
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
  const workspaceWidth = useWorkspace((s) => s.width)
  const setWorkspaceWidth = useWorkspace((s) => s.setWidth)

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
        savedWidth,
        pinnedTools,
        queuePresets,
        queueLastUsed,
        prompts
      ] = await Promise.all([
        window.stash.prefs.get<number>(ZOOM_PREF_KEY),
        window.stash.prefs.get<string>(ACCENT_PREF_KEY),
        window.stash.prefs.get<string>(DENSITY_PREF_KEY),
        window.stash.prefs.get<string>(WORKSPACE_WIDTH_KEY),
        window.stash.prefs.get<string[]>('pinnedTools'),
        window.stash.prefs.get<unknown[]>('queue.presets'),
        window.stash.prefs.get<string>('queue.lastUsed'),
        window.stash.prompts.list()
      ])

      const profileData = {
        stashProfileVersion: 1,
        exportedAt: new Date().toISOString(),
        prefs: {
          zoom: savedZoom,
          accent: savedAccent,
          density: savedDensity,
          workspaceWidth: savedWidth,
          pinnedTools: pinnedTools ?? []
        },
        queue: {
          presets: queuePresets ?? [],
          lastUsed: queueLastUsed ?? null
        },
        prompts: prompts ?? []
      }

      await window.stash.fs.writeTextFile({
        path: dialogResult.path,
        content: JSON.stringify(profileData, null, 2)
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
        filters: [{ name: 'Stash Profile', extensions: ['stash-profile', 'json'] }],
        multiSelections: false
      })
      if (dialogResult.cancelled || dialogResult.paths.length === 0) return

      const { content } = await window.stash.fs.readTextFile({ path: dialogResult.paths[0] })
      let profile: {
        stashProfileVersion?: number
        prefs?: {
          zoom?: number
          accent?: string
          density?: string
          workspaceWidth?: string
          pinnedTools?: string[]
        }
        queue?: {
          presets?: unknown[]
          lastUsed?: string | null
        }
        queuePresets?: unknown[]
        prompts?: Array<{ title?: string; body?: string; tags?: string[] }>
      }

      try {
        profile = JSON.parse(content) as typeof profile
      } catch {
        toastError('Selected file is not valid JSON')
        return
      }

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
        if (
          profile.prefs.workspaceWidth === 'wide' ||
          profile.prefs.workspaceWidth === 'standard'
        ) {
          await setWorkspaceWidth(profile.prefs.workspaceWidth)
        }
        if (Array.isArray(profile.prefs.pinnedTools)) {
          await window.stash.prefs.set('pinnedTools', profile.prefs.pinnedTools)
        }
      }

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
    <div className="mx-auto w-full max-w-4xl px-6 sm:px-8 py-8 space-y-7">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-raised/80 shadow-[0_0_24px_-8px_var(--color-accent-glow)]">
            <Sliders size={22} className="text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-ink">
                Settings & Preferences
              </h1>
              <Badge
                variant="outline"
                className="border-accent/40 text-accent font-mono text-[10px]"
              >
                LOCAL SYSTEM
              </Badge>
            </div>
            <p className="text-[13px] text-dim mt-0.5">
              Workstation appearance, canvas layout, density scaling, and local backups.
            </p>
          </div>
        </div>
      </div>

      {clearedAt && (
        <SuccessNote
          message={`All recorded tool runs were removed from your local history at ${clearedAt}.`}
        />
      )}

      {/* Main Settings Cards */}
      <div className="space-y-6">
        {/* Card 1: Appearance & Display */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="pb-4 border-b border-line/60">
            <div className="flex items-center gap-2">
              <Palette size={16} className="text-accent" />
              <CardTitle className="text-sm font-semibold text-ink">Appearance & Canvas</CardTitle>
            </div>
            <CardDescription className="text-xs text-dim mt-0.5">
              Customize the theme accent color, layout width, interface density, and display scaling
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-6">
            {/* Accent color */}
            <div>
              <label className="text-xs font-medium text-ink block mb-2">Accent Color</label>
              <AccentPicker current={accent} />
            </div>

            {/* Density */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink block">Interface Density</label>
              <div
                role="radiogroup"
                aria-label="Interface density"
                className="inline-flex rounded-lg border border-line bg-surface/80 p-0.5"
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
                    className={`cursor-pointer rounded-md px-3 py-1.5 text-xs capitalize transition-all ${
                      density === option
                        ? 'bg-accent text-base shadow-sm font-semibold'
                        : 'text-dim hover:text-ink hover:bg-raised/50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-faint">
                Compact tightens paddings and table rows to fit more content on screen.
              </p>
            </div>

            {/* Workspace Canvas Width */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-ink block">Workspace Canvas Width</label>
              <div
                role="radiogroup"
                aria-label="Workspace canvas width"
                className="inline-flex rounded-lg border border-line bg-surface/80 p-0.5"
              >
                {(
                  [
                    { id: 'wide', label: 'Wide / Expanded' },
                    { id: 'standard', label: 'Standard / Compact' }
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={workspaceWidth === option.id}
                    onClick={() => void setWorkspaceWidth(option.id)}
                    className={`cursor-pointer rounded-md px-3 py-1.5 text-xs transition-all ${
                      workspaceWidth === option.id
                        ? 'bg-accent text-base shadow-sm font-semibold'
                        : 'text-dim hover:text-ink hover:bg-raised/50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-faint">
                Wide utilizes monitor width for spacious multi-column workstations.
              </p>
            </div>

            {/* Zoom Scaling */}
            <div className="flex items-center gap-4 pt-1">
              <FieldRow label="Display Zoom" htmlFor="settings-zoom">
                <Select
                  id="settings-zoom"
                  value={zoom}
                  onChange={(e) => void changeZoom(Number(e.target.value))}
                  className="w-28 text-xs h-8"
                >
                  {ZOOM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FieldRow>
              <p className="text-[11.5px] text-faint">Scales the entire workstation interface.</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Application Info & Storage */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="pb-4 border-b border-line/60">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-accent" />
              <CardTitle className="text-sm font-semibold text-ink">
                Application & Data Storage
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-dim mt-0.5">
              Local filesystem location and installed runtime version
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg border border-line/70 bg-surface/40 p-3">
                <dt className="text-faint uppercase font-mono text-[10px] tracking-wider">
                  Version
                </dt>
                <dd className="mt-1 font-mono text-ink font-medium text-sm">
                  {info?.version ?? '0.1.0'}
                </dd>
              </div>
              <div className="rounded-lg border border-line/70 bg-surface/40 p-3">
                <dt className="text-faint uppercase font-mono text-[10px] tracking-wider">
                  Storage Engine
                </dt>
                <dd className="mt-1 font-mono text-ink font-medium text-sm">Local SQLite 3</dd>
              </div>
            </dl>

            <div className="rounded-lg border border-line/70 bg-surface/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-faint uppercase font-mono text-[10px] tracking-wider">
                  Data Folder
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void revealData()}
                  className="gap-1.5 text-xs cursor-pointer h-7"
                >
                  <FolderOpen size={12} aria-hidden />
                  Open in Explorer
                </Button>
              </div>
              <p className="font-mono text-xs text-dim break-all select-all">
                {info?.dataFolder ?? '...'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Backup & Portability */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="pb-4 border-b border-line/60">
            <div className="flex items-center gap-2">
              <Download size={16} className="text-accent" />
              <CardTitle className="text-sm font-semibold text-ink">Backup & Portability</CardTitle>
            </div>
            <CardDescription className="text-xs text-dim mt-0.5">
              Export and restore all preferences, queue presets, prompt snippets, and pinned dock
              tools
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <p className="text-xs text-dim leading-relaxed">
              Export your configuration into a standalone{' '}
              <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[11px] text-accent border border-line">
                .stash-profile
              </code>{' '}
              file to migrate or keep a safe backup of your local workstation setup.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void exportProfile()}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <Download size={13} aria-hidden />
                Export Profile
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void importProfile()}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <Upload size={13} aria-hidden />
                Import Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Privacy & Data Hygiene */}
        <Card className="border-line/70 bg-surface/60 backdrop-blur-md">
          <CardHeader className="pb-4 border-b border-line/60">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-accent" />
              <CardTitle className="text-sm font-semibold text-ink">
                Privacy & Data Hygiene
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-dim mt-0.5">
              100% offline, zero cloud connections, complete data autonomy
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <p className="text-xs text-dim leading-relaxed">
              Stash records activity metadata (tool names, operations, durations) so you can easily
              review your history. File contents are never sent anywhere or stored in telemetry.
              Clearing history below permanently removes all logs.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant={confirmingClear ? 'primary' : 'danger'}
                size="sm"
                onClick={() => void clearHistory()}
                className="gap-1.5 text-xs cursor-pointer"
              >
                <Trash2 size={13} aria-hidden />
                {confirmingClear ? 'Confirm Clear?' : 'Clear Activity History'}
              </Button>
              {clearedAt && (
                <span className="text-xs text-ok font-mono">Cleared at {clearedAt}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-faint font-mono pt-2">
        Hermanos Stash · Local-First Desktop Workstation · Zero Cloud Dependency
      </p>
    </div>
  )
}

export default SettingsView
