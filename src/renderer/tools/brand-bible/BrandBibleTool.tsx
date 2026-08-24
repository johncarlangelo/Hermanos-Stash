import { useEffect, useMemo, useState } from 'react'
import { Copy, Download, FileJson, RotateCcw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Panel, SectionHeading, Spinner } from '../../components/ui/Feedback'
import { FieldRow, Input, Select, TextArea } from '../../components/ui/Inputs'
import { toastError, toastSuccess } from '../../stores/toasts'
import { recordHistoryQuietly } from '../shared/use-progress-event'
import {
  BASE_SIZES,
  buildMarkdown,
  DEFAULT_DRAFT,
  FONT_PAIRINGS,
  parseDraftJson,
  serializeDraft,
  typeScale,
  type BrandBibleDraft
} from './logic'
import {
  bestTextOn,
  contrastAgainstWhite,
  hexToRgb,
  shadesAndTints
} from '../color-converter/logic'

const DRAFT_KEY = 'draft:brand-bible'

export default function BrandBibleTool() {
  const [draft, setDraft] = useState<BrandBibleDraft | null>(null)
  const [savedAtMs, setSavedAtMs] = useState<number | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let loaded = DEFAULT_DRAFT
      try {
        const raw = await window.stash.prefs.get<string>(DRAFT_KEY)
        const parsed = raw ? parseDraftJson(raw) : null
        if (parsed) loaded = parsed
      } catch {
        // Prefs unavailable — start from defaults rather than failing the tool.
      }
      if (!cancelled) setDraft(loaded)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!draft) return
    const timer = setTimeout(() => {
      window.stash.prefs
        .set(DRAFT_KEY, serializeDraft(draft))
        .then(() => setSavedAtMs(Date.now()))
        .catch(() => {
          // Autosave is best-effort; exports still work without persistence.
        })
    }, 500)
    return () => clearTimeout(timer)
  }, [draft])

  const markdown = useMemo(() => (draft ? buildMarkdown(draft) : ''), [draft])

  if (!draft) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner label="Loading brand bible" />
      </div>
    )
  }

  const update = (patch: Partial<BrandBibleDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      toastSuccess('Brand guide copied as Markdown')
    } catch {
      toastError('Clipboard write was blocked by the system.')
    }
  }

  const saveAs = async (kind: 'markdown' | 'json') => {
    const name = fileNameSlug(draft.brandName) || 'brand-bible'
    try {
      const dialog = await window.stash.dialogs.saveFile({
        title: kind === 'markdown' ? 'Save brand guide' : 'Save brand guide data',
        defaultName: kind === 'markdown' ? `${name}.md` : `${name}.json`,
        filters:
          kind === 'markdown'
            ? [{ name: 'Markdown', extensions: ['md'] }]
            : [{ name: 'JSON', extensions: ['json'] }]
      })
      if (dialog.cancelled || !dialog.path) return
      const content =
        kind === 'markdown' ? markdown : JSON.stringify({ version: 1, draft }, null, 2)
      await window.stash.fs.writeTextFile({ path: dialog.path, content })
      const fileName = dialog.path.split(/[\\/]/).pop() ?? dialog.path
      recordHistoryQuietly({
        toolId: 'brand-bible',
        operation: `export-${kind}`,
        inputs: [draft.brandName.trim() || 'Untitled'],
        outputs: [fileName],
        status: 'success'
      })
      toastSuccess(`Saved ${fileName}`)
    } catch (err) {
      toastError(err)
    }
  }

  const resetDraft = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset((c) => (c ? false : c)), 3000)
      return
    }
    setConfirmReset(false)
    setDraft({ ...DEFAULT_DRAFT })
    toastSuccess('Draft reset to defaults')
  }

  return (
    <div className="space-y-4">
      <Panel className="flex flex-wrap items-center gap-2 px-3.5 py-3">
        <Button variant="primary" size="sm" onClick={() => void copyMarkdown()}>
          <Copy size={12} aria-hidden />
          Copy Markdown
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void saveAs('markdown')}>
          <Download size={12} aria-hidden />
          Save Markdown…
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void saveAs('json')}>
          <FileJson size={12} aria-hidden />
          Save JSON…
        </Button>
        <span className="tnum text-[11px] text-faint">{markdown.length} characters</span>
        <span className="text-[11px] text-faint" aria-live="polite">
          {savedAtMs
            ? `Draft autosaved ${new Date(savedAtMs).toLocaleTimeString()}`
            : 'Draft autosaves as you type'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className={confirmReset ? 'ml-auto text-danger' : 'ml-auto'}
          onClick={resetDraft}
        >
          <RotateCcw size={12} aria-hidden />
          {confirmReset ? 'Click again to confirm reset' : 'Reset draft'}
        </Button>
      </Panel>

      {/* 01 Identity */}
      <NumberedPanel number="01" title="Identity">
        <div className="space-y-2.5">
          <FieldRow label="Name" htmlFor="bb-name">
            <Input
              id="bb-name"
              value={draft.brandName}
              onChange={(e) => update({ brandName: e.target.value })}
              placeholder="Your brand's name"
              maxLength={80}
            />
          </FieldRow>
          <FieldRow label="Tagline" htmlFor="bb-tagline">
            <Input
              id="bb-tagline"
              value={draft.tagline}
              onChange={(e) => update({ tagline: e.target.value })}
              placeholder="One memorable line"
              maxLength={120}
            />
          </FieldRow>
          <FieldRow label="Description" htmlFor="bb-desc">
            <Input
              id="bb-desc"
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="One sentence describing what this brand does"
              maxLength={200}
            />
          </FieldRow>
        </div>
      </NumberedPanel>

      {/* 02 Colors */}
      <NumberedPanel number="02" title="Colors">
        <p className="mb-2.5 text-[11.5px] text-faint">
          Each color gets an auto-generated shade strip. Badges show WCAG AA contrast against white
          — a text verdict, not just color.
        </p>
        <div className="space-y-4">
          <ColorField
            id="bb-primary"
            label="Primary"
            hex={draft.primaryColor}
            onChange={(hex) => update({ primaryColor: hex })}
          />
          <ColorField
            id="bb-accent"
            label="Accent"
            hex={draft.accentColor}
            onChange={(hex) => update({ accentColor: hex })}
          />
          <ColorField
            id="bb-neutral"
            label="Neutral base"
            hex={draft.neutralBase}
            onChange={(hex) => update({ neutralBase: hex })}
          />
        </div>
      </NumberedPanel>

      {/* 03 Typography */}
      <NumberedPanel number="03" title="Typography">
        <div className="space-y-2.5">
          <FontSelect
            id="bb-heading-font"
            label="Headings"
            value={draft.headingFont}
            stackKey="headingStack"
            onChange={(id) => update({ headingFont: id })}
          />
          <FontSelect
            id="bb-body-font"
            label="Body"
            value={draft.bodyFont}
            stackKey="bodyStack"
            onChange={(id) => update({ bodyFont: id })}
          />
          <div className="flex flex-wrap gap-x-6 gap-y-2.5 pt-1">
            <FieldRow label="Base size" htmlFor="bb-base-size">
              <Select
                id="bb-base-size"
                value={draft.baseSize}
                onChange={(e) => update({ baseSize: e.target.value })}
              >
                {BASE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </Select>
            </FieldRow>
            <FieldRow label="Ratio" htmlFor="bb-ratio">
              <Select
                id="bb-ratio"
                value={draft.scaleRatio}
                onChange={(e) =>
                  update({ scaleRatio: e.target.value as BrandBibleDraft['scaleRatio'] })
                }
              >
                <option value="1.200">1.200 — Minor Third</option>
                <option value="1.250">1.250 — Major Third</option>
                <option value="1.333">1.333 — Perfect Fourth</option>
              </Select>
            </FieldRow>
          </div>
          <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-base">
            {typeScale(draft.baseSize, Number(draft.scaleRatio)).map((step) => (
              <li key={step.label} className="flex items-baseline gap-3 px-3 py-2">
                <span className="w-9 shrink-0 font-mono text-[10px] tracking-wide text-faint uppercase">
                  {step.label}
                </span>
                <span className="tnum w-14 shrink-0 font-mono text-[11px] text-dim">
                  {step.sizePx}px
                </span>
                <span
                  className="min-w-0 truncate text-ink"
                  style={{ fontSize: Math.min(step.sizePx, 44), lineHeight: 1.25 }}
                >
                  Aa Quick fox
                </span>
              </li>
            ))}
          </ul>
        </div>
      </NumberedPanel>

      {/* 04 Voice */}
      <NumberedPanel number="04" title="Voice">
        <div className="space-y-2.5">
          <FieldRow label="We are" htmlFor="bb-voice-are">
            <Input
              id="bb-voice-are"
              value={draft.voiceWeAre}
              onChange={(e) => update({ voiceWeAre: e.target.value })}
              placeholder="precise · warm · quietly confident"
              maxLength={160}
            />
          </FieldRow>
          <FieldRow label="We are not" htmlFor="bb-voice-not">
            <Input
              id="bb-voice-not"
              value={draft.voiceWeAreNot}
              onChange={(e) => update({ voiceWeAreNot: e.target.value })}
              placeholder="loud · salesy · corporate"
              maxLength={160}
            />
          </FieldRow>
          <FieldRow label="Sound like" htmlFor="bb-voice-sound">
            <Input
              id="bb-voice-sound"
              value={draft.voiceWeSoundLike}
              onChange={(e) => update({ voiceWeSoundLike: e.target.value })}
              placeholder="a trusted engineer explaining things clearly"
              maxLength={160}
            />
          </FieldRow>
        </div>
      </NumberedPanel>

      {/* 05 Usage */}
      <NumberedPanel number="05" title="Usage">
        <div className="space-y-2.5">
          <FieldRow label="Dos" htmlFor="bb-dos">
            <TextArea
              id="bb-dos"
              rows={4}
              value={draft.dos}
              onChange={(e) => update({ dos: e.target.value })}
              placeholder={
                'One rule per line, e.g.\nUse the accent color sparingly\nKeep body contrast at AA or better'
              }
            />
          </FieldRow>
          <FieldRow label="Don'ts" htmlFor="bb-donts">
            <TextArea
              id="bb-donts"
              rows={4}
              value={draft.donts}
              onChange={(e) => update({ donts: e.target.value })}
              placeholder={'One rule per line, e.g.\nNever stretch or recolor the logo'}
            />
          </FieldRow>
          <FieldRow label="Logo rules" htmlFor="bb-logo">
            <Input
              id="bb-logo"
              mono={false}
              value={draft.logoRules}
              onChange={(e) => update({ logoRules: e.target.value })}
              placeholder="Clear space: one logo-height on all sides."
              maxLength={240}
            />
          </FieldRow>
        </div>
      </NumberedPanel>
    </div>
  )
}

function NumberedPanel({
  number,
  title,
  children
}: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <Panel className="px-4 py-4">
      <SectionHeading>
        <span className="mr-2 font-mono text-accent">{number}</span>
        {title}
      </SectionHeading>
      <div className="mt-3">{children}</div>
    </Panel>
  )
}

function ColorField({
  id,
  label,
  hex,
  onChange
}: {
  id: string
  label: string
  hex: string
  onChange: (hex: string) => void
}) {
  const rgb = hexToRgb(hex)
  const shades = rgb ? shadesAndTints(hex) : []
  return (
    <div>
      <FieldRow label={label} htmlFor={id}>
        <Input
          id={id}
          mono
          value={hex}
          invalid={!rgb}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-[10rem]"
          aria-label={`${label} hex value`}
        />
        <input
          type="color"
          value={rgb ? hex.toLowerCase() : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-line bg-base p-0.5"
          aria-label={`${label} color picker`}
        />
      </FieldRow>
      {!rgb ? (
        <p className="mt-1.5 ml-[5.625rem] text-[11px] text-danger">Enter a valid #rrggbb hex.</p>
      ) : (
        <ul className="mt-1.5 ml-[5.625rem] flex overflow-hidden rounded-md border border-line">
          {shades.map((shade) => {
            const fg = bestTextOn(hexToRgb(shade)!) === 'black' ? '#000000' : '#ffffff'
            const passes = contrastAgainstWhite(hexToRgb(shade)!) >= 4.5
            return (
              <li key={shade} className="min-w-0 flex-1">
                <div
                  className="flex h-13 w-full flex-col items-center justify-center gap-0.5"
                  style={{ backgroundColor: shade }}
                >
                  <span className="tnum font-mono text-[9px] uppercase" style={{ color: fg }}>
                    {shade.slice(1)}
                  </span>
                  <span
                    className={`font-mono text-[8.5px] tracking-wide uppercase ${passes ? '' : 'opacity-90 underline underline-offset-2'}`}
                    style={{ color: fg }}
                  >
                    AA {passes ? 'pass' : 'fail'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function FontSelect({
  id,
  label,
  value,
  stackKey,
  onChange
}: {
  id: string
  label: string
  value: string
  stackKey: 'headingStack' | 'bodyStack'
  onChange: (id: string) => void
}) {
  const pairing = FONT_PAIRINGS.find((p) => p.id === value)
  const stack = pairing?.[stackKey] ?? ''
  return (
    <div>
      <FieldRow label={label} htmlFor={id}>
        <Select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-xs"
        >
          {FONT_PAIRINGS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </FieldRow>
      <p
        className="mt-1.5 truncate pl-[5.625rem] text-[13px] text-dim"
        style={{ fontFamily: stack }}
        title={stack}
      >
        The quick brown fox jumps over the lazy dog — 0123456789
      </p>
    </div>
  )
}

function fileNameSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || ''
  )
}
