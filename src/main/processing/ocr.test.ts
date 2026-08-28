import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { preprocessImage, resolveTessdataDir } from './ocr'
import sharp from 'sharp'

describe('OCR Main Processor', () => {
  it('resolves local tessdata directory', () => {
    const tessdataDir = resolveTessdataDir({
      appPath: path.resolve('.'),
      resourcesPath: path.resolve('resources')
    })
    expect(tessdataDir).toBeDefined()
    expect(typeof tessdataDir).toBe('string')
    expect(tessdataDir.toLowerCase()).toContain('tessdata')
  })

  it('preprocesses an image buffer with grayscale and contrast enhancement', async () => {
    // Generate a small 100x100 RGB image buffer
    const testBuffer = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 120, g: 140, b: 160 }
      }
    })
      .png()
      .toBuffer()

    const processed = await preprocessImage(testBuffer as unknown as string, {
      grayscale: true,
      contrastEnhance: true,
      threshold: true
    })

    expect(processed).toBeInstanceOf(Buffer)
    expect(processed.length).toBeGreaterThan(0)

    const meta = await sharp(processed).metadata()
    expect(meta.format).toBe('png')
    expect(meta.width).toBe(100)
    expect(meta.height).toBe(100)
  })
})
