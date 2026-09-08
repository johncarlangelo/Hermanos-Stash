import { PDFDocument, rgb } from 'pdf-lib'
import JSZip from 'jszip'

export type IdPhotoSizeId = '1x1' | '2x2' | 'passport' | '1.5x1.5'

export interface IdPhotoDimension {
  id: IdPhotoSizeId
  name: string
  label: string
  widthInches: number
  heightInches: number
  widthMm: number
  heightMm: number
  widthPt: number // 72 pt/in for PDF
  heightPt: number
  widthPx300Dpi: number // 300 DPI
  heightPx300Dpi: number
  widthDxa: number // 1440 DXA/in for Word DOCX
  heightDxa: number
  widthEmu: number // 914400 EMU/in for DrawingML in Word
  heightEmu: number
}

export const ID_PHOTO_DIMENSIONS: Record<IdPhotoSizeId, IdPhotoDimension> = {
  '1x1': {
    id: '1x1',
    name: '1x1 Inch',
    label: '1" × 1" (25.4 × 25.4 mm)',
    widthInches: 1.0,
    heightInches: 1.0,
    widthMm: 25.4,
    heightMm: 25.4,
    widthPt: 72,
    heightPt: 72,
    widthPx300Dpi: 300,
    heightPx300Dpi: 300,
    widthDxa: 1440,
    heightDxa: 1440,
    widthEmu: 914400,
    heightEmu: 914400
  },
  '2x2': {
    id: '2x2',
    name: '2x2 Inch',
    label: '2" × 2" (50.8 × 50.8 mm)',
    widthInches: 2.0,
    heightInches: 2.0,
    widthMm: 50.8,
    heightMm: 50.8,
    widthPt: 144,
    heightPt: 144,
    widthPx300Dpi: 600,
    heightPx300Dpi: 600,
    widthDxa: 2880,
    heightDxa: 2880,
    widthEmu: 1828800,
    heightEmu: 1828800
  },
  passport: {
    id: 'passport',
    name: 'Passport Size',
    label: '35 × 45 mm (1.38" × 1.77")',
    widthInches: 35 / 25.4, // ~1.378 in
    heightInches: 45 / 25.4, // ~1.772 in
    widthMm: 35,
    heightMm: 45,
    widthPt: (35 / 25.4) * 72, // 99.21 pt
    heightPt: (45 / 25.4) * 72, // 127.56 pt
    widthPx300Dpi: Math.round((35 / 25.4) * 300), // 413 px
    heightPx300Dpi: Math.round((45 / 25.4) * 300), // 531 px
    widthDxa: Math.round((35 / 25.4) * 1440), // 1984 dxa
    heightDxa: Math.round((45 / 25.4) * 1440), // 2551 dxa
    widthEmu: Math.round((35 / 25.4) * 914400),
    heightEmu: Math.round((45 / 25.4) * 914400)
  },
  '1.5x1.5': {
    id: '1.5x1.5',
    name: '1.5x1.5 Inch',
    label: '1.5" × 1.5" (38.1 × 38.1 mm)',
    widthInches: 1.5,
    heightInches: 1.5,
    widthMm: 38.1,
    heightMm: 38.1,
    widthPt: 108,
    heightPt: 108,
    widthPx300Dpi: 450,
    heightPx300Dpi: 450,
    widthDxa: 2160,
    heightDxa: 2160,
    widthEmu: 1371600,
    heightEmu: 1371600
  }
}

export type PaperSizeId = 'letter' | 'a4' | '4x6'

export interface PaperDimension {
  id: PaperSizeId
  name: string
  label: string
  widthInches: number
  heightInches: number
  widthPt: number
  heightPt: number
  widthPx300Dpi: number
  heightPx300Dpi: number
  widthDxa: number
  heightDxa: number
}

export const PAPER_DIMENSIONS: Record<PaperSizeId, PaperDimension> = {
  letter: {
    id: 'letter',
    name: 'US Letter',
    label: '8.5" × 11" (215.9 × 279.4 mm)',
    widthInches: 8.5,
    heightInches: 11.0,
    widthPt: 612,
    heightPt: 792,
    widthPx300Dpi: 2550,
    heightPx300Dpi: 3300,
    widthDxa: 12240,
    heightDxa: 15840
  },
  a4: {
    id: 'a4',
    name: 'A4',
    label: '8.27" × 11.69" (210 × 297 mm)',
    widthInches: 210 / 25.4,
    heightInches: 297 / 25.4,
    widthPt: (210 / 25.4) * 72, // 595.28 pt
    heightPt: (297 / 25.4) * 72, // 841.89 pt
    widthPx300Dpi: 2480,
    heightPx300Dpi: 3508,
    widthDxa: Math.round((210 / 25.4) * 1440),
    heightDxa: Math.round((297 / 25.4) * 1440)
  },
  '4x6': {
    id: '4x6',
    name: '4x6 Photo Card',
    label: '4" × 6" (101.6 × 152.4 mm)',
    widthInches: 4.0,
    heightInches: 6.0,
    widthPt: 288,
    heightPt: 432,
    widthPx300Dpi: 1200,
    heightPx300Dpi: 1800,
    widthDxa: 5760,
    heightDxa: 8640
  }
}

export type PresetPackageId =
  '8_1x1' | '4_2x2' | '6_passport' | 'combo_a' | 'combo_b' | 'combo_c' | 'custom'

export interface PresetPackage {
  id: PresetPackageId
  name: string
  description: string
  items: Array<{ sizeId: IdPhotoSizeId; count: number }>
}

export const PRESET_PACKAGES: PresetPackage[] = [
  {
    id: '8_1x1',
    name: '8 pcs 1x1 Inch',
    description: '8 copies of 1" × 1" photos (Standard school/ID requirement)',
    items: [{ sizeId: '1x1', count: 8 }]
  },
  {
    id: '4_2x2',
    name: '4 pcs 2x2 Inch',
    description: '4 copies of 2" × 2" photos (US/PH Visa, Passport, Exam)',
    items: [{ sizeId: '2x2', count: 4 }]
  },
  {
    id: '6_passport',
    name: '6 pcs Passport (35×45mm)',
    description: '6 copies of 35×45mm photos (International/Schengen/DFA)',
    items: [{ sizeId: 'passport', count: 6 }]
  },
  {
    id: 'combo_a',
    name: 'Combo Pack A (2x 2x2 + 8x 1x1)',
    description: '2 pcs 2x2" + 8 pcs 1x1" (Most popular job/school application set)',
    items: [
      { sizeId: '2x2', count: 2 },
      { sizeId: '1x1', count: 8 }
    ]
  },
  {
    id: 'combo_b',
    name: 'Combo Pack B (4x 2x2 + 4x 1x1)',
    description: '4 pcs 2x2" + 4 pcs 1x1"',
    items: [
      { sizeId: '2x2', count: 4 },
      { sizeId: '1x1', count: 4 }
    ]
  },
  {
    id: 'combo_c',
    name: 'Combo Pack C (2x 2x2 + 4x Passport + 4x 1x1)',
    description: '2 pcs 2x2" + 4 pcs Passport + 4 pcs 1x1" (Complete universal set)',
    items: [
      { sizeId: '2x2', count: 2 },
      { sizeId: 'passport', count: 4 },
      { sizeId: '1x1', count: 4 }
    ]
  }
]

export interface LayoutBox {
  sizeId: IdPhotoSizeId
  index: number
  xInches: number
  yInches: number
  widthInches: number
  heightInches: number
}

export interface SheetLayoutResult {
  paper: PaperDimension
  boxes: LayoutBox[]
  totalPhotos: number
  usedHeightInches: number
  overflowCount: number
}

/**
 * Calculates row-based packing layout for a list of photos onto a given paper size.
 * Places larger photos first (or preserves sequence) within standard printable margins.
 */
export function calculateSheetLayout(
  items: Array<{ sizeId: IdPhotoSizeId; count: number }>,
  paperId: PaperSizeId = 'letter',
  options?: {
    marginInches?: number
    gapInches?: number
  }
): SheetLayoutResult {
  const paper = PAPER_DIMENSIONS[paperId]
  const margin = options?.marginInches ?? 0.5 // 0.5 inch margins
  const gap = options?.gapInches ?? 0.15 // 0.15 inch gap (~3.8mm)

  const maxW = paper.widthInches - margin * 2
  const maxH = paper.heightInches - margin * 2

  const flatList: IdPhotoSizeId[] = []
  for (const item of items) {
    for (let i = 0; i < item.count; i++) {
      flatList.push(item.sizeId)
    }
  }

  const boxes: LayoutBox[] = []
  let currentX = margin
  let currentY = margin
  let rowMaxHeight = 0
  let overflowCount = 0

  flatList.forEach((sizeId, idx) => {
    const dim = ID_PHOTO_DIMENSIONS[sizeId]

    // Check if item fits in current row
    if (currentX + dim.widthInches > margin + maxW + 0.001) {
      // Move to next row
      currentX = margin
      currentY += rowMaxHeight + gap
      rowMaxHeight = 0
    }

    // Check vertical overflow
    if (currentY + dim.heightInches > margin + maxH + 0.001) {
      overflowCount++
      return
    }

    boxes.push({
      sizeId,
      index: idx,
      xInches: currentX,
      yInches: currentY,
      widthInches: dim.widthInches,
      heightInches: dim.heightInches
    })

    currentX += dim.widthInches + gap
    if (dim.heightInches > rowMaxHeight) {
      rowMaxHeight = dim.heightInches
    }
  })

  const usedHeight = boxes.length > 0 ? currentY + rowMaxHeight - margin : 0

  return {
    paper,
    boxes,
    totalPhotos: boxes.length,
    usedHeightInches: usedHeight,
    overflowCount
  }
}

export interface PhotoAdjustmentConfig {
  zoom: number // 1.0 = default 100%, up to 2.5
  panX: number // offset in pixels or percentage
  panY: number
  backgroundColor: 'original' | 'white' | 'offwhite' | 'skyblue' | 'red'
  showNametag: boolean
  nametagText: string
  showCuttingGuide: boolean
}

export const DEFAULT_ADJUSTMENT_CONFIG: PhotoAdjustmentConfig = {
  zoom: 1.0,
  panX: 0,
  panY: 0,
  backgroundColor: 'original',
  showNametag: false,
  nametagText: '',
  showCuttingGuide: true
}

export const BG_COLORS: Record<string, string> = {
  white: '#ffffff',
  offwhite: '#f4f4f5',
  skyblue: '#38bdf8',
  red: '#dc2626'
}

/**
 * Renders a single cropped, adjusted portrait photo onto an HTML canvas at the specified pixel size.
 */
export function renderProcessedPhotoCanvas(
  img: HTMLImageElement | HTMLCanvasElement,
  targetWidthPx: number,
  targetHeightPx: number,
  config: PhotoAdjustmentConfig
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidthPx
  canvas.height = targetHeightPx
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // Fill optional background color
  if (config.backgroundColor !== 'original' && BG_COLORS[config.backgroundColor]) {
    ctx.fillStyle = BG_COLORS[config.backgroundColor]
    ctx.fillRect(0, 0, targetWidthPx, targetHeightPx)
  }

  // Calculate cover aspect ratio
  const imgW = img.width
  const imgH = img.height
  const targetRatio = targetWidthPx / targetHeightPx
  const imgRatio = imgW / imgH

  let renderW: number
  let renderH: number

  if (imgRatio > targetRatio) {
    // Image is wider than target -> match height
    renderH = targetHeightPx * config.zoom
    renderW = renderH * imgRatio
  } else {
    // Image is taller than target -> match width
    renderW = targetWidthPx * config.zoom
    renderH = renderW / imgRatio
  }

  const posX = (targetWidthPx - renderW) / 2 + config.panX
  const posY = (targetHeightPx - renderH) / 2 + config.panY

  ctx.drawImage(img, posX, posY, renderW, renderH)

  // Render bottom nametag strip if enabled
  if (config.showNametag && config.nametagText.trim()) {
    const bannerHeight = Math.round(targetHeightPx * 0.16) // ~16% height banner
    const bannerY = targetHeightPx - bannerHeight

    // White rectangle background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, bannerY, targetWidthPx, bannerHeight)

    // Top border line for nametag
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = Math.max(1, Math.round(targetHeightPx * 0.004))
    ctx.beginPath()
    ctx.moveTo(0, bannerY)
    ctx.lineTo(targetWidthPx, bannerY)
    ctx.stroke()

    // Black bold centered text
    ctx.fillStyle = '#000000'
    const fontSize = Math.max(9, Math.round(bannerHeight * 0.52))
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const cleanText = config.nametagText.trim().toUpperCase()
    ctx.fillText(cleanText, targetWidthPx / 2, bannerY + bannerHeight / 2)
  }

  // Draw cutting guide hairline border if enabled
  if (config.showCuttingGuide) {
    ctx.strokeStyle = '#d4d4d8'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, targetWidthPx - 1, targetHeightPx - 1)
  }

  return canvas
}

/**
 * Generates a ready-to-print vector PDF via pdf-lib with exact real-world dimensions.
 */
export async function generateIdPhotoPdf(
  croppedPhotoPngBytes: Uint8Array,
  layout: SheetLayoutResult,
  options?: { showHairlineBorder?: boolean }
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([layout.paper.widthPt, layout.paper.heightPt])
  const embeddedImage = await doc.embedPng(croppedPhotoPngBytes)

  const showBorder = options?.showHairlineBorder ?? true

  for (const box of layout.boxes) {
    // In pdf-lib, (0,0) is bottom-left
    const xPt = box.xInches * 72
    const yPt = layout.paper.heightPt - (box.yInches + box.heightInches) * 72
    const wPt = box.widthInches * 72
    const hPt = box.heightInches * 72

    page.drawImage(embeddedImage, {
      x: xPt,
      y: yPt,
      width: wPt,
      height: hPt
    })

    if (showBorder) {
      page.drawRectangle({
        x: xPt,
        y: yPt,
        width: wPt,
        height: hPt,
        borderColor: rgb(0.82, 0.82, 0.84),
        borderWidth: 0.5
      })
    }
  }

  return doc.save()
}

/**
 * Generates a standard Microsoft Word (.docx) package with exact dimensions.
 */
export async function generateIdPhotoDocx(
  croppedPhotoPngBytes: Uint8Array,
  layout: SheetLayoutResult
): Promise<Uint8Array> {
  const zip = new JSZip()
  const paper = layout.paper

  // 1. [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  )

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  )

  // 3. word/media/image1.png
  zip.file('word/media/image1.png', croppedPhotoPngBytes)

  // 4. word/_rels/document.xml.rels
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`
  )

  // Group layout boxes into rows based on y coordinate
  const rows: LayoutBox[][] = []
  let currentRow: LayoutBox[] = []
  let lastY = -1

  for (const box of layout.boxes) {
    if (lastY < 0 || Math.abs(box.yInches - lastY) > 0.05) {
      if (currentRow.length > 0) rows.push(currentRow)
      currentRow = [box]
      lastY = box.yInches
    } else {
      currentRow.push(box)
    }
  }
  if (currentRow.length > 0) rows.push(currentRow)

  // 5. word/document.xml
  let docBodyXml = ''

  rows.forEach((row, rowIdx) => {
    let rowDrawingsXml = ''
    row.forEach((box, cellIdx) => {
      const dim = ID_PHOTO_DIMENSIONS[box.sizeId]
      const docPrId = rowIdx * 20 + cellIdx + 1

      rowDrawingsXml += `
        <w:r>
          <w:drawing>
            <wp:inline distT="0" distB="0" distL="72000" distR="72000">
              <wp:extent cx="${dim.widthEmu}" cy="${dim.heightEmu}"/>
              <wp:docPr id="${docPrId}" name="Photo ${docPrId}"/>
              <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:nvPicPr>
                      <pic:cNvPr id="${docPrId}" name="Photo ${docPrId}.png"/>
                      <pic:cNvPicPr/>
                    </pic:nvPicPr>
                    <pic:blipFill>
                      <a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdImg1"/>
                      <a:stretch><a:fillRect/></a:stretch>
                    </pic:blipFill>
                    <pic:spPr>
                      <a:xfrm>
                        <a:off x="0" y="0"/>
                        <a:ext cx="${dim.widthEmu}" cy="${dim.heightEmu}"/>
                      </a:xfrm>
                      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                      <a:ln w="6350">
                        <a:solidFill><a:srgbClr val="D4D4D8"/></a:solidFill>
                      </a:ln>
                    </pic:spPr>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>`
    })

    docBodyXml += `
      <w:p>
        <w:pPr>
          <w:spacing w:before="120" w:after="120" w:line="240" w:lineRule="auto"/>
        </w:pPr>
        ${rowDrawingsXml}
      </w:p>`
  })

  // Section properties (paper size & margins in DXA)
  const sectPrXml = `
    <w:sectPr>
      <w:pgSz w:w="${paper.widthDxa}" w:h="${paper.heightDxa}"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="0" w:footer="0" w:gutter="0"/>
    </w:sectPr>`

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${docBodyXml}
    ${sectPrXml}
  </w:body>
</w:document>`
  )

  return zip.generateAsync({ type: 'uint8array' })
}

/**
 * Renders the full printable sheet onto a 300 DPI Canvas.
 */
export function renderSheet300DpiCanvas(
  croppedPhotoImg: HTMLImageElement | HTMLCanvasElement,
  layout: SheetLayoutResult,
  showGuides: boolean = true
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = layout.paper.widthPx300Dpi
  canvas.height = layout.paper.heightPx300Dpi
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // Crisp white paper background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (const box of layout.boxes) {
    const xPx = Math.round(box.xInches * 300)
    const yPx = Math.round(box.yInches * 300)
    const wPx = Math.round(box.widthInches * 300)
    const hPx = Math.round(box.heightInches * 300)

    ctx.drawImage(croppedPhotoImg, xPx, yPx, wPx, hPx)

    if (showGuides) {
      ctx.strokeStyle = '#d4d4d8'
      ctx.lineWidth = 2
      ctx.strokeRect(xPx + 1, yPx + 1, wPx - 2, hPx - 2)
    }
  }

  return canvas
}
