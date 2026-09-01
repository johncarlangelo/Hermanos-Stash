import { PDFDocument, type PDFFont, rgb, StandardFonts } from 'pdf-lib'

export interface MarkdownPdfConfig {
  pageSize: 'A4' | 'Letter'
  margin: number // in pt (e.g. 40)
  fontSize: number // base body font size (e.g. 10.5)
  lineSpacing: number // line height multiplier (e.g. 1.4)
  includePageNumbers: boolean
  title?: string
  author?: string
}

export const DEFAULT_MD_PDF_CONFIG: MarkdownPdfConfig = {
  pageSize: 'A4',
  margin: 48,
  fontSize: 10.5,
  lineSpacing: 1.4,
  includePageNumbers: true,
  title: 'Hermanos Stash Document'
}

/**
 * Word wrap plain text to fit inside maximum pixel width
 */
export function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine.length > 0 ? `${currentLine} ${word}` : word
    const testWidth = font.widthOfTextAtSize(testLine, fontSize)

    if (testWidth <= maxWidth) {
      currentLine = testLine
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }

  if (currentLine) lines.push(currentLine)
  return lines
}

/**
 * Render Markdown content to paginated PDF document bytes
 */
export async function convertMarkdownToPdf(
  markdown: string,
  config: MarkdownPdfConfig
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()

  // Dimensions
  const [pageW, pageH] = config.pageSize === 'Letter' ? [612, 792] : [595, 842]

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await doc.embedFont(StandardFonts.Courier)

  const contentW = pageW - config.margin * 2
  let currentPage = doc.addPage([pageW, pageH])
  let cursorY = pageH - config.margin

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY - neededHeight < config.margin + 20) {
      currentPage = doc.addPage([pageW, pageH])
      cursorY = pageH - config.margin
    }
  }

  // Draw optional Header Title
  if (config.title) {
    currentPage.drawText(config.title, {
      x: config.margin,
      y: cursorY,
      size: 20,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1)
    })
    cursorY -= 28

    if (config.author) {
      currentPage.drawText(config.author, {
        x: config.margin,
        y: cursorY,
        size: 10,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4)
      })
      cursorY -= 16
    }

    // Divider line
    currentPage.drawLine({
      start: { x: config.margin, y: cursorY },
      end: { x: pageW - config.margin, y: cursorY },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8)
    })
    cursorY -= 20
  }

  const rawLines = markdown.split(/\r?\n/)
  let inCodeBlock = false
  let codeBlockLines: string[] = []

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]

    // Code block toggle
    if (raw.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block, render it
        const codeText = codeBlockLines.join('\n')
        const lines = codeText.split('\n')
        const blockH = lines.length * 13 + 12
        checkPageBreak(blockH)

        currentPage.drawRectangle({
          x: config.margin,
          y: cursorY - blockH + 8,
          width: contentW,
          height: blockH,
          color: rgb(0.95, 0.95, 0.96)
        })

        let codeY = cursorY - 10
        for (const cLine of lines) {
          currentPage.drawText(cLine.slice(0, 80), {
            x: config.margin + 8,
            y: codeY,
            size: 9,
            font: fontMono,
            color: rgb(0.2, 0.2, 0.2)
          })
          codeY -= 13
        }

        cursorY -= blockH + 8
        codeBlockLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
        codeBlockLines = []
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(raw)
      continue
    }

    // Empty line / paragraph break
    if (!raw.trim()) {
      cursorY -= 10
      continue
    }

    // Heading 1 (# ...)
    if (raw.startsWith('# ')) {
      checkPageBreak(28)
      currentPage.drawText(raw.slice(2), {
        x: config.margin,
        y: cursorY,
        size: 16,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1)
      })
      cursorY -= 22
      continue
    }

    // Heading 2 (## ...)
    if (raw.startsWith('## ')) {
      checkPageBreak(24)
      currentPage.drawText(raw.slice(3), {
        x: config.margin,
        y: cursorY,
        size: 13,
        font: fontBold,
        color: rgb(0.15, 0.15, 0.15)
      })
      cursorY -= 18
      continue
    }

    // Heading 3 (### ...)
    if (raw.startsWith('### ')) {
      checkPageBreak(20)
      currentPage.drawText(raw.slice(4), {
        x: config.margin,
        y: cursorY,
        size: 11.5,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2)
      })
      cursorY -= 16
      continue
    }

    // Bullet list (* or -)
    if (raw.trim().startsWith('- ') || raw.trim().startsWith('* ')) {
      const bulletText = raw.trim().slice(2)
      const wrapped = wrapText(bulletText, contentW - 16, fontRegular, config.fontSize)

      for (let wIdx = 0; wIdx < wrapped.length; wIdx++) {
        checkPageBreak(14)
        if (wIdx === 0) {
          currentPage.drawText('•', {
            x: config.margin + 4,
            y: cursorY,
            size: config.fontSize,
            font: fontBold,
            color: rgb(0.3, 0.3, 0.3)
          })
        }
        currentPage.drawText(wrapped[wIdx], {
          x: config.margin + 16,
          y: cursorY,
          size: config.fontSize,
          font: fontRegular,
          color: rgb(0.15, 0.15, 0.15)
        })
        cursorY -= config.fontSize * config.lineSpacing
      }
      continue
    }

    // Standard Paragraph text
    const cleanText = raw.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    const wrapped = wrapText(cleanText, contentW, fontRegular, config.fontSize)

    for (const wLine of wrapped) {
      checkPageBreak(config.fontSize * config.lineSpacing)
      currentPage.drawText(wLine, {
        x: config.margin,
        y: cursorY,
        size: config.fontSize,
        font: fontRegular,
        color: rgb(0.15, 0.15, 0.15)
      })
      cursorY -= config.fontSize * config.lineSpacing
    }
  }

  // Draw Page Numbers in footer
  if (config.includePageNumbers) {
    const pages = doc.getPages()
    for (let p = 0; p < pages.length; p++) {
      const page = pages[p]
      const footerText = `${p + 1} / ${pages.length}`
      const numWidth = fontRegular.widthOfTextAtSize(footerText, 9)
      page.drawText(footerText, {
        x: (pageW - numWidth) / 2,
        y: config.margin - 24,
        size: 9,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5)
      })
    }
  }

  return await doc.save()
}
