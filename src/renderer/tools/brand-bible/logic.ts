/**
 * Brand Bible Creator logic: draft shape, defaults, autosave (de)serialization
 * and deterministic Markdown composition. Pure — no DOM or IPC access.
 */

export interface BrandBibleDraft {
  brandName: string
  tagline: string
  description: string
  primaryColor: string
  accentColor: string
  neutralBase: string
  headingFont: string
  bodyFont: string
  baseSize: string
  scaleRatio: '1.200' | '1.250' | '1.333'
  voiceWeAre: string
  voiceWeAreNot: string
  voiceWeSoundLike: string
  dos: string
  donts: string
  logoRules: string
}

export interface FontPairing {
  id: string
  label: string
  /** CSS font-family stack for headings. */
  headingStack: string
  /** CSS font-family stack for body copy. */
  bodyStack: string
}

/** Widely-available system pairings; no downloads, works on a stock Windows box. */
export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'segoe',
    label: 'Segoe UI Variable & Segoe UI',
    headingStack: '"Segoe UI Variable Display", "Segoe UI Variable", "Segoe UI", sans-serif',
    bodyStack: '"Segoe UI", system-ui, sans-serif'
  },
  {
    id: 'georgia-verdana',
    label: 'Georgia & Verdana',
    headingStack: 'Georgia, "Times New Roman", serif',
    bodyStack: 'Verdana, Geneva, sans-serif'
  },
  {
    id: 'cascadia-consolas',
    label: 'Cascadia Code & Consolas',
    headingStack: '"Cascadia Code", "Cascadia Mono", monospace',
    bodyStack: 'Consolas, "Courier New", monospace'
  },
  {
    id: 'times-arial',
    label: 'Times New Roman & Arial',
    headingStack: '"Times New Roman", Times, serif',
    bodyStack: 'Arial, Helvetica, sans-serif'
  },
  {
    id: 'cambria-calibri',
    label: 'Cambria & Calibri',
    headingStack: 'Cambria, Georgia, serif',
    bodyStack: 'Calibri, Candara, sans-serif'
  },
  {
    id: 'palatino-tahoma',
    label: 'Palatino Linotype & Tahoma',
    headingStack: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
    bodyStack: 'Tahoma, Verdana, sans-serif'
  },
  {
    id: 'bahn-segoe',
    label: 'Bahnschrift & Segoe UI',
    headingStack: 'Bahnschrift, sans-serif',
    bodyStack: '"Segoe UI", system-ui, sans-serif'
  },
  {
    id: 'franklin-candara',
    label: 'Franklin Gothic & Candara',
    headingStack: '"Franklin Gothic Medium", "Franklin Gothic", sans-serif',
    bodyStack: 'Candara, Calibri, sans-serif'
  },
  {
    id: 'rockwell-trebuchet',
    label: 'Rockwell & Trebuchet MS',
    headingStack: 'Rockwell, serif',
    bodyStack: '"Trebuchet MS", Tahoma, sans-serif'
  },
  {
    id: 'constantia-corbel',
    label: 'Constantia & Corbel',
    headingStack: 'Constantia, Cambria, serif',
    bodyStack: 'Corbel, Candara, sans-serif'
  },
  {
    id: 'courier-helvetica',
    label: 'Courier New & Helvetica',
    headingStack: '"Courier New", Courier, monospace',
    bodyStack: 'Helvetica, Arial, sans-serif'
  },
  {
    id: 'garamond-gillsans',
    label: 'Garamond & Gill Sans MT',
    headingStack: 'Garamond, "Palatino Linotype", serif',
    bodyStack: '"Gill Sans MT", Calibri, sans-serif'
  }
]

export const BASE_SIZES = ['14px', '15px', '16px', '17px', '18px'] as const

export const DEFAULT_DRAFT: BrandBibleDraft = {
  brandName: '',
  tagline: '',
  description: '',
  primaryColor: '#2563eb',
  accentColor: '#f59e0b',
  neutralBase: '#1f2937',
  headingFont: 'segoe',
  bodyFont: 'segoe',
  baseSize: '16px',
  scaleRatio: '1.250',
  voiceWeAre: '',
  voiceWeAreNot: '',
  voiceWeSoundLike: '',
  dos: '',
  donts: '',
  logoRules: ''
}

export interface TypeScaleStep {
  label: string
  sizePx: number
}

const SCALE_LABELS = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'] as const

/** Compute the type scale from a base size and ratio, xs (-2) → 3xl (+4). */
export function typeScale(baseSize: string, ratio: number): TypeScaleStep[] {
  const base = Number.parseFloat(baseSize)
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(ratio) || ratio <= 0) return []
  return SCALE_LABELS.map((label, i) => ({
    label,
    sizePx: Math.round(base * Math.pow(ratio, i - 2) * 10) / 10
  }))
}

function pairingLabel(id: string): string {
  return FONT_PAIRINGS.find((p) => p.id === id)?.label ?? '(custom)'
}

/**
 * Compose the exportable Markdown guide. Deterministic: the same draft always
 * yields byte-identical output. Works for an empty/default draft too.
 */
export function buildMarkdown(draft: BrandBibleDraft): string {
  const title = draft.brandName.trim() || 'Brand Bible'
  const lines: string[] = []

  lines.push(`# ${title}`)
  if (draft.tagline.trim()) lines.push('', `> ${draft.tagline.trim()}`)
  if (draft.description.trim()) lines.push('', draft.description.trim())

  lines.push('', '## Colors')
  const colorRows = (
    [
      ['Primary', draft.primaryColor],
      ['Accent', draft.accentColor],
      ['Neutral base', draft.neutralBase]
    ] as Array<[string, string]>
  ).filter(([, hex]) => hex.trim())
  lines.push('', '| Name | Hex | Contrast vs White | AA body text |', '| --- | --- | --- | --- |')
  if (colorRows.length === 0) lines.push('| — | — | — | — |')
  for (const [name, hex] of colorRows) {
    const rgb = safeHexToRgb(hex.trim())
    if (!rgb) {
      lines.push(`| ${name} | \`${hex.trim()}\` | — | — |`)
      continue
    }
    const ratio = contrastVsWhite(rgb)
    lines.push(
      `| ${name} | \`${hex.toUpperCase()}\` | ${ratio.toFixed(2)}:1 | ${ratio >= 4.5 ? 'pass' : 'fail'} |`
    )
  }

  lines.push('', '## Typography')
  lines.push(
    '',
    `- Headings: ${pairingLabel(draft.headingFont)}`,
    `- Body: ${pairingLabel(draft.bodyFont)}`
  )
  const scale = typeScale(draft.baseSize, Number(draft.scaleRatio))
  if (scale.length > 0) {
    lines.push('', `Type scale (base ${draft.baseSize}, ratio ${draft.scaleRatio}):`)
    lines.push('| Step | Size |', '| --- | --- |')
    for (const step of scale) {
      lines.push(`| ${step.label} | ${step.sizePx}px${step.label === 'base' ? ' (base)' : ''} |`)
    }
  }

  lines.push('', '## Voice')
  pushVoiceList(lines, 'We are', draft.voiceWeAre)
  pushVoiceList(lines, 'We are not', draft.voiceWeAreNot)
  pushVoiceList(lines, 'We sound like', draft.voiceWeSoundLike)

  lines.push('', '## Usage')
  pushLinesList(lines, 'Dos', draft.dos)
  pushLinesList(lines, "Don'ts", draft.donts)
  if (draft.logoRules.trim()) lines.push('', `Logo rules: ${draft.logoRules.trim()}`)

  return lines.join('\n') + '\n'
}

function pushVoiceList(out: string[], heading: string, raw: string): void {
  out.push('', `**${heading}:**`, ...linesToItems(raw))
}

function pushLinesList(out: string[], heading: string, raw: string): void {
  out.push('', `**${heading}:**`, ...linesToItems(raw))
}

function linesToItems(raw: string): string[] {
  const items = raw
    .split('\n')
    .map((l) => l.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean)
    .slice(0, 30)
  return items.length > 0 ? items.map((item) => `- ${item}`) : ['- (not yet defined)']
}

// Local copies of the color math keep this module dependency-light; richer
// helpers live in ../color-converter/logic for interactive use.
function safeHexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const long = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  const short = long ? null : /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex.trim())
  let value: string | null = long ? long[1]! : short ? short[1]! : null
  if (!value) return null
  if (value.length === 3) value = [...value].map((c) => c + c).join('')
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  }
}

function contrastVsWhite(rgb: { r: number; g: number; b: number }): number {
  const linear = (channel: number) => {
    const v = channel / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const lum = 0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b)
  return 1.05 / (lum + 0.05)
}

// --- Autosave serialization ---------------------------------------------------

export function serializeDraft(draft: BrandBibleDraft): string {
  return JSON.stringify({ version: 1, draft })
}

/** Parse an autosaved JSON blob back into a draft; null when unusable. */
export function parseDraftJson(raw: unknown): BrandBibleDraft | null {
  if (typeof raw !== 'string') return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  const candidate =
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>)['draft'] : data
  if (typeof candidate !== 'object' || candidate === null) return null
  const merged = { ...DEFAULT_DRAFT, ...(candidate as Partial<BrandBibleDraft>) }
  for (const key of Object.keys(DEFAULT_DRAFT) as Array<keyof BrandBibleDraft>) {
    if (typeof merged[key] !== 'string') return null
  }
  return merged
}
