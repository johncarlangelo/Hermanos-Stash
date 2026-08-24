/**
 * Pure word-boundary tokenization, case conversions and text statistics.
 * No React, no DOM — fully unit-testable.
 */

export type CaseKind =
  'camel' | 'pascal' | 'snake' | 'kebab' | 'constant' | 'title' | 'sentence' | 'upper' | 'lower'

/**
 * Split any identifier-ish string into words, honoring camelCase,
 * PascalCase, SCREAMING_SNAKE, kebab-case and acronym boundaries
 * ("XMLHttpRequest" → ["XML", "Http", "Request"]) while keeping digits
 * attached to their segment ("v2Beta" → ["v2", "Beta"]).
 */
export function toWords(input: string): string[] {
  const segments = input
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const words: string[] = []
  for (const segment of segments) {
    for (const piece of splitCamel(segment)) {
      if (piece) words.push(piece)
    }
  }
  return words
}

function splitCamel(segment: string): string[] {
  // Acronym boundary first: run of capitals followed by capital+lower.
  const withAcronyms = segment.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  // Then the regular lower/digit → upper transition.
  return withAcronyms.replace(/([a-z\d])([A-Z])/g, '$1 $2').split(' ')
}

export function convertCase(input: string, kind: CaseKind): string {
  const words = toWords(input)
  switch (kind) {
    case 'camel':
      return words.map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w))).join('')
    case 'pascal':
      return words.map(capitalize).join('')
    case 'snake':
      return words.map((w) => w.toLowerCase()).join('_')
    case 'kebab':
      return words.map((w) => w.toLowerCase()).join('-')
    case 'constant':
      return words.map((w) => w.toUpperCase()).join('_')
    case 'title':
      return words.map(capitalize).join(' ')
    case 'sentence': {
      const sentence = words.map((w) => w.toLowerCase()).join(' ')
      return sentence ? capitalize(sentence) : ''
    }
    case 'upper':
      return input.toUpperCase()
    case 'lower':
      return input.toLowerCase()
  }
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

export interface TextCounts {
  words: number
  chars: number
  noWhitespaceChars: number
  lines: number
  sentences: number
  readingTimeMin: number
}

/** Count structural properties of a text at a 200 wpm reading pace. */
export function counts(text: string): TextCounts {
  const words = toWords(text)
  const sentences = countSentences(text)
  return {
    words: words.length,
    chars: text.length,
    noWhitespaceChars: text.replace(/\s/g, '').length,
    lines: text === '' ? 0 : text.split('\n').length,
    sentences,
    readingTimeMin: Math.round((words.length / 200) * 10) / 10
  }
}

function countSentences(text: string): number {
  const matches = text.match(/[^.!?\s][^.!?]*[.!?]+(\s|$)|[^.!?]+$/g)
  if (!matches) return 0
  return matches.filter((s) => s.trim().length > 0).length
}
