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
