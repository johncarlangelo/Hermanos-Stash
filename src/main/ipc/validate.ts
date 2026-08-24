import { stashError } from '../../shared/errors'

/**
 * Minimal input validation for IPC payloads. The renderer is untrusted:
 * every channel handler validates its inputs before touching services.
 */

export function assertString(
  value: unknown,
  field: string,
  opts?: { allowEmpty?: boolean }
): string {
  if (typeof value !== 'string' || (!opts?.allowEmpty && !value.trim())) {
    throw stashError('VALIDATION', `Invalid request: "${field}" must be a non-empty string.`, {
      technicalMessage: `${field}=${JSON.stringify(value)}`
    })
  }
  return value
}

export function assertOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  return assertString(value, field)
}

export function assertBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw stashError('VALIDATION', `Invalid request: "${field}" must be a boolean.`)
  }
  return value
}

export function assertNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw stashError('VALIDATION', `Invalid request: "${field}" must be a finite number.`)
  }
  return value
}

// --- Output file naming ------------------------------------------------------

/** Characters Windows forbids in file names. */
const FORBIDDEN_NAME_CHARACTERS = '<>:"/\\|?*'

const RESERVED_DEVICE_NAMES = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

const MAX_FILE_NAME_LENGTH = 120

/**
 * Renderer-supplied output names are untrusted input: re-sanitize them
 * main-side with the same rules the renderer applies for UX feedback.
 */
function sanitizeFileNameInput(name: string): string {
  let stripped = ''
  for (const character of name) {
    const code = character.charCodeAt(0)
    if (FORBIDDEN_NAME_CHARACTERS.includes(character) || code <= 31 || code === 127) continue
    stripped += character
  }
  return stripped
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_FILE_NAME_LENGTH)
    .replace(/[.\s]+$/, '')
}

/**
 * Optional user-chosen output base name. Any extension the caller supplied is
 * discarded — the operation's format/codec always decides the real one.
 */
export function parseOptionalFileName(value: unknown, forcedExtension: string): string | undefined {
  if (value === undefined) return undefined
  const cleaned = sanitizeFileNameInput(assertString(value, 'fileName'))
  if (cleaned.length === 0) {
    throw stashError('VALIDATION', 'Invalid request: "fileName" contains no usable characters.')
  }
  const firstDot = cleaned.indexOf('.')
  if (RESERVED_DEVICE_NAMES.test(firstDot === -1 ? cleaned : cleaned.slice(0, firstDot))) {
    throw stashError('VALIDATION', 'Invalid request: "fileName" is a reserved device name.')
  }
  const lastDot = cleaned.lastIndexOf('.')
  const stem = lastDot <= 0 ? cleaned : cleaned.slice(0, lastDot)
  return stem + forcedExtension
}

/** Optional batch naming template; every entry must carry the {name} token. */
export function parseOptionalNamePattern(value: unknown): string | undefined {
  if (value === undefined) return undefined
  const pattern = assertString(value, 'namePattern')
  if (!pattern.includes('{name}')) {
    throw stashError('VALIDATION', 'Invalid request: "namePattern" must include {name}.')
  }
  return pattern
}

export interface FileFilterInput {
  name: string
  extensions: string[]
}

export function parseFilters(value: unknown): FileFilterInput[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    throw stashError('VALIDATION', 'Invalid request: filters must be an array.')
  }
  return value.map((raw) => {
    if (typeof raw !== 'object' || raw === null) {
      throw stashError('VALIDATION', 'Invalid request: each filter must be an object.')
    }
    const obj = raw as Record<string, unknown>
    const name = assertString(obj['name'], 'filters.name')
    const extensionsRaw = obj['extensions']
    if (
      !Array.isArray(extensionsRaw) ||
      !extensionsRaw.every((e) => typeof e === 'string' && /^[a-zA-Z0-9]+$/.test(e))
    ) {
      throw stashError('VALIDATION', 'Invalid request: filter extensions are malformed.', {
        technicalMessage: JSON.stringify(extensionsRaw)
      })
    }
    return { name, extensions: extensionsRaw as string[] }
  })
}
