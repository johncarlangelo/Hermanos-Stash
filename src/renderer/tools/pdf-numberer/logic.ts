import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { parsePageRanges } from '../../../shared/utils/page-ranges'

export type NumberingFormat =
  'page-of-total' | 'slash-total' | 'dash-n' | 'page-n' | 'bates' | 'custom'

export type NumberPosition =
  'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface PdfNumberingConfig {
  format: NumberingFormat
  batesPrefix: string
  batesDigits: number
  customTemplate: string // e.g. "CONFIDENTIAL // Page {n} of {total}"
  position: NumberPosition
  startNumber: number
  fontSize: number
  fontFamily: 'Helvetica' | 'TimesRoman' | 'Courier'
  marginX: number
  marginY: number
  colorHex: string
  pageRangeText: string // e.g. "all" or "2-" to skip cover
}

export const DEFAULT_NUMBERING_CONFIG: PdfNumberingConfig = {
  format: 'page-of-total',
  batesPrefix: 'DOC-',
  batesDigits: 6,
  customTemplate: 'Page {n} of {total}',
  position: 'bottom-center',
  startNumber: 1,
  fontSize: 10,
  fontFamily: 'Helvetica',
  marginX: 36,
  marginY: 36,
  colorHex: '#333333',
  pageRangeText: 'all'
}

/**
 * Format page number string according to config
 */
export function formatPageString(
  pageNumber: number,
  totalPages: number,
  config: PdfNumberingConfig
): string {
  switch (config.format) {
    case 'page-of-total':
      return `Page ${pageNumber} of ${totalPages}`
    case 'slash-total':
      return `${pageNumber} / ${totalPages}`
    case 'dash-n':
      return `- ${pageNumber} -`
    case 'page-n':
      return `Page ${pageNumber}`
    case 'bates':
      return `${config.batesPrefix}${String(pageNumber).padStart(config.batesDigits, '0')}`
    case 'custom':
      return config.customTemplate
        .replace(/{n}/g, String(pageNumber))
        .replace(/{total}/g, String(totalPages))
  }
}

/**
 * Convert Hex Color to pdf-lib RGB color
 */
export function hexToPdfRgb(hex: string) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16) / 255 || 0
  const g = parseInt(clean.substring(2, 4), 16) / 255 || 0
  const b = parseInt(clean.substring(4, 6), 16) / 255 || 0
  return rgb(r, g, b)
}

/**
 * Stamp page numbers on PDF bytes
 */
export async function stampPdfPageNumbers(
  pdfBytes: ArrayBuffer,
  config: PdfNumberingConfig
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes)
  const totalPages = doc.getPageCount()

  // Resolve font
  let font = await doc.embedFont(StandardFonts.Helvetica)
  if (config.fontFamily === 'TimesRoman') {
    font = await doc.embedFont(StandardFonts.TimesRoman)
  } else if (config.fontFamily === 'Courier') {
    font = await doc.embedFont(StandardFonts.Courier)
  }

  const textColor = hexToPdfRgb(config.colorHex)

  // Determine target pages to number
  let targetPages: number[] = Array.from({ length: totalPages }, (_, i) => i + 1)
  if (config.pageRangeText.trim() && config.pageRangeText.toLowerCase() !== 'all') {
    const parsed = parsePageRanges(config.pageRangeText, totalPages)
    if ('groups' in parsed && parsed.groups.length > 0) {
      targetPages = parsed.groups.flat()
    }
  }

  const pages = doc.getPages()

  for (let i = 0; i < pages.length; i++) {
    const pageNum1Based = i + 1
    if (!targetPages.includes(pageNum1Based)) continue

    const page = pages[i]
    const { width, height } = page.getSize()

    const currentNumber = config.startNumber + (pageNum1Based - 1)
    const text = formatPageString(currentNumber, totalPages, config)
    const textWidth = font.widthOfTextAtSize(text, config.fontSize)

    let x: number
    let y: number

    // Compute X coordinate
    if (config.position.includes('left')) {
      x = config.marginX
    } else if (config.position.includes('right')) {
      x = width - config.marginX - textWidth
    } else {
      // center
      x = (width - textWidth) / 2
    }

    // Compute Y coordinate
    if (config.position.startsWith('top')) {
      y = height - config.marginY
    } else {
      // bottom
      y = config.marginY
    }

    page.drawText(text, {
      x,
      y,
      size: config.fontSize,
      font,
      color: textColor
    })
  }

  return await doc.save()
}
