import { getFont, type AsciiFont } from './fonts'

export type BorderStyle = 'none' | 'single' | 'double' | 'rounded' | 'stars' | 'hash' | 'dots'

export interface BannerOptions {
  font: string
  border: BorderStyle
  letterSpacing: number // extra spaces between letters (0 to 3)
  paddingX: number // horizontal padding inside border (0 to 6)
  paddingY: number // vertical padding inside border (0 to 4)
  align: 'left' | 'center' | 'right'
}

export const DEFAULT_BANNER_OPTIONS: BannerOptions = {
  font: 'standard',
  border: 'single',
  letterSpacing: 0,
  paddingX: 2,
  paddingY: 1,
  align: 'center'
}

/**
 * Render multi-line raw ASCII banner from string
 */
export function renderRawBanner(text: string, fontName: string, letterSpacing = 0): string[] {
  const font: AsciiFont = getFont(fontName)
  const lines = text.split('\n')
  const resultLines: string[] = []

  for (let l = 0; l < lines.length; l++) {
    const rawLine = lines[l].toUpperCase()
    if (!rawLine.trim()) {
      // Empty input line adds an empty block spacing
      for (let i = 0; i < font.height; i++) resultLines.push('')
      continue
    }

    const rowBuffers: string[] = Array.from({ length: font.height }, () => '')

    for (let c = 0; c < rawLine.length; c++) {
      const char = rawLine[c]
      const charRows = font.chars[char] ?? font.chars['?'] ?? Array(font.height).fill('   ')

      for (let r = 0; r < font.height; r++) {
        rowBuffers[r] += charRows[r] + ' '.repeat(letterSpacing)
      }
    }

    resultLines.push(...rowBuffers)
  }

  return resultLines
}

/**
 * Frame lines with decorative borders
 */
export function frameBanner(lines: string[], options: BannerOptions): string {
  if (lines.length === 0) return ''

  const maxLineWidth = Math.max(...lines.map((l) => l.length), 0)
  const innerWidth = maxLineWidth + options.paddingX * 2

  const alignedLines = lines.map((line) => {
    const remaining = innerWidth - line.length - options.paddingX * 2
    if (remaining <= 0) {
      return ' '.repeat(options.paddingX) + line + ' '.repeat(options.paddingX)
    }

    if (options.align === 'center') {
      const leftPad = Math.floor(remaining / 2) + options.paddingX
      const rightPad = remaining - Math.floor(remaining / 2) + options.paddingX
      return ' '.repeat(leftPad) + line + ' '.repeat(rightPad)
    } else if (options.align === 'right') {
      return ' '.repeat(remaining + options.paddingX) + line + ' '.repeat(options.paddingX)
    } else {
      return ' '.repeat(options.paddingX) + line + ' '.repeat(remaining + options.paddingX)
    }
  })

  // Add vertical padding lines
  const emptyRow = ' '.repeat(innerWidth)
  const paddedContent: string[] = []
  for (let i = 0; i < options.paddingY; i++) paddedContent.push(emptyRow)
  paddedContent.push(...alignedLines)
  for (let i = 0; i < options.paddingY; i++) paddedContent.push(emptyRow)

  if (options.border === 'none') {
    return paddedContent.join('\n')
  }

  // Border characters map
  const borders: Record<
    Exclude<BorderStyle, 'none'>,
    { tl: string; tr: string; bl: string; br: string; h: string; v: string }
  > = {
    single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    stars: { tl: '★', tr: '★', bl: '★', br: '★', h: '★', v: '★' },
    hash: { tl: '#', tr: '#', bl: '#', br: '#', h: '#', v: '#' },
    dots: { tl: '•', tr: '•', bl: '•', br: '•', h: '•', v: '•' }
  }

  const b = borders[options.border]
  const top = b.tl + b.h.repeat(innerWidth) + b.tr
  const bottom = b.bl + b.h.repeat(innerWidth) + b.br
  const body = paddedContent.map((row) => b.v + row + b.v)

  return [top, ...body, bottom].join('\n')
}

/**
 * Generate ASCII banner end-to-end
 */
export function generateAsciiBanner(text: string, options: BannerOptions): string {
  if (!text || !text.trim()) return ''
  const rawLines = renderRawBanner(text, options.font, options.letterSpacing)
  return frameBanner(rawLines, options)
}
