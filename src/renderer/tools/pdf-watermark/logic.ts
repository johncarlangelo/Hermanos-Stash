import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { parsePageRanges } from '../../../shared/utils/page-ranges'

export interface PdfWatermarkConfig {
  text: string
  fontSize: number
  rotationDegrees: number // -90 to +90
  opacity: number // 0.05 to 1.0
  colorHex: string
  tiled: boolean // single center stamp vs 3x3 repeated tile
  pageRangeText: string
}

export const DEFAULT_WATERMARK_CONFIG: PdfWatermarkConfig = {
  text: 'CONFIDENTIAL',
  fontSize: 48,
  rotationDegrees: -45,
  opacity: 0.15,
  colorHex: '#ef4444',
  tiled: false,
  pageRangeText: 'all'
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
 * Apply text watermark across target pages in PDF document
 */
export async function stampPdfWatermark(
  pdfBytes: ArrayBuffer,
  config: PdfWatermarkConfig
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes)
  const totalPages = doc.getPageCount()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const textColor = hexToPdfRgb(config.colorHex)

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
    const textWidth = font.widthOfTextAtSize(config.text, config.fontSize)

    if (config.tiled) {
      // 3x3 repeated grid
      const cols = 3
      const rows = 3
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = (width / cols) * (c + 0.5) - textWidth / 2
          const cy = (height / rows) * (r + 0.5)
          page.drawText(config.text, {
            x: cx,
            y: cy,
            size: config.fontSize * 0.7,
            font,
            color: textColor,
            opacity: config.opacity,
            rotate: degrees(config.rotationDegrees)
          })
        }
      }
    } else {
      // Single large center stamp
      const cx = width / 2 - textWidth / 2
      const cy = height / 2

      page.drawText(config.text, {
        x: cx,
        y: cy,
        size: config.fontSize,
        font,
        color: textColor,
        opacity: config.opacity,
        rotate: degrees(config.rotationDegrees)
      })
    }
  }

  return await doc.save()
}
