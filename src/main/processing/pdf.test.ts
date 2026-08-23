import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { PDFDocument, PDFRef } from 'pdf-lib'
import { isStashError } from '../../shared/errors'
import {
  compressPdf,
  getPdfInfo,
  imagesToPdf,
  mergePdfs,
  reorderPdf,
  rotatePdf,
  splitPdfPages
} from './pdf'

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'stash-pdf-'))
}

/** Build a tiny one-page PDF entirely in memory via pdf-lib itself. */
async function makePdf(dir: string, name: string, label: string): Promise<string> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([200, 100])
  page.drawText(label, { x: 10, y: 50 })
  const target = path.join(dir, name)
  await fs.writeFile(target, await doc.save())
  return target
}

/** Multi-page fixture; every page gets a distinct width so page ORDER can
 * be verified through page geometry alone (no content parsing needed). */
async function makeMultiPagePdf(dir: string, name: string, pageCount: number): Promise<string> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i += 1) {
    const width = 100 + i
    const page = doc.addPage([width, 100])
    page.drawText(`page-${i + 1}`, { x: 10, y: 50 })
  }
  const target = path.join(dir, name)
  await fs.writeFile(target, await doc.save())
  return target
}

async function writeTinyImage(
  dir: string,
  name: string,
  format: 'png' | 'jpeg',
  width = 8,
  height = 6
): Promise<string> {
  const encoder = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 30, b: 40 }
    }
  })
  const buffer = format === 'png' ? await encoder.png().toBuffer() : await encoder.jpeg().toBuffer()
  const file = path.join(dir, name)
  await fs.writeFile(file, buffer)
  return file
}

/**
 * Forge an encrypted document: pdf-lib can't encrypt, but assigning a
 * trailer-level /Encrypt reference makes it *load-time reject* exactly like
 * a real password-protected file would.
 */
async function makeEncryptedPdf(dir: string): Promise<string> {
  const doc = await PDFDocument.create()
  doc.addPage([200, 100])
  doc.context.assign(PDFRef.of(99), doc.context.obj({ Filter: 'Standard', V: 1 }))
  doc.context.trailerInfo.Encrypt = PDFRef.of(99)
  const target = path.join(dir, 'locked.pdf')
  await fs.writeFile(target, await doc.save({ useObjectStreams: false }))
  return target
}

describe('mergePdfs', () => {
  it('merges two single-page docs in order and reports size', async () => {
    const dir = await makeTempDir()
    try {
      const a = await makePdf(dir, 'a.pdf', 'alpha')
      const b = await makePdf(dir, 'b.pdf', 'beta')
      const target = path.join(dir, 'merged.pdf')

      const result = await mergePdfs([a, b], target)
      expect(result.pageCount).toBe(2)
      expect(result.bytesWritten).toBe((await fs.stat(target)).size)

      const merged = await PDFDocument.load(await fs.readFile(target))
      expect(merged.getPageCount()).toBe(2)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects encrypted inputs naming the file and suggesting removal', async () => {
    const dir = await makeTempDir()
    try {
      const open = await makePdf(dir, 'open.pdf', 'fine')
      const locked = await makeEncryptedPdf(dir)
      const err = await mergePdfs([open, locked], path.join(dir, 'out.pdf')).catch(
        (e: unknown) => e
      )
      expect(isStashError(err) && err.code === 'UNSUPPORTED').toBe(true)
      expect(isStashError(err) && /locked\.pdf/.test(err.userMessage)).toBe(true)
      expect(isStashError(err) && /protection/i.test(err.userMessage)).toBe(true)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects corrupt input with a structured error', async () => {
    const dir = await makeTempDir()
    try {
      const bad = path.join(dir, 'bad.pdf')
      await fs.writeFile(bad, '%PDF-1.4 not really a pdf')
      await expect(mergePdfs([bad], path.join(dir, 'out.pdf'))).rejects.toSatisfy(
        (err: unknown) => isStashError(err) && err.code === 'UNSUPPORTED'
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('reports missing files as read failures', async () => {
    const dir = await makeTempDir()
    try {
      const gone = path.join(dir, 'gone.pdf')
      await expect(mergePdfs([gone], path.join(dir, 'out.pdf'))).rejects.toSatisfy(
        (err: unknown) => isStashError(err) && err.code === 'FS_READ'
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('getPdfInfo', () => {
  it('returns real page count and on-disk size', async () => {
    const dir = await makeTempDir()
    try {
      const docPath = path.join(dir, 'multi.pdf')
      const doc = await PDFDocument.create()
      doc.addPage([100, 100])
      doc.addPage([100, 100])
      doc.addPage([100, 100])
      await fs.writeFile(docPath, await doc.save())

      const info = await getPdfInfo(docPath)
      expect(info.pageCount).toBe(3)
      expect(info.sizeBytes).toBe((await fs.stat(docPath)).size)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('splitPdfPages', () => {
  it('writes one output per group with the selected pages only', async () => {
    const dir = await makeTempDir()
    try {
      const docPath = path.join(dir, 'report.pdf')
      const doc = await PDFDocument.create()
      for (let i = 0; i < 5; i += 1) doc.addPage([100, 100])
      await fs.writeFile(docPath, await doc.save())

      const single = path.join(dir, 'single.pdf')
      const bytesSingle = await splitPdfPages(docPath, [4], single)
      expect(bytesSingle).toBe((await fs.stat(single)).size)

      const range = path.join(dir, 'range.pdf')
      await splitPdfPages(docPath, [1, 2, 5], range)

      expect((await PDFDocument.load(await fs.readFile(single))).getPageCount()).toBe(1)
      expect((await PDFDocument.load(await fs.readFile(range))).getPageCount()).toBe(3)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('rotatePdf', () => {
  it('rotates all pages cumulatively and persists the rotation', async () => {
    const dir = await makeTempDir()
    try {
      const input = await makeMultiPagePdf(dir, 'doc.pdf', 2)
      const target = path.join(dir, 'rotated.pdf')

      const result = await rotatePdf(input, [0, 1], 90, target)
      expect(result.rotatedCount).toBe(2)
      expect(result.bytesWritten).toBe((await fs.stat(target)).size)

      const reloaded = await PDFDocument.load(await fs.readFile(target))
      expect(reloaded.getPageCount()).toBe(2)
      expect(reloaded.getPage(0).getRotation().angle).toBe(90)
      expect(reloaded.getPage(1).getRotation().angle).toBe(90)

      // Rotating again accumulates: 90 + 180 = 270.
      await rotatePdf(target, [0, 1], 180, path.join(dir, 'rotated-again.pdf'))
      const twice = await PDFDocument.load(await fs.readFile(path.join(dir, 'rotated-again.pdf')))
      expect(twice.getPage(0).getRotation().angle).toBe(270)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rotates only the requested subset, leaving others untouched', async () => {
    const dir = await makeTempDir()
    try {
      const input = await makeMultiPagePdf(dir, 'doc.pdf', 3)
      const target = path.join(dir, 'subset.pdf')

      const result = await rotatePdf(input, [1], 90, target)

      expect(result.rotatedCount).toBe(1)
      const reloaded = await PDFDocument.load(await fs.readFile(target))
      expect(reloaded.getPage(0).getRotation().angle).toBe(0)
      expect(reloaded.getPage(1).getRotation().angle).toBe(90)
      expect(reloaded.getPage(2).getRotation().angle).toBe(0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('wraps rotation onto already-rotated pages without going past 359', async () => {
    const dir = await makeTempDir()
    try {
      const input = await makeMultiPagePdf(dir, 'doc.pdf', 1)
      // Give the source page a pre-existing 90° base rotation.
      const preset = await PDFDocument.load(await fs.readFile(input))
      const { degrees } = await import('pdf-lib')
      preset.getPage(0).setRotation(degrees(90))
      await fs.writeFile(input, await preset.save())
      const target = path.join(dir, 'wrapped.pdf')

      await rotatePdf(input, [0], 270, target)
      const reloaded = await PDFDocument.load(await fs.readFile(target))
      expect(reloaded.getPage(0).getRotation().angle).toBe(0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('compressPdf', () => {
  it('round-trips a document losslessly with the same page count', async () => {
    const dir = await makeTempDir()
    try {
      const input = await makeMultiPagePdf(dir, 'doc.pdf', 4)
      const target = path.join(dir, 'compressed.pdf')

      const result = await compressPdf(input, target)
      expect(result.pageCount).toBe(4)
      expect(result.bytesWritten).toBe((await fs.stat(target)).size)

      const reloaded = await PDFDocument.load(await fs.readFile(target))
      expect(reloaded.getPageCount()).toBe(4)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects invalid documents like every other pdf service', async () => {
    const dir = await makeTempDir()
    try {
      const bad = path.join(dir, 'bad.pdf')
      await fs.writeFile(bad, '%PDF-1.4 not a real pdf')
      await expect(compressPdf(bad, path.join(dir, 'out.pdf'))).rejects.toSatisfy(
        (err: unknown) => isStashError(err) && err.code === 'UNSUPPORTED'
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('reorderPdf', () => {
  it('copies pages in the exact sequence order given', async () => {
    const dir = await makeTempDir()
    try {
      const input = await makeMultiPagePdf(dir, 'doc.pdf', 4)
      const target = path.join(dir, 'reordered.pdf')

      const result = await reorderPdf(input, [3, 1], target)
      expect(result.pageCount).toBe(2)
      expect(result.bytesWritten).toBe((await fs.stat(target)).size)

      // Source page i has width 100+i, so geometry proves the order: 3 then 1.
      const reloaded = await PDFDocument.load(await fs.readFile(target))
      expect(reloaded.getPage(0).getSize().width).toBe(102)
      expect(reloaded.getPage(1).getSize().width).toBe(100)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('produces an output as long as the requested sequence', async () => {
    const dir = await makeTempDir()
    try {
      const input = await makeMultiPagePdf(dir, 'doc.pdf', 5)
      const target = path.join(dir, 'reversed.pdf')

      const result = await reorderPdf(input, [5, 4, 3, 2, 1], target)
      const reloaded = await PDFDocument.load(await fs.readFile(target))
      expect(result.pageCount).toBe(5)
      expect(reloaded.getPageCount()).toBe(5)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects out-of-range pages with a structured error', async () => {
    const dir = await makeTempDir()
    try {
      const input = await makeMultiPagePdf(dir, 'doc.pdf', 2)
      await expect(reorderPdf(input, [1, 9], path.join(dir, 'out.pdf'))).rejects.toSatisfy(
        (err: unknown) => isStashError(err) && err.code === 'VALIDATION'
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('imagesToPdf', () => {
  it('builds one natural-size page per image in order', async () => {
    const dir = await makeTempDir()
    try {
      const png = await writeTinyImage(dir, 'a.png', 'png', 8, 6)
      const jpg = await writeTinyImage(dir, 'b.jpg', 'jpeg', 10, 4)
      const target = path.join(dir, 'album.pdf')

      const result = await imagesToPdf([png, jpg], target)
      expect(result.pageCount).toBe(2)
      expect(result.bytesWritten).toBe((await fs.stat(target)).size)

      const reloaded = await PDFDocument.load(await fs.readFile(target))
      expect(reloaded.getPageCount()).toBe(2)
      // Natural-size full-bleed pages.
      expect(reloaded.getPage(0).getSize().width).toBe(8)
      expect(reloaded.getPage(0).getSize().height).toBe(6)
      expect(reloaded.getPage(1).getSize().width).toBe(10)
      expect(reloaded.getPage(1).getSize().height).toBe(4)
      // One embedded image object per page in the raw document.
      const raw = await fs.readFile(target)
      const imageObjects = String(raw).match(/\/Subtype\s*\/Image/g) ?? []
      expect(imageObjects.length).toBe(2)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('accepts .jpeg alongside .jpg and .png', async () => {
    const dir = await makeTempDir()
    try {
      const jpeg = await writeTinyImage(dir, 'c.jpeg', 'jpeg')
      const png = await writeTinyImage(dir, 'd.png', 'png')
      const target = path.join(dir, 'out.pdf')

      const result = await imagesToPdf([jpeg, png], target)
      expect(result.pageCount).toBe(2)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects unsupported extensions before touching disk', async () => {
    const dir = await makeTempDir()
    try {
      await expect(
        imagesToPdf([path.join(dir, 'e.gif')], path.join(dir, 'out.pdf'))
      ).rejects.toSatisfy((err: unknown) => isStashError(err) && err.code === 'VALIDATION')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects corrupt image bytes with a structured error', async () => {
    const dir = await makeTempDir()
    try {
      const bad = path.join(dir, 'broken.png')
      await fs.writeFile(bad, Buffer.from('definitely not a png'))
      await expect(imagesToPdf([bad], path.join(dir, 'out.pdf'))).rejects.toSatisfy(
        (err: unknown) => isStashError(err) && err.code === 'UNSUPPORTED'
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
