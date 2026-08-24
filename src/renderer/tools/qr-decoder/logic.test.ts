import { describe, expect, it } from 'vitest'
import {
  ACCEPTED_QR_EXTENSIONS,
  downscaleIfNeeded,
  extractResult,
  pickDecoderCanvas
} from './logic'

class FakeCtx {
  constructor(
    public canvasWidth: number,
    public canvasHeight: number
  ) {}
}

class FakeCanvas {
  ctx: FakeCtx | null
  constructor(
    public width: number,
    public height: number,
    withContext = true
  ) {
    this.ctx = withContext ? new FakeCtx(width, height) : null
  }
  getContext(): FakeCtx | null {
    return this.ctx
  }
}

describe('pickDecoderCanvas', () => {
  it('prefers the offscreen constructor when one is available', () => {
    const offscreen = FakeCanvas
    const fallback = FakeCanvas
    const surface = pickDecoderCanvas({ width: 320, height: 240 }, offscreen, fallback, (canvas) =>
      canvas.getContext()
    )
    expect(surface.canvas).toBeInstanceOf(FakeCanvas)
    expect(surface.canvas.width).toBe(320)
    expect(surface.canvas.height).toBe(240)
    expect(surface.ctx).toBeInstanceOf(FakeCtx)
    expect(surface.ctx.canvasWidth).toBe(320)
  })

  it('falls back to the document-style constructor when offscreen is unavailable', () => {
    const surface = pickDecoderCanvas({ width: 64, height: 48 }, null, FakeCanvas, (canvas) =>
      canvas.getContext()
    )
    expect(surface.canvas.width).toBe(64)
    expect(surface.canvas.height).toBe(48)
  })

  it('skips a constructor whose context comes back null and uses the next one', () => {
    class NoCtxCanvas extends FakeCanvas {
      constructor(w: number, h: number) {
        super(w, h, false)
      }
    }
    const surface = pickDecoderCanvas(
      { width: 10, height: 10 },
      NoCtxCanvas,
      FakeCanvas,
      (canvas) => canvas.getContext()
    )
    expect(surface.canvas).toBeInstanceOf(FakeCanvas)
    expect(surface.ctx).not.toBeNull()
  })

  it('throws when neither constructor yields a 2D context', () => {
    expect(() =>
      pickDecoderCanvas({ width: 10, height: 10 }, NoContextCanvas, NoContextCanvas, (canvas) =>
        canvas.getContext()
      )
    ).toThrow(/drawing surface/)
  })
})

class NoContextCanvas extends FakeCanvas {
  constructor(w: number, h: number) {
    super(w, h, false)
  }
}

describe('downscaleIfNeeded', () => {
  it('returns 1 when the image fits within the limit', () => {
    expect(downscaleIfNeeded(1920, 1080)).toBe(1)
    expect(downscaleIfNeeded(2000, 2000)).toBe(1)
    expect(downscaleIfNeeded(1, 1)).toBe(1)
  })

  it('scales down so the longest edge lands exactly on maxDim', () => {
    expect(downscaleIfNeeded(4000, 1000)).toBe(0.5)
    expect(downscaleIfNeeded(600, 3000)).toBeCloseTo(2000 / 3000)
    expect(downscaleIfNeeded(5000, 5000, 2500)).toBe(0.5)
  })

  it('treats degenerate sizes as no-op instead of dividing by zero', () => {
    expect(downscaleIfNeeded(0, 0)).toBe(1)
    expect(downscaleIfNeeded(Number.NaN, 500)).toBe(1)
  })
})

describe('extractResult', () => {
  it('passes through decoded text', () => {
    expect(extractResult({ data: 'https://example.com' })).toEqual({
      ok: true,
      text: 'https://example.com'
    })
  })

  it('reports the guidance message for null results', () => {
    expect(extractResult(null)).toEqual({
      ok: false,
      error: 'No QR code found in this image.'
    })
  })

  it('treats blank payloads as misses rather than empty success', () => {
    expect(extractResult({ data: '   ' }).ok).toBe(false)
  })
})

describe('ACCEPTED_QR_EXTENSIONS', () => {
  it('covers raster formats without duplicates', () => {
    expect(new Set(ACCEPTED_QR_EXTENSIONS).size).toBe(ACCEPTED_QR_EXTENSIONS.length)
    for (const ext of ACCEPTED_QR_EXTENSIONS) expect(ext.startsWith('.')).toBe(true)
  })
})
