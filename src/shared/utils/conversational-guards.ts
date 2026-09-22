/**
 * Hermanos Stash — Conversational Guards & Intent Pre-Filters
 * Handles greetings, system health/test queries, keyboard mash/gibberish,
 * and conversational responses for the Hermano copilot.
 */

export const GREETING_REGEX =
  /^(hi|hello|hey|hey\s+there|good\s+morning|good\s+afternoon|good\s+evening|howdy|sup|yo|greetings|hola)[!.,? ]*$/i

export const SYSTEM_CHECK_REGEX =
  /^(test|testing|help|ping|who\s+are\s+you|what\s+can\s+you\s+do|what\s+is\s+this|what\s+is\s+stash)[!.,? ]*$/i

export const GIBBERISH_PATTERN =
  /^([bcdfghjklmnpqrstvwxyz]{6,}|[aeiou]{5,}|(.)\2{4,}|[^\w\s]{2,}|asdf\w*|qwer\w*|zxcv\w*|hjkl\w*)$/i

export const CONVERSATIONAL_RESPONSES = {
  greeting:
    "Hey there! 👋 I'm Hermano, your workstation copilot. Tell me what you're working on—like **'convert audio to mp3'**, **'extract pages from a PDF'**, or **'format this JSON'**—and I'll guide you to the right tool or build a pipeline!",
  systemCheck:
    "All systems go! ⚡ What task can I help you tackle today? You can describe any file, document, image, or developer workflow (or press **Ctrl+K** to search all 78 tools).",
  gibberish:
    "I didn't quite catch that! Try describing the file you have or what you'd like to do with it (e.g. **'remove metadata from photo'** or **'generate qr code'**).",
  outOfScope:
    "I couldn't find a matching tool in Stash for that task. Stash is designed for local file processing, media conversion, documents, and developer utilities. Try describing your file format and goal, or search all 78 tools using **Ctrl+K**."
} as const

export function isGibberish(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false

  // Repeated character spam (e.g. "aaaaa", ".....", "?????")
  if (/(.)\1{4,}/.test(trimmed)) return true

  // Only punctuation / symbols without letters or digits (e.g. "???", "!?", "...")
  if (/^[^\w\s]+$/.test(trimmed)) return true

  // Common keyboard row runs (e.g. "asdf", "asdfgh", "qwerty", "zxcv")
  if (/^(asdf\w*|qwer\w*|zxcv\w*|hjkl\w*)$/i.test(trimmed)) return true

  // Check single words for keyboard mash characteristics
  const words = trimmed.split(/\s+/)
  if (words.length === 1) {
    const w = words[0].toLowerCase()
    // 5+ letters with no vowels at all (e.g. "bcdfgh", "zxcvb")
    if (/^[a-z]{5,}$/.test(w) && !/[aeiouy]/.test(w)) return true

    // 6+ letters with extremely low vowel ratio (<= 15% vowels, e.g. "dfsdagfdg" has 1 'a' out of 9 letters)
    if (w.length >= 6 && /^[a-z]+$/.test(w)) {
      const vowels = (w.match(/[aeiouy]/g) || []).length
      if (vowels / w.length <= 0.15) return true
    }
  }

  return false
}

export type ConversationalIntent = 'greeting' | 'system_check' | 'gibberish' | null

export function detectConversationalIntent(query: string): ConversationalIntent {
  const clean = query.trim()
  if (!clean) return null

  if (GREETING_REGEX.test(clean)) return 'greeting'
  if (SYSTEM_CHECK_REGEX.test(clean)) return 'system_check'
  if (isGibberish(clean)) return 'gibberish'

  return null
}
