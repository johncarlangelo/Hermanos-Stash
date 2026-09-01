/**
 * Text Statistics, Readability, and Metrics calculation logic
 */

export interface KeywordFrequency {
  word: string
  count: number
  percentage: number
}

export interface TextMetrics {
  charCount: number
  charNoSpaces: number
  wordCount: number
  sentenceCount: number
  paragraphCount: number
  lineCount: number
  syllableCount: number
  avgWordLength: number
  avgSentenceLength: number

  // Readability
  fleschReadingEase: number
  fleschGradeLevel: number
  colemanLiauIndex: number
  automatedReadabilityIndex: number
  readingLevelLabel: string

  // Time estimations
  readingTimeSeconds: number
  speakingTimeSeconds: number

  // Keywords
  topKeywords: KeywordFrequency[]
}

const STOP_WORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'could',
  'did',
  'do',
  'does',
  'doing',
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  'has',
  'have',
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  'it',
  'its',
  'itself',
  'just',
  'me',
  'more',
  'most',
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'now',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'same',
  'she',
  'should',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'with',
  'would',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves'
])

/**
 * Estimate syllable count for a single English word
 */
export function countSyllables(word: string): number {
  let clean = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!clean) return 0
  if (clean.length <= 3) return 1

  const endsWithLe = /[^aeiou]le$/.test(clean)

  if (!/(?:ted|ded)$/.test(clean)) {
    clean = clean.replace(/ed$/, '')
  }
  clean = clean.replace(/(?:es|e)$/, '').replace(/^y/, '')

  const matches = clean.match(/[aeiouy]{1,2}/g)
  let count = matches ? matches.length : 1
  if (endsWithLe) {
    count = Math.max(count + 1, 2)
  }
  return Math.max(1, count)
}

/**
 * Describe Flesch Reading Ease score
 */
export function getReadingEaseLabel(score: number): string {
  if (score >= 90) return 'Very Easy (5th Grade)'
  if (score >= 80) return 'Easy (6th Grade)'
  if (score >= 70) return 'Fairly Easy (7th Grade)'
  if (score >= 60) return 'Standard (8th-9th Grade)'
  if (score >= 50) return 'Fairly Difficult (High School)'
  if (score >= 30) return 'Difficult (College Level)'
  return 'Very Difficult (Graduate / Professional)'
}

/**
 * Calculate all text metrics
 */
export function analyzeText(text: string): TextMetrics {
  const trimmed = text.trim()
  if (!trimmed) {
    return {
      charCount: text.length,
      charNoSpaces: 0,
      wordCount: 0,
      sentenceCount: 0,
      paragraphCount: 0,
      lineCount: 0,
      syllableCount: 0,
      avgWordLength: 0,
      avgSentenceLength: 0,
      fleschReadingEase: 100,
      fleschGradeLevel: 0,
      colemanLiauIndex: 0,
      automatedReadabilityIndex: 0,
      readingLevelLabel: 'N/A',
      readingTimeSeconds: 0,
      speakingTimeSeconds: 0,
      topKeywords: []
    }
  }

  const charCount = text.length
  const charNoSpaces = text.replace(/\s/g, '').length
  const lines = text.split(/\r?\n/)
  const lineCount = lines.length
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  const paragraphCount = Math.max(1, paragraphs.length)

  // Extract words
  const words = trimmed.match(/[\p{L}\p{N}'’-]+/gu) || []
  const wordCount = words.length

  // Extract sentences
  const sentences = trimmed.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim().length > 0)
  const sentenceCount = Math.max(1, sentences.length)

  let syllableCount = 0
  const wordFreq: Record<string, number> = {}

  for (const w of words) {
    const cleanWord = w.toLowerCase().replace(/^['’-]|['’-]$/g, '')
    syllableCount += countSyllables(cleanWord)

    if (cleanWord.length > 2 && !STOP_WORDS.has(cleanWord)) {
      wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1
    }
  }

  const avgWordLength = wordCount > 0 ? Number((charNoSpaces / wordCount).toFixed(1)) : 0
  const avgSentenceLength = wordCount > 0 ? Number((wordCount / sentenceCount).toFixed(1)) : 0

  // Flesch Reading Ease
  // 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
  const fleschReadingEase =
    wordCount > 0 && sentenceCount > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Number(
              (
                206.835 -
                1.015 * (wordCount / sentenceCount) -
                84.6 * (syllableCount / wordCount)
              ).toFixed(1)
            )
          )
        )
      : 100

  // Flesch-Kincaid Grade Level
  // 0.39 * (total words / total sentences) + 11.8 * (total syllables / total words) - 15.59
  const fleschGradeLevel =
    wordCount > 0 && sentenceCount > 0
      ? Math.max(
          0,
          Number(
            (
              0.39 * (wordCount / sentenceCount) +
              11.8 * (syllableCount / wordCount) -
              15.59
            ).toFixed(1)
          )
        )
      : 0

  // Automated Readability Index (ARI)
  // 4.71 * (characters / words) + 0.5 * (words / sentences) - 21.43
  const automatedReadabilityIndex =
    wordCount > 0 && sentenceCount > 0
      ? Math.max(
          0,
          Number(
            (4.71 * (charNoSpaces / wordCount) + 0.5 * (wordCount / sentenceCount) - 21.43).toFixed(
              1
            )
          )
        )
      : 0

  // Coleman-Liau Index
  // 0.0588 * L - 0.296 * S - 15.8 where L = letters per 100 words, S = sentences per 100 words
  const L = (charNoSpaces / (wordCount || 1)) * 100
  const S = (sentenceCount / (wordCount || 1)) * 100
  const colemanLiauIndex =
    wordCount > 0 ? Math.max(0, Number((0.0588 * L - 0.296 * S - 15.8).toFixed(1))) : 0

  // Reading time (200 WPM), Speaking time (130 WPM)
  const readingTimeSeconds = Math.round((wordCount / 200) * 60)
  const speakingTimeSeconds = Math.round((wordCount / 130) * 60)

  // Top Keywords
  const topKeywords: KeywordFrequency[] = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({
      word,
      count,
      percentage: Number(((count / (wordCount || 1)) * 100).toFixed(1))
    }))

  return {
    charCount,
    charNoSpaces,
    wordCount,
    sentenceCount,
    paragraphCount,
    lineCount,
    syllableCount,
    avgWordLength,
    avgSentenceLength,
    fleschReadingEase,
    fleschGradeLevel,
    colemanLiauIndex,
    automatedReadabilityIndex,
    readingLevelLabel: getReadingEaseLabel(fleschReadingEase),
    readingTimeSeconds,
    speakingTimeSeconds,
    topKeywords
  }
}
