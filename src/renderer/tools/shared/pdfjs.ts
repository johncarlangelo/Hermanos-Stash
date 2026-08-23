import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { normalizeError, stashError, type StashError } from '../../../shared/errors'

// The worker ships as its own module; Vite resolves the URL at build time.
// Configured once here so every renderer-side PDF consumer shares one setup.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjsLib }

/**
 * Map a pdf.js open/render failure into an actionable StashError, keeping
 * password-protected documents distinct from generic corruption.
 */
export function mapPdfJsError(err: unknown, name: string): StashError {
  const raw = err as Error
  const isPassword =
    raw?.name === 'PasswordException' || /password/i.test(String(raw?.message ?? ''))
  if (isPassword) {
    return stashError(
      'UNSUPPORTED',
      `"${name}" is password-protected. Enter the password in its owning app to unlock it first.`,
      { technicalMessage: String(raw?.message ?? err) }
    )
  }
  return normalizeError(err)
}
