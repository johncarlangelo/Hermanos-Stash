import type { OcrPsmMode } from '../../../shared/ipc'

export interface TextStats {
  words: number
  characters: number
  charactersNoSpaces: number
  lines: number
  paragraphs: number
}

export interface ConfidenceRating {
  score: number
  label: 'High' | 'Good' | 'Moderate' | 'Low'
  percentString: string
}

export interface PsmOption {
  id: OcrPsmMode
  label: string
  description: string
}

export const PSM_OPTIONS: readonly PsmOption[] = [
  {
    id: 'auto',
    label: 'Auto (Standard document)',
    description: 'Automatic page segmentation for full-page documents with columns or paragraphs.'
  },
  {
    id: 'single_block',
    label: 'Single Block of Text',
    description: 'Assumes a single uniform block or paragraph of text.'
  },
  {
    id: 'sparse_text',
    label: 'Sparse / Scattered Text',
    description:
      'Finds all scattered text in arbitrary order — best for receipts, flyers, and posters.'
  },
  {
    id: 'single_line',
    label: 'Single Line',
    description:
      'Treats the entire image as a single line of text (e.g. barcodes, license plates, badges).'
  },
  {
    id: 'single_word',
    label: 'Single Word',
    description: 'Assumes the image contains exactly one word.'
  }
]

/**
 * Computes descriptive statistics for recognized OCR text.
 */
export function computeTextStats(text: string): TextStats {
  if (!text) {
    return {
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      lines: 0,
      paragraphs: 0
    }
  }

  const trimmed = text.trim()
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0
  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length
  const rawLines = text.split('\n')
  const lines = rawLines.length
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length

  return {
    words,
    characters,
    charactersNoSpaces,
    lines,
    paragraphs
  }
}

/**
 * Classifies OCR confidence percentage into a clear labeled rating.
 */
export function formatConfidence(confidence: number): ConfidenceRating {
  const score = Math.min(100, Math.max(0, Math.round(confidence)))
  let label: ConfidenceRating['label']

  if (score >= 85) {
    label = 'High'
  } else if (score >= 70) {
    label = 'Good'
  } else if (score >= 50) {
    label = 'Moderate'
  } else {
    label = 'Low'
  }

  return {
    score,
    label,
    percentString: `${score}%`
  }
}

export interface CleanOcrOptions {
  trimLines?: boolean
  collapseBlankLines?: boolean
  normalizeSpaces?: boolean
}

/**
 * Pure text cleaning helper for recognized text.
 */
export function cleanOcrText(text: string, options: CleanOcrOptions = {}): string {
  if (!text) return ''

  let result = text

  if (options.trimLines) {
    result = result
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
  }

  if (options.normalizeSpaces) {
    result = result
      .split('\n')
      .map((line) => line.replace(/[ \t]+/g, ' '))
      .join('\n')
  }

  if (options.collapseBlankLines) {
    result = result.replace(/\n{3,}/g, '\n\n')
  }

  return result.trim()
}
