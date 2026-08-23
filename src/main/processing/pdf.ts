import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
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
