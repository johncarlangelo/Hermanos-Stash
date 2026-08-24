import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import type { Metadata } from 'sharp'
import { isStashError } from '../../shared/errors'
import {
  clampWatermarkFontSize,
  compressImage,
  convertImage,
  formatForExtension,
  isValidWatermarkColor,
  normalizeWatermarkText,
  socialResizeImage,
  watermarkImage
} from './images'

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'stash-images-'))
}

/** 4x4 RGBA noise PNG — deterministic, tiny, and fast to encode. */
async function writeTinyPng(dir: string, name = 'in.png'): Promise<string> {
  const buffer = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
      noise: { type: 'gaussian', mean: 128, sigma: 30 }
    }
  })
    .png()
    .toBuffer()
  const file = path.join(dir, name)
  await fs.writeFile(file, buffer)
  return file
}

async function writeNoisyPng(dir: string, name: string, size: number): Promise<string> {
  const buffer = await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
      noise: { type: 'gaussian', mean: 100, sigma: 60 }
    }
  })
    .png()
    .toBuffer()
  const file = path.join(dir, name)
  await fs.writeFile(file, buffer)
  return file
}

/** Metadata via an in-memory copy so no file handle lingers on Windows. */
async function metadataOf(file: string): Promise<Metadata> {
  const bytes = await fs.readFile(file)
  return sharp(bytes).metadata()
}

describe('formatForExtension', () => {
  it('maps common image extensions to sharp formats', () => {
    expect(formatForExtension('.png')).toBe('png')
    expect(formatForExtension('.JPG')).toBe('jpeg')
    expect(formatForExtension('.jpeg')).toBe('jpeg')
    expect(formatForExtension('.webp')).toBe('webp')
    expect(formatForExtension('.avif')).toBe('avif')
    expect(formatForExtension('.tiff')).toBe('tiff')
    expect(formatForExtension('.gif')).toBeNull()
    expect(formatForExtension('.txt')).toBeNull()
  })
})

describe('convertImage', () => {
  it('round-trips into each supported format', async () => {
    const dir = await makeTempDir()
    try {
      const input = await writeTinyPng(dir)
      for (const format of ['png', 'jpeg', 'webp', 'avif', 'tiff'] as const) {
        const output = path.join(dir, `out.${format}`)
        const { bytesWritten } = await convertImage(input, output, { format, quality: 80 })
        expect(bytesWritten).toBeGreaterThan(0)
        // AVIF lives inside the HEIF container, so sharp reports it as such.
        const detected = (await metadataOf(output)).format
        expect(format === 'avif' ? ['avif', 'heif'] : [format]).toContain(detected)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('clamps out-of-range quality instead of failing', async () => {
    const dir = await makeTempDir()
    try {
      const input = await writeTinyPng(dir)
      for (const quality of [-50, 0, 250, 9999]) {
        const output = path.join(dir, `q${quality}.jpg`)
        const { bytesWritten } = await convertImage(input, output, { format: 'jpeg', quality })
        expect(bytesWritten).toBeGreaterThan(0)
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects missing input with a structured error', async () => {
    const dir = await makeTempDir()
    try {
      const missing = path.join(dir, 'nope.png')
      const output = path.join(dir, 'out.png')
      await expect(convertImage(missing, output, { format: 'png' })).rejects.toSatisfy(
        (err: unknown) =>
          isStashError(err) && err.code === 'FS_READ' && err.userMessage.includes('nope.png')
      )
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects non-image input as unsupported', async () => {
    const dir = await makeTempDir()
    try {
      const input = path.join(dir, 'text.txt')
      await fs.writeFile(input, 'definitely not an image')
      await expect(
        convertImage(input, path.join(dir, 'out.png'), { format: 'png' })
      ).rejects.toSatisfy((err: unknown) => isStashError(err) && err.code === 'UNSUPPORTED')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('compressImage', () => {
  it('reduces a noisy PNG at jpeg quality and keeps the format', async () => {
    const dir = await makeTempDir()
    try {
      const input = await writeNoisyPng(dir, 'photo.png', 256)
      const original = (await fs.stat(input)).size
      const output = path.join(dir, 'photo.jpg')
      const { bytesWritten } = await compressImage(input, output, { quality: 75 })
      expect(bytesWritten).toBeLessThan(original)
      expect(await metadataOf(output)).toMatchObject({ format: 'jpeg' })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('downscales only when the image exceeds maxDimension', async () => {
    const dir = await makeTempDir()
    try {
      const input = await writeTinyPng(dir)
      const shrunk = path.join(dir, 'tiny-min.png')
      await compressImage(input, shrunk, { quality: 80, maxDimension: 2 })
      expect(await metadataOf(shrunk)).toMatchObject({ width: 2, height: 2 })

      const kept = path.join(dir, 'kept-min.png')
      await compressImage(input, kept, { quality: 80, maxDimension: 64 })
      expect(await metadataOf(kept)).toMatchObject({ width: 4, height: 4 })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects outputs with unsupported extensions', async () => {
    const dir = await makeTempDir()
    try {
      const input = await writeTinyPng(dir)
      await expect(
        compressImage(input, path.join(dir, 'out.gif'), { quality: 75 })
      ).rejects.toSatisfy((err: unknown) => isStashError(err) && err.code === 'UNSUPPORTED')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})

describe('watermarkImage', () => {
  it('stamps text without changing output dimensions', async () => {
    const dir = await makeTempDir()
    try {
      const input = await writeNoisyPng(dir, 'photo.png', 200)
      const output = path.join(dir, 'photo-watermarked.png')
      const { bytesWritten } = await watermarkImage(input, output, {
        text: '© Hermanos',
        position: 'bottom-right'
      })
      expect(bytesWritten).toBeGreaterThan(0)
      const meta = await metadataOf(output)
      expect(meta).toMatchObject({ width: 200, height: 200, format: 'png' })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('rejects invalid hex colors with a validation error', async () => {
    const dir = await makeTempDir()
    try {
      const input = await writeNoisyPng(dir, 'photo.png', 64)
      const output = path.join(dir, 'out.png')
      for (const color of ['red', '#12345', '#gggggg', 'ffffff']) {
        await expect(
          watermarkImage(input, output, { text: 'x', position: 'center', color })
        ).rejects.toSatisfy((err: unknown) => isStashError(err) && err.code === 'VALIDATION')
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('clamps out-of-range opacity and font size instead of failing', async () => {
    const dir = await makeTempDir()
    try {
      const input = await writeNoisyPng(dir, 'photo.png', 64)
      const output = path.join(dir, 'clamped.png')
      const { bytesWritten } = await watermarkImage(input, output, {
        text: 'edge',
        position: 'center',
        opacity: 42,
        fontSize: 9999
      })
      expect(bytesWritten).toBeGreaterThan(0)
      expect(clampWatermarkFontSize(-5)).toBe(12)
      expect(clampWatermarkFontSize(32.4)).toBe(32)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('normalizes watermark text (control chars stripped, capped at 60)', () => {
    expect(normalizeWatermarkText('  hello\u0007 world\t')).toBe('hello world')
    expect(normalizeWatermarkText('x'.repeat(100)).length).toBe(60)
    expect(normalizeWatermarkText('\t\n\r')).toBe('')
    expect(isValidWatermarkColor('#fff')).toBe(true)
    expect(isValidWatermarkColor('#AbC123')).toBe(true)
    expect(isValidWatermarkColor('#12')).toBe(false)
  })
})

describe('socialResizeImage', () => {
  it('produces exact preset dimensions via attention crop', async () => {
    const dir = await makeTempDir()
    try {
      const input = await writeNoisyPng(dir, 'photo.jpg', 400)
      const ogOutput = path.join(dir, 'photo-og-image.jpg')
      const storyOutput = path.join(dir, 'photo-instagram-story.jpg')
      await socialResizeImage(input, ogOutput, { w: 1200, h: 630 })
      await socialResizeImage(input, storyOutput, { w: 1080, h: 1920 })
      expect(await metadataOf(ogOutput)).toMatchObject({ width: 1200, height: 630 })
      expect(await metadataOf(storyOutput)).toMatchObject({ width: 1080, height: 1920 })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
