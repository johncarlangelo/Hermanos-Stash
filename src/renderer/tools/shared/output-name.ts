/**
 * Shared output-filename handling for every tool that writes files.
 * Rules mirror Windows filename constraints so a validated name is always
 * safe to hand to a save dialog or an IPC handler.
 */

/** Characters Windows forbids in file names. */
const FORBIDDEN_CHARACTERS = '<>:"/\\|?*'

const RESERVED_DEVICE_NAMES = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

export const MAX_FILE_NAME_LENGTH = 120

function isForbiddenCharacter(character: string): boolean {
  const code = character.charCodeAt(0)
  return FORBIDDEN_CHARACTERS.includes(character) || code <= 31 || code === 127
}

function stripForbiddenCharacters(name: string): string {
  let out = ''
  for (const character of name) {
    if (!isForbiddenCharacter(character)) out += character
  }
  return out
}

export function sanitizeFileName(name: string): string {
  return stripForbiddenCharacters(name)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILE_NAME_LENGTH)
    .replace(/[.\s]+$/, '')
}

export function ensureExtension(name: string, ext: string): string {
  return name.toLowerCase().endsWith(ext.toLowerCase()) ? name : name + ext
}

export type FileNameValidation = { ok: true; value: string } | { ok: false; error: string }

function isReservedDeviceName(cleaned: string): boolean {
  const dot = cleaned.indexOf('.')
  return RESERVED_DEVICE_NAMES.test(dot === -1 ? cleaned : cleaned.slice(0, dot))
}

export function validateOutputName(raw: string, ext: string): FileNameValidation {
  if (raw.trim().length === 0) {
    return { ok: false, error: 'Enter a file name.' }
  }
  const cleaned = sanitizeFileName(raw)
  if (cleaned.length === 0) {
    return { ok: false, error: 'That name contains only invalid characters.' }
  }
  if (isReservedDeviceName(cleaned)) {
    return { ok: false, error: 'That name is reserved by Windows.' }
  }
  return { ok: true, value: ensureExtension(cleaned, ext) }
}

/**
 * Same rules as validateOutputName but without forcing an extension —
 * for flows where the output format/codec decides the real extension.
 */
export function validateOutputStem(raw: string): FileNameValidation {
  return validateOutputName(raw, '')
}

/** Substitutes every `{name}` token with the sanitized source stem. */
export function applyNamePattern(pattern: string, sourceStem: string): FileNameValidation {
  if (!pattern.includes('{name}')) {
    return { ok: false, error: 'Pattern must include {name}.' }
  }
  const stem = sanitizeFileName(sourceStem)
  if (stem.length === 0) {
    return { ok: false, error: 'That name contains only invalid characters.' }
  }
  const value = sanitizeFileName(pattern.split('{name}').join(stem))
  if (value.length === 0) {
    return { ok: false, error: 'That name contains only invalid characters.' }
  }
  return { ok: true, value }
}
