import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PDFDocument, PDFRef } from 'pdf-lib'
import { isStashError } from '../../shared/errors'
import { getPdfInfo, mergePdfs, splitPdfPages } from './pdf'

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
