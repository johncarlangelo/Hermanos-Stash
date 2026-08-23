/**
 * Structured application errors.
 *
 * Every error crossing a process boundary must be normalized into a
 * `StashError` so the UI can present actionable language without leaking
 * raw stack traces (see TOOL_SPEC.md → Errors).
 */

export const ERROR_CODES = {
  UNKNOWN: 'UNKNOWN',
  VALIDATION: 'VALIDATION',
  FS_READ: 'FS_READ',
  FS_WRITE: 'FS_WRITE',
  DIALOG_CANCELLED: 'DIALOG_CANCELLED',
  UNSUPPORTED: 'UNSUPPORTED',
  CANCELLED: 'CANCELLED',
  STORAGE: 'STORAGE'
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export interface StashError {
  code: ErrorCode
  /** Actionable message safe to show in the UI. */
  userMessage: string
  /** Optional detail useful for logs or power users. */
  technicalMessage?: string
  recoverable: boolean
}

export function stashError(
  code: ErrorCode,
  userMessage: string,
  options?: { technicalMessage?: string; recoverable?: boolean }
): StashError {
  return {
    code,
    userMessage,
    technicalMessage: options?.technicalMessage,
    recoverable: options?.recoverable ?? code !== ERROR_CODES.UNKNOWN
  }
}

/** Coerce any thrown value into a `StashError`. Never throws. */
export function normalizeError(err: unknown): StashError {
  if (isStashError(err)) return err
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return stashError(ERROR_CODES.CANCELLED, 'The operation was cancelled.', {
        technicalMessage: err.message
      })
    }
    return stashError(ERROR_CODES.UNKNOWN, 'Something went wrong while processing your request.', {
      technicalMessage: err.message
    })
  }
  if (typeof err === 'string') {
    return stashError(ERROR_CODES.UNKNOWN, err)
  }
  return stashError(ERROR_CODES.UNKNOWN, 'Something went wrong while processing your request.')
}

export function isStashError(value: unknown): value is StashError {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['code'] === 'string' &&
    typeof v['userMessage'] === 'string' &&
    typeof v['recoverable'] === 'boolean'
  )
}

export function isCancelled(err: unknown): boolean {
  return normalizeError(err).code === ERROR_CODES.CANCELLED
}

/** JSON-safe copy for transport across IPC. Drops non-enumerable extras. */
export function serializeStashError(err: unknown): StashError {
  const normalized = normalizeError(err)
  return {
    code: normalized.code,
    userMessage: normalized.userMessage,
    technicalMessage: normalized.technicalMessage,
    recoverable: normalized.recoverable
  }
}
