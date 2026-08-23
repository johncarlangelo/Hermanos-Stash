import QRCode from 'qrcode'
import { stashError } from '../../../shared/errors'

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

export interface QrOptions {
  width?: number
  errorCorrectionLevel?: ErrorCorrectionLevel
}

const DEFAULT_WIDTH = 512
const DEFAULT_ERROR_CORRECTION: ErrorCorrectionLevel = 'M'

/**
 * Palette chosen for scannability: near-black modules on warm paper,
 * matching the app's ink tones without going OLED-black.
 */
const FIXED_OPTIONS = {
  margin: 2,
  color: { dark: '#16181d', light: '#f4f1ea' }
} as const

/**
 * Render text as a PNG data URL using qrcode with fixed, sensible defaults.
 * Throws a `StashError` so the UI can present actionable language directly.
 */
export async function generateQrDataUrl(text: string, options: QrOptions = {}): Promise<string> {
  if (!text.trim()) {
    throw stashError('VALIDATION', 'Enter some content to encode.')
  }
  try {
    return await QRCode.toDataURL(text, {
      ...FIXED_OPTIONS,
      width: options.width ?? DEFAULT_WIDTH,
      errorCorrectionLevel: options.errorCorrectionLevel ?? DEFAULT_ERROR_CORRECTION
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/too big|too long/i.test(message)) {
      throw stashError(
        'VALIDATION',
        'That content is too long to fit in a single QR code. Try shortening it.',
        { technicalMessage: message }
      )
    }
    throw stashError('UNKNOWN', 'Could not generate the QR code.', { technicalMessage: message })
  }
}
