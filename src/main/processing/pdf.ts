import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, degrees } from 'pdf-lib'
import { isStashError, stashError } from '../../shared/errors'

/**
 * PDF manipulation over pdf-lib (AGENTS.md principle 12 — a mature library
 * for a difficult format). Every function takes file paths in and writes
 * files out, reporting written byte sizes so callers never need a second
 * stat pass.
 */

/** Total uncompressed input accepted for one merge (matches the ZIP guard). */
export const PDF_INPUT_LIMIT_BYTES = 512 * 1024 * 1024

function wrapLoadError(err: unknown, sourceName: string): never {
  if (isStashError(err)) throw err
  const message = String((err as Error)?.message ?? err)
  if ((err as Error)?.name === 'EncryptedPDFError' || /encrypt/i.test(message)) {
    throw stashError(
      'UNSUPPORTED',
      `"${sourceName}" is password-protected. Remove the protection first, then try again.`,
      { technicalMessage: message }
    )
  }
  throw stashError('UNSUPPORTED', `"${sourceName}" isn't a valid or uncorrupted PDF.`, {
    technicalMessage: message
  })
}

async function loadPdf(filePath: string): Promise<PDFDocument> {
  const name = path.basename(filePath)
  let bytes: Buffer
  try {
    bytes = await fs.readFile(filePath)
  } catch (err) {
    throw stashError('FS_READ', `"${name}" could not be found or opened.`, {
      technicalMessage: String((err as Error)?.message ?? err)
    })
  }
  try {
    const doc = await PDFDocument.load(bytes)
    // pdf-lib parses leniently — force page-tree access so structurally
    // broken documents surface here instead of mid-merge.
    doc.getPageIndices()
    return doc
  } catch (err) {
    wrapLoadError(err, name)
  }
}

/**
 * Merge documents in order into one target PDF. Encrypted inputs are
 * rejected with an actionable error naming the offending file.
 */
export async function mergePdfs(
  paths: string[],
  targetPath: string
): Promise<{ bytesWritten: number; pageCount: number }> {
  const merged = await PDFDocument.create()
  let pageCount = 0
  for (const filePath of paths) {
    const source = await loadPdf(filePath)
    const indices = source.getPageIndices()
    const copied = await merged.copyPages(source, indices)
    for (const page of copied) merged.addPage(page)
    pageCount += copied.length
  }
  if (pageCount === 0) {
    throw stashError('VALIDATION', 'The selected documents contain no pages to merge.')
  }
  const bytes = await merged.save()
  await fs.writeFile(targetPath, bytes)
  const stat = await fs.stat(targetPath)
  return { bytesWritten: stat.size, pageCount }
}

/** Page count plus on-disk size for one document. */
export async function getPdfInfo(path: string): Promise<{ pageCount: number; sizeBytes: number }> {
  const doc = await loadPdf(path)
  return { pageCount: doc.getPageCount(), sizeBytes: (await fs.stat(path)).size }
}

/**
 * Write one output PDF containing `pages` (1-based, ascending) taken from
 * the input document.
 */
export async function splitPdfPages(
  inputPath: string,
  pages: number[],
  outputPath: string
): Promise<number> {
  const source = await loadPdf(inputPath)
  const out = await PDFDocument.create()
  // Parser guarantees valid 1-based pages, but re-map defensively.
  const indices = pages
    .filter((page) => page >= 1 && page <= source.getPageCount())
    .map((page) => page - 1)
  const copied = await out.copyPages(source, indices)
  for (const page of copied) out.addPage(page)
  const bytes = await out.save()
  await fs.writeFile(outputPath, bytes)
  return bytes.byteLength
}

/**
 * Rotate the given 0-based page indices clockwise by `angleDeg`, writing a
 * new document to `targetPath`. Rotation is cumulative with any rotation the
 * pages already carry (existing + angle, wrapped mod 360).
 */
export async function rotatePdf(
  inputPath: string,
  pageIndices0based: number[],
  angleDeg: 90 | 180 | 270,
  targetPath: string
): Promise<{ bytesWritten: number; rotatedCount: number }> {
  const source = await loadPdf(inputPath)
  if (source.getPageCount() === 0) {
    throw stashError('VALIDATION', 'The selected document has no pages to rotate.')
  }
  const pageCount = source.getPageCount()
  const targets = new Set(pageIndices0based.filter((index) => index >= 0 && index < pageCount))
  for (const index of targets) {
    const page = source.getPages()[index]!
    const current = page.getRotation().angle
    page.setRotation(degrees((((current + angleDeg) % 360) + 360) % 360))
  }
  const bytes = await source.save()
  await fs.writeFile(targetPath, bytes)
  return { bytesWritten: bytes.byteLength, rotatedCount: targets.size }
}

/**
 * Lossless structural optimization only: the document is re-serialized with
 * object streams. No images are downsampled and no content is discarded —
 * output may legitimately be larger than the input.
 */
export async function compressPdf(
  inputPath: string,
  targetPath: string
): Promise<{ bytesWritten: number; pageCount: number }> {
  const doc = await loadPdf(inputPath)
  const pageCount = doc.getPageCount()
  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false })
  await fs.writeFile(targetPath, bytes)
  return { bytesWritten: bytes.byteLength, pageCount }
}

/**
 * Build a new PDF copying pages in exactly the parsed sequence order —
 * "3,1" puts page 3 first. The sequence length defines the output length.
 */
export async function reorderPdf(
  inputPath: string,
  pages1based: number[],
  targetPath: string
): Promise<{ bytesWritten: number; pageCount: number }> {
  const source = await loadPdf(inputPath)
  if (pages1based.length === 0) {
    throw stashError('VALIDATION', 'Enter at least one page to arrange.')
  }
  const pageCount = source.getPageCount()
  const indices = []
  for (const page of pages1based) {
    if (!Number.isInteger(page) || page < 1 || page > pageCount) {
      throw stashError('VALIDATION', `"${page}" exceeds this document's ${pageCount} pages.`)
    }
    indices.push(page - 1)
  }
  const out = await PDFDocument.create()
  const copied = await out.copyPages(source, indices)
  for (const page of copied) out.addPage(page)
  const bytes = await out.save()
  await fs.writeFile(targetPath, bytes)
  return { bytesWritten: bytes.byteLength, pageCount: copied.length }
}

/** Extensions accepted by `imagesToPdf`. */
export const IMAGES_TO_PDF_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const

/**
 * One image per page at its natural pixel size, in the order given.
 * Encoding is chosen from the file extension (.jpg/.jpeg → JPEG, .png → PNG).
 */
export async function imagesToPdf(
  paths: string[],
  targetPath: string
): Promise<{ bytesWritten: number; pageCount: number }> {
  if (paths.length === 0) {
    throw stashError('VALIDATION', 'Add at least one image first.')
  }
  const doc = await PDFDocument.create()
  for (const imagePath of paths) {
    const name = path.basename(imagePath)
    const extension = path.extname(imagePath).toLowerCase()
    if (!(IMAGES_TO_PDF_EXTENSIONS as readonly string[]).includes(extension)) {
      throw stashError('VALIDATION', `"${name}" isn't a JPG or PNG image.`)
    }
    let bytes: Buffer
    try {
      bytes = await fs.readFile(imagePath)
    } catch (err) {
      throw stashError('FS_READ', `"${name}" could not be found or opened.`, {
        technicalMessage: String((err as Error)?.message ?? err)
      })
    }
    let image
    try {
      image = extension === '.png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
    } catch (err) {
      throw stashError('UNSUPPORTED', `"${name}" isn't a valid or uncorrupted image.`, {
        technicalMessage: String((err as Error)?.message ?? err)
      })
    }
    const page = doc.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }
  const outBytes = await doc.save()
  await fs.writeFile(targetPath, outBytes)
  return { bytesWritten: outBytes.byteLength, pageCount: paths.length }
}
