import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { convertMarkdownToPdf, DEFAULT_MD_PDF_CONFIG, wrapText } from './logic'

describe('markdown-to-pdf logic', () => {
  it('converts markdown headings, lists, and paragraphs to valid PDF bytes', async () => {
    const md = `# Project Specification

This is a paragraph describing local-first architecture and performance benefits.

## Key Principles
- User data stays completely local on the machine
- High craft typography and accessibility
- Zero cloud API dependency

\`\`\`typescript
const app = new StashWorkstation();
app.start();
\`\`\`
`

    const pdfBytes = await convertMarkdownToPdf(md, DEFAULT_MD_PDF_CONFIG)
    expect(pdfBytes.length).toBeGreaterThan(0)

    const doc = await PDFDocument.load(pdfBytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
  })

  it('wraps text to maxWidth', async () => {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont('Helvetica')
    const lines = wrapText('The quick brown fox jumps over the lazy dog', 100, font, 12)
    expect(lines.length).toBeGreaterThan(1)
  })
})
