export type CharSetPreset =
  'standard' | 'dense' | 'blocks' | 'binary' | 'braille' | 'minimal' | 'custom'

export const CHAR_SETS: Record<Exclude<CharSetPreset, 'custom'>, string> = {
  standard: '@%#*+=-:. ',
  dense: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ',
  blocks: '█▓▒░ ',
  binary: '10 ',
  braille: '⣿⣷⣯⣟⡿⢿⣻⣽⣾⣶⣴⣤⣠⣀ ',
  minimal: '#. '
}

export interface AsciiConvertOptions {
  width: number // Target width in columns (e.g. 80)
  charSetPreset: CharSetPreset
  customCharSet?: string
  invert: boolean
  contrast: number // -100 to 100
  brightness: number // -100 to 100
  colorMode: 'plain' | 'html' | 'ansi'
}

export const DEFAULT_ASCII_OPTIONS: AsciiConvertOptions = {
  width: 80,
  charSetPreset: 'standard',
  invert: false,
  contrast: 0,
  brightness: 0,
  colorMode: 'plain'
}

export interface PixelData {
  r: number
  g: number
  b: number
  a: number
}

/**
 * Adjust luminance value (0-255) with brightness and contrast
 */
export function adjustLuminance(lum: number, brightness: number, contrast: number): number {
  // Apply brightness
  let val = lum + (brightness * 255) / 100

  // Apply contrast
  if (contrast !== 0) {
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
    val = factor * (val - 128) + 128
  }

  return Math.min(255, Math.max(0, Math.round(val)))
}

/**
 * Map RGB pixel to ASCII character index and character
 */
export function pixelToChar(
  pixel: PixelData,
  charSet: string,
  invert: boolean,
  brightness: number,
  contrast: number
): { char: string; r: number; g: number; b: number } {
  if (pixel.a < 30) {
    return { char: ' ', r: pixel.r, g: pixel.g, b: pixel.b }
  }

  // Standard perceived luminance formula
  const rawLum = 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b
  const adjLum = adjustLuminance(rawLum, brightness, contrast)

  // Map 0-255 to charset index
  // Note: 0 is dark (dense character like @ or █), 255 is light (space)
  let normalized = adjLum / 255
  if (invert) {
    normalized = 1 - normalized
  }

  const idx = Math.min(charSet.length - 1, Math.floor(normalized * charSet.length))
  return {
    char: charSet[idx] ?? ' ',
    r: pixel.r,
    g: pixel.g,
    b: pixel.b
  }
}

/**
 * Process a 2D matrix of pixels into ASCII text or HTML representation
 */
export function convertPixelsToAscii(
  grid: PixelData[][],
  options: AsciiConvertOptions
): { text: string; html: string; ansi: string } {
  const charSet =
    options.charSetPreset === 'custom' && options.customCharSet?.length
      ? options.customCharSet
      : (CHAR_SETS[options.charSetPreset as keyof typeof CHAR_SETS] ?? CHAR_SETS.standard)

  const textLines: string[] = []
  const htmlLines: string[] = []
  const ansiLines: string[] = []

  for (let y = 0; y < grid.length; y++) {
    const row = grid[y]
    let textRow = ''
    let htmlRow = ''
    let ansiRow = ''

    for (let x = 0; x < row.length; x++) {
      const p = row[x]
      const { char, r, g, b } = pixelToChar(
        p,
        charSet,
        options.invert,
        options.brightness,
        options.contrast
      )

      textRow += char

      // HTML escape
      const escapedChar =
        char === ' ' ? '&nbsp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : char
      htmlRow += `<span style="color:rgb(${r},${g},${b})">${escapedChar}</span>`

      // ANSI 24-bit Truecolor
      ansiRow += `\x1b[38;2;${r};${g};${b}m${char}\x1b[0m`
    }

    textLines.push(textRow)
    htmlLines.push(`<div>${htmlRow}</div>`)
    ansiLines.push(ansiRow)
  }

  return {
    text: textLines.join('\n'),
    html: htmlLines.join(''),
    ansi: ansiLines.join('\n')
  }
}
