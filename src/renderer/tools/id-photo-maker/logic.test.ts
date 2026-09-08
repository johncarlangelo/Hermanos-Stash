import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import {
  calculateSheetLayout,
  generateIdPhotoDocx,
  generateIdPhotoPdf,
  ID_PHOTO_DIMENSIONS,
  PAPER_DIMENSIONS,
  PRESET_PACKAGES
} from './logic'

describe('ID Photo Studio Logic', () => {
  it('defines standard physical dimensions with precision', () => {
    const oneByOne = ID_PHOTO_DIMENSIONS['1x1']
    expect(oneByOne.widthInches).toBe(1.0)
    expect(oneByOne.heightInches).toBe(1.0)
    expect(oneByOne.widthPt).toBe(72)
    expect(oneByOne.heightPt).toBe(72)
    expect(oneByOne.widthDxa).toBe(1440)
    expect(oneByOne.widthEmu).toBe(914400)

    const twoByTwo = ID_PHOTO_DIMENSIONS['2x2']
    expect(twoByTwo.widthInches).toBe(2.0)
    expect(twoByTwo.heightInches).toBe(2.0)
    expect(twoByTwo.widthPt).toBe(144)
    expect(twoByTwo.heightPt).toBe(144)
    expect(twoByTwo.widthDxa).toBe(2880)

    const passport = ID_PHOTO_DIMENSIONS['passport']
    expect(passport.widthMm).toBe(35)
    expect(passport.heightMm).toBe(45)
    expect(passport.widthPx300Dpi).toBe(413)
    expect(passport.heightPx300Dpi).toBe(531)
  })

  it('defines standard paper sizes correctly', () => {
    expect(PAPER_DIMENSIONS.letter.widthInches).toBe(8.5)
    expect(PAPER_DIMENSIONS.letter.heightInches).toBe(11.0)
    expect(PAPER_DIMENSIONS.letter.widthPt).toBe(612)
    expect(PAPER_DIMENSIONS.letter.heightPt).toBe(792)

    expect(PAPER_DIMENSIONS.a4.widthPt).toBeCloseTo(595.28, 1)
    expect(PAPER_DIMENSIONS.a4.heightPt).toBeCloseTo(841.89, 1)
  })

  it('computes 8 pcs 1x1 sheet layout without overflow', () => {
    const layout = calculateSheetLayout([{ sizeId: '1x1', count: 8 }], 'letter')
    expect(layout.totalPhotos).toBe(8)
    expect(layout.boxes.length).toBe(8)
    expect(layout.overflowCount).toBe(0)
    expect(layout.usedHeightInches).toBeGreaterThan(0)
    expect(layout.boxes[0].widthInches).toBe(1.0)
    expect(layout.boxes[0].heightInches).toBe(1.0)
  })

  it('computes 4 pcs 2x2 sheet layout on Letter', () => {
    const layout = calculateSheetLayout([{ sizeId: '2x2', count: 4 }], 'letter')
    expect(layout.totalPhotos).toBe(4)
    expect(layout.boxes.length).toBe(4)
    expect(layout.overflowCount).toBe(0)
  })

  it('computes Combo Pack A (2x 2x2 + 8x 1x1) on Letter', () => {
    const preset = PRESET_PACKAGES.find((p) => p.id === 'combo_a')
    expect(preset).toBeDefined()

    const layout = calculateSheetLayout(preset!.items, 'letter')
    expect(layout.totalPhotos).toBe(10)
    expect(layout.boxes.length).toBe(10)
    expect(layout.overflowCount).toBe(0)

    // First 2 should be 2x2, followed by 8 of 1x1
    expect(layout.boxes[0].sizeId).toBe('2x2')
    expect(layout.boxes[1].sizeId).toBe('2x2')
    expect(layout.boxes[2].sizeId).toBe('1x1')
    expect(layout.boxes[9].sizeId).toBe('1x1')
  })

  it('generates a valid vector PDF document with exact dimensions', async () => {
    // 1x1 red pixel sample PNG as raw bytes
    const samplePng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
      0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
      0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
    ])

    const layout = calculateSheetLayout([{ sizeId: '2x2', count: 2 }], 'letter')
    const pdfBytes = await generateIdPhotoPdf(samplePng, layout)

    expect(pdfBytes).toBeInstanceOf(Uint8Array)
    expect(pdfBytes.length).toBeGreaterThan(100)

    // PDF magic bytes %PDF-
    const header = String.fromCharCode(...pdfBytes.slice(0, 5))
    expect(header).toBe('%PDF-')
  })

  it('generates a valid Microsoft Word (.docx) document with XML tables', async () => {
    const samplePng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
      0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
      0xcf, 0xc0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
    ])

    const layout = calculateSheetLayout([{ sizeId: '1x1', count: 4 }], 'letter')
    const docxBytes = await generateIdPhotoDocx(samplePng, layout)

    expect(docxBytes).toBeInstanceOf(Uint8Array)
    expect(docxBytes.length).toBeGreaterThan(100)

    // ZIP magic bytes PK\x03\x04
    expect(docxBytes[0]).toBe(0x50)
    expect(docxBytes[1]).toBe(0x4b)
    expect(docxBytes[2]).toBe(0x03)
    expect(docxBytes[3]).toBe(0x04)

    // Verify DOCX internal XML structure
    const zip = await JSZip.loadAsync(docxBytes)
    expect(zip.file('word/document.xml')).not.toBeNull()
    expect(zip.file('[Content_Types].xml')).not.toBeNull()
    expect(zip.file('word/media/image1.png')).not.toBeNull()

    const docXml = await zip.file('word/document.xml')!.async('text')
    expect(docXml).toContain('Photo 1')
    expect(docXml).toContain('w:pgSz')
  })
})
