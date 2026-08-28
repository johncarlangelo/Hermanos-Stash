import fs from 'node:fs'
import path from 'node:path'
import * as electron from 'electron'
import sharp from 'sharp'
import { createWorker, PSM } from 'tesseract.js'
import { stashError } from '../../shared/errors'
import type { OcrImageRequest, OcrImageResult, OcrPsmMode } from '../../shared/ipc'

/**
 * Locate the local tessdata directory containing offline trained language files.
 */
export function resolveTessdataDir(
  input: { appPath?: string; resourcesPath?: string } = {}
): string {
  const candidates: string[] = []

  if (input.resourcesPath) {
    candidates.push(path.join(input.resourcesPath, 'tessdata'))
  }
  if (input.appPath) {
    candidates.push(path.join(input.appPath, 'resources', 'tessdata'))
  }
  candidates.push(path.resolve('resources/tessdata'))

  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        return dir
      }
    } catch {
      // Ignore unreadable candidate and try next
    }
  }

  return path.resolve('resources/tessdata')
}

const PSM_MAP: Record<OcrPsmMode, PSM> = {
  auto: PSM.AUTO,
  single_block: PSM.SINGLE_BLOCK,
  single_line: PSM.SINGLE_LINE,
  single_word: PSM.SINGLE_WORD,
  sparse_text: PSM.SPARSE_TEXT
}

/**
 * Preprocesses an image using Sharp before passing to Tesseract.
 * Grayscale, contrast normalization, and thresholding drastically improve OCR accuracy on noisy scans.
 */
export async function preprocessImage(
  inputPath: string,
  options?: OcrImageRequest['preprocess']
): Promise<Buffer> {
  let pipeline = sharp(inputPath, { failOn: 'none' }).rotate() // Auto-rotate via EXIF

  if (options?.grayscale) {
    pipeline = pipeline.grayscale()
  }

  if (options?.contrastEnhance) {
    pipeline = pipeline.normalize()
  }

  if (options?.threshold) {
    pipeline = pipeline.threshold(128)
  }

  return pipeline.png().toBuffer()
}

/**
 * Extracts text from an image locally using Tesseract OCR.
 */
export async function ocrImage(
  req: OcrImageRequest,
  onProgress?: (ratio: number | null, message?: string) => void,
  isCancelled?: () => boolean
): Promise<OcrImageResult> {
  const startTime = Date.now()

  if (!req.path || typeof req.path !== 'string') {
    throw stashError('VALIDATION', 'Image path is required')
  }

  if (!fs.existsSync(req.path)) {
    throw stashError('FS_READ', `Image not found: ${req.path}`)
  }

  if (isCancelled?.()) {
    throw stashError('CANCELLED', 'OCR operation was cancelled')
  }

  onProgress?.(0.05, 'Preparing image...')
  let imageBuffer: Buffer
  try {
    imageBuffer = await preprocessImage(req.path, req.preprocess)
  } catch (err) {
    throw stashError(
      'UNKNOWN',
      `Failed to read and preprocess image: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (isCancelled?.()) {
    throw stashError('CANCELLED', 'OCR operation was cancelled')
  }

  const tessdataDir = resolveTessdataDir({
    appPath: typeof electron.app?.getAppPath === 'function' ? electron.app.getAppPath() : undefined,
    resourcesPath: process.resourcesPath
  })

  const language = req.language || 'eng'

  onProgress?.(0.15, 'Initializing OCR engine...')

  let worker
  try {
    worker = await createWorker(language, 1, {
      langPath: tessdataDir,
      gzip: true,
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') {
          const ratio = 0.2 + m.progress * 0.75
          onProgress?.(ratio, `Recognizing text (${Math.round(m.progress * 100)}%)`)
        } else if (m.status === 'loading language traineddata') {
          onProgress?.(0.1, 'Loading language model...')
        } else if (m.status === 'initializing api') {
          onProgress?.(0.18, 'Initializing OCR engine...')
        }
      }
    })

    if (req.psm && PSM_MAP[req.psm]) {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM_MAP[req.psm]
      })
    }

    if (isCancelled?.()) {
      throw stashError('CANCELLED', 'OCR operation was cancelled')
    }

    const ret = await worker.recognize(imageBuffer)

    const rawText = ret.data?.text ?? ''
    const confidence =
      typeof ret.data?.confidence === 'number' ? Math.round(ret.data.confidence) : 0
    const words = rawText.trim().split(/\s+/).filter(Boolean)
    const lines = rawText.split('\n')

    onProgress?.(1, 'Text extraction complete')

    return {
      text: rawText,
      confidence,
      wordCount: words.length,
      charCount: rawText.length,
      lineCount: rawText ? lines.length : 0,
      durationMs: Date.now() - startTime
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err) {
      throw err
    }
    throw stashError(
      'UNKNOWN',
      `OCR processing failed: ${err instanceof Error ? err.message : String(err)}`
    )
  } finally {
    if (worker) {
      try {
        await worker.terminate()
      } catch {
        // Ignore termination errors
      }
    }
  }
}
