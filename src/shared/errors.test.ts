import { describe, expect, it } from 'vitest'
import {
  ERROR_CODES,
  isCancelled,
  isStashError,
  normalizeError,
  serializeStashError
} from './errors'
import type { StashError } from './errors'

describe('normalizeError', () => {
  it('passes through existing StashErrors untouched', () => {
    const err = serializeStashError({
      code: ERROR_CODES.FS_READ,
      userMessage: 'Could not read the file.',
      technicalMessage: 'ENOENT',
      recoverable: true
    })
    const out = normalizeError(err)
    expect(out.code).toBe(ERROR_CODES.FS_READ)
    expect(out.userMessage).toBe('Could not read the file.')
  })

  it('maps AbortError to CANCELLED', () => {
    const abort = new Error('The operation was aborted')
    abort.name = 'AbortError'
    expect(normalizeError(abort).code).toBe(ERROR_CODES.CANCELLED)
    expect(isCancelled(abort)).toBe(true)
  })

  it('wraps generic Errors with a safe user message', () => {
    const out = normalizeError(new Error('stack trace detail'))
    expect(out.code).toBe(ERROR_CODES.UNKNOWN)
    expect(out.userMessage).not.toContain('stack trace detail')
    expect(out.technicalMessage).toBe('stack trace detail')
  })

  it('handles strings and junk values without throwing', () => {
    expect(normalizeError('disk full').userMessage).toBe('disk full')
    const out = normalizeError(undefined)
    expect(isStashError(out)).toBe(true)
  })
})

describe('serializeStashError', () => {
  it('produces a JSON-safe plain object', () => {
    const original: StashError = {
      code: ERROR_CODES.VALIDATION,
      userMessage: 'Invalid input.',
      technicalMessage: 'expected string',
      recoverable: true
    }
    const copy = JSON.parse(JSON.stringify(serializeStashError(original)))
    expect(copy).toEqual(original)
  })
})
