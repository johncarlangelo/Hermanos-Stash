import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { DEFAULT_WATERMARK_CONFIG, stampPdfWatermark } from './logic'

describe('pdf-watermark logic', () => {
  it('stamps watermark onto PDF document', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([500, 700])
    const bytes = await doc.save()

    const result = await stampPdfWatermark(bytes.buffer as ArrayBuffer, {
      ...DEFAULT_WATERMARK_CONFIG,
      text: 'DRAFT',
      tiled: false
    })

    expect(result.length).toBeGreaterThan(0)
    const stampedDoc = await PDFDocument.load(result)
    expect(stampedDoc.getPageCount()).toBe(1)
  })

  it('handles tiled watermark stamping', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([500, 700])
    const bytes = await doc.save()

    const result = await stampPdfWatermark(bytes.buffer as ArrayBuffer, {
      ...DEFAULT_WATERMARK_CONFIG,
      text: 'INTERNAL USE',
      tiled: true
    })

    expect(result.length).toBeGreaterThan(0)
  })
})
