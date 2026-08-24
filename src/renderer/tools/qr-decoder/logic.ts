/**
 * Pure helpers for the QR Decoder tool.
 *
 * Canvas construction is injected so decode surfaces can be faked in unit
 * tests without a DOM, real image codecs, or Electron.
 */

export const ACCEPTED_QR_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.bmp'] as const

export interface DecoderSize {
  readonly width: number
  readonly height: number
}

export type Canvas2DCtor<C> = new (width: number, height: number) => C

export interface DecoderSurface<C, Ctx = CanvasRenderingContext2D> {
  canvas: C
  ctx: Ctx
}

/**
 * Build the drawing surface used for pixel extraction, preferring an
 * OffscreenCanvas when the runtime offers one and falling back to a document
 * canvas otherwise. Throws when neither yields a usable 2D context.
 * The context type is injected alongside the constructors so fakes stay
 * testable without a real DOM.
 */
export function pickDecoderCanvas<C, Ctx = CanvasRenderingContext2D>(
  size: DecoderSize,
  offscreenCtor: Canvas2DCtor<C> | null,
  fallbackCtor: Canvas2DCtor<C>,
  getContext2D: (canvas: C) => Ctx | null
): DecoderSurface<C, Ctx> {
  for (const ctor of [offscreenCtor, fallbackCtor]) {
    if (!ctor) continue
    const canvas = new ctor(size.width, size.height)
    const ctx = getContext2D(canvas)
    if (ctx) return { canvas, ctx }
  }
  throw new Error('Could not create a 2D drawing surface.')
}

/** Scale factor (≤1) that keeps pixel work bounded on huge images; 1 = unchanged. */
export function downscaleIfNeeded(width: number, height: number, maxDim = 2000): number {
  const longest = Math.max(width, height)
  if (!Number.isFinite(longest) || longest <= 0 || longest <= maxDim) return 1
  return maxDim / longest
}

/** Minimal structural slice of jsQR's result the tool actually needs. */
export type JsQrResultLike = { data: string } | null

export type DecodeOutcome = { ok: true; text: string } | { ok: false; error: string }

export const NO_QR_MESSAGE = 'No QR code found in this image.'

/**
 * Normalize a jsQR result into a structured outcome.
 * Blank payloads count as misses — they are never useful output.
 */
export function extractResult(result: JsQrResultLike): DecodeOutcome {
  if (!result || !result.data.trim()) return { ok: false, error: NO_QR_MESSAGE }
  return { ok: true, text: result.data }
}
