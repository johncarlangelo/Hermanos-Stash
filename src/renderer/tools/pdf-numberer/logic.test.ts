import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { DEFAULT_NUMBERING_CONFIG, formatPageString, stampPdfPageNumbers } from './logic'

describe('pdf-numberer logic', () => {
  it('formats page strings accurately across templates', () => {
    expect(formatPageString(1, 10, DEFAULT_NUMBERING_CONFIG)).toBe('Page 1 of 10')

    expect(
      formatPageString(2, 5, {
        ...DEFAULT_NUMBERING_CONFIG,
        format: 'slash-total'
      })
    ).toBe('2 / 5')

    expect(
      formatPageString(42, 100, {
        ...DEFAULT_NUMBERING_CONFIG,
        format: 'bates',
        batesPrefix: 'CONF-',
        batesDigits: 6
      })
    ).toBe('CONF-000042')
  })

  it('stamps page numbers on a multi-page PDF document', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([400, 600])
    doc.addPage([400, 600])
    const bytes = await doc.save()

    const stampedBytes = await stampPdfPageNumbers(bytes.buffer as ArrayBuffer, {
      ...DEFAULT_NUMBERING_CONFIG,
      position: 'bottom-right'
    })

    expect(stampedBytes.length).toBeGreaterThan(0)
    const stampedDoc = await PDFDocument.load(stampedBytes)
    expect(stampedDoc.getPageCount()).toBe(2)
  })
})
