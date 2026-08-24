import { useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { ErrorNote, Panel, SectionHeading } from '../../components/ui/Feedback'
import { Input } from '../../components/ui/Inputs'
import { IconButton } from '../../components/ui/IconButton'
import { stashError, type StashError } from '../../../shared/errors'
import { toastError, toastSuccess } from '../../stores/toasts'
import {
  bestTextOn,
  contrastAgainstBlack,
  contrastAgainstWhite,
  harmonies,
  hexToRgb,
  parseColor,
  rgbToHsl,
  rgbToHex,
  shadesAndTints
} from './logic'

const DEFAULT_COLOR = '#2563eb'

export default function ColorConverterTool() {
  const [input, setInput] = useState(DEFAULT_COLOR)
  const [lastValid, setLastValid] = useState(DEFAULT_COLOR)

  const parsed = useMemo(() => parseColor(input), [input])
  const rgb = 'rgb' in parsed ? parsed.rgb : null
  const error: StashError | null =
    'error' in parsed && input.trim().length > 0 ? stashError('VALIDATION', parsed.error) : null

  const editInput = (value: string) => {
    setInput(value)
    const candidate = parseColor(value)
    if ('rgb' in candidate) setLastValid(value)
  }

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toastSuccess('Copied', value)
    } catch {
      toastError('Clipboard write was blocked by the system.')
    }
  }

  const pick = (hex: string) => {
    setInput(hex)
    setLastValid(hex)
    void copyValue(hex.toUpperCase())
  }

  const formatRgb = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : ''
  const hsl = rgb ? rgbToHsl(rgb) : null
  const formatHsl = hsl
    ? `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`
    : ''
  const baseHex = lastValid

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-3.5">
        <SectionHeading>Color</SectionHeading>
        <div className="mt-2 flex items-center gap-2">
          <Input
            mono
            value={input}
            invalid={input.trim().length > 0 && !rgb}
            onChange={(e) => editInput(e.target.value)}
            placeholder="#2563eb · rgb(37, 99, 235) · hsl(217, 91%, 53%)"
            aria-label="Color value"
            className="max-w-xs"
          />
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-faint">
            <span>Pick</span>
            <input
              type="color"
              value={baseHex}
              onChange={(e) => editInput(e.target.value)}
              className="h-8 w-9 cursor-pointer rounded-md border border-line bg-base p-0.5"
              aria-label="Native color picker"
            />
          </label>
        </div>
        {error && (
          <div className="mt-2 max-w-md">
            <ErrorNote error={error} />
          </div>
        )}

        {rgb && (
          <>
            <SwatchPreview hex={rgbToHex(rgb)} />
            <dl className="mt-2.5 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
              <ValueRow
                label="HEX"
                value={rgbToHex(rgb).toUpperCase()}
                onCopy={() => copyValue(rgbToHex(rgb).toUpperCase())}
              />
              <ValueRow label="RGB" value={formatRgb} onCopy={() => copyValue(formatRgb)} />
              <ValueRow label="HSL" value={formatHsl} onCopy={() => copyValue(formatHsl)} />
            </dl>
          </>
        )}
        {!rgb && (
          <p className="mt-2 text-[11.5px] text-faint" aria-live="polite">
            Showing the last valid color until the input parses again.
          </p>
        )}
      </Panel>

      {rgb && (
        <ContrastPanel
          hex={rgbToHex(rgb)}
          vsWhite={contrastAgainstWhite(rgb)}
          vsBlack={contrastAgainstBlack(rgb)}
        />
      )}

      {rgb && (
        <Panel className="p-3.5">
          <SectionHeading>Palettes</SectionHeading>
          <p className="mt-1 text-[11.5px] text-faint">
            Click any swatch to copy its hex and load it into the input.
          </p>
          <div className="mt-3 space-y-3">
            <PaletteRow label="Shades & tints" colors={shadesAndTints(baseHex)} onPick={pick} />
            <HarmonyRow
              title="Complementary"
              colors={[harmonies(baseHex).complementary]}
              onPick={pick}
            />
            <HarmonyRow
              title="Analogous ±30°"
              colors={harmonies(baseHex).analogous}
              onPick={pick}
            />
            <HarmonyRow
              title="Triadic 120° / 240°"
              colors={harmonies(baseHex).triadic}
              onPick={pick}
            />
            <HarmonyRow
              title="Split complementary 150° / 210°"
              colors={harmonies(baseHex).splitComplementary}
              onPick={pick}
            />
          </div>
        </Panel>
      )}
    </div>
  )
}

function SwatchPreview({ hex }: { hex: string }) {
  const rgb = hexToRgb(hex)!
  const fg = bestTextOn(rgb) === 'black' ? '#000000' : '#ffffff'
  return (
    <div
      className="mt-3 flex min-h-24 items-center justify-center rounded-lg border border-line px-4 py-6 transition-colors duration-200 ease-out"
      style={{ backgroundColor: hex }}
    >
      <p className="text-center text-[15px] leading-relaxed" style={{ color: fg }}>
        Aa — The quick brown fox jumps over the lazy dog.
        <span className="block text-[12px] opacity-80">
          Best text on this background: {bestTextOn(rgb)}
        </span>
      </p>
    </div>
  )
}

function ValueRow({
  label,
  value,
  onCopy
}: {
  label: string
  value: string
  onCopy: () => Promise<void>
}) {
  return (
    <>
      <dt className="w-10 shrink-0 self-center text-right text-[11.5px] text-faint">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <code className="tnum truncate font-mono text-[12.5px] text-ink" title={value}>
          {value}
        </code>
        <IconButton variant="ghost" size="sm" aria-label={`Copy ${label} value`} onClick={onCopy}>
          <Copy size={12} />
        </IconButton>
      </dd>
    </>
  )
}

function ContrastBadge({ ratio }: { ratio: number }) {
  const passes = ratio >= 4.5
  return (
    <span
      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${
        passes ? 'border-ok/40 text-ok' : 'border-line text-dim'
      }`}
    >
      AA {passes ? 'pass' : 'fail'}
    </span>
  )
}

function ContrastPanel({
  hex,
  vsWhite,
  vsBlack
}: {
  hex: string
  vsWhite: number
  vsBlack: number
}) {
  const row = (label: string, ratio: number) => (
    <div className="flex items-center gap-2.5">
      <span className="w-20 shrink-0 text-right text-[11.5px] text-faint">{label}</span>
      <span className="tnum font-mono text-[13px] text-ink">{ratio.toFixed(2)}:1</span>
      <ContrastBadge ratio={ratio} />
      <span className="text-[11px] text-faint">
        {ratio >= 4.5 ? 'readable for body text' : 'below body-text threshold'}
      </span>
    </div>
  )
  return (
    <Panel className="p-3.5">
      <SectionHeading>Contrast — {hex.toUpperCase()}</SectionHeading>
      <div className="mt-2.5 space-y-1.5">
        {row('vs White', vsWhite)}
        {row('vs Black', vsBlack)}
      </div>
      <p className="mt-2 text-[11px] text-faint">
        WCAG AA requires ≥ 4.5:1 for normal body text and ≥ 3:1 for large text.
      </p>
    </Panel>
  )
}

function PaletteRow({
  label,
  colors,
  onPick
}: {
  label: string
  colors: string[]
  onPick: (hex: string) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] text-dim">{label}</p>
      <ul className="flex overflow-hidden rounded-md border border-line">
        {colors.map((c) => (
          <li key={c} className="min-w-0 flex-1">
            <SwatchButton hex={c} onPick={onPick} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function HarmonyRow({
  title,
  colors,
  onPick
}: {
  title: string
  colors: Array<string | null>
  onPick: (hex: string) => void
}) {
  const present = colors.filter((c): c is string => Boolean(c))
  if (present.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] text-dim">{title}</p>
      <ul className="flex gap-1.5">
        {present.map((c) => (
          <li key={c} className="min-w-24 flex-1">
            <div className="overflow-hidden rounded-md border border-line">
              <SwatchButton hex={c} onPick={onPick} tall />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SwatchButton({
  hex,
  onPick,
  tall = false
}: {
  hex: string
  onPick: (hex: string) => void
  tall?: boolean
}) {
  const rgb = hexToRgb(hex)!
  const fg = bestTextOn(rgb) === 'black' ? '#000000' : '#ffffff'
  return (
    <button
      type="button"
      onClick={() => onPick(hex)}
      title={`Copy and load ${hex.toUpperCase()}`}
      className={`flex h-10 w-full cursor-pointer items-end justify-center transition-[filter] duration-150 ease-out hover:brightness-110 focus-visible:brightness-110 focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent ${
        tall ? 'md:h-14' : ''
      }`}
      style={{ backgroundColor: hex }}
    >
      <span
        className="tnum pb-0.5 font-mono text-[9.5px] tracking-wide uppercase"
        style={{ color: fg }}
      >
        {hex.slice(1)}
      </span>
    </button>
  )
}
