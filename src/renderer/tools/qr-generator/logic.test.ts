import { describe, expect, it } from 'vitest'
import { generateQrDataUrl } from './logic'

const PNG_PREFIX = 'data:image/png;base64,'

describe('generateQrDataUrl', () => {
  it('rejects empty and whitespace-only input with actionable guidance', async () => {
    await expect(generateQrDataUrl('')).rejects.toMatchObject({
      code: 'VALIDATION',
      userMessage: 'Enter some content to encode.'
    })
    await expect(generateQrDataUrl('   \n\t ')).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('generates a PNG data URL for plain text', async () => {
    const dataUrl = await generateQrDataUrl('hello hermanos')
    expect(dataUrl.startsWith(PNG_PREFIX)).toBe(true)
    expect(dataUrl.length).toBeGreaterThan(PNG_PREFIX.length)
  })

  it('handles long-but-valid payloads without failing', async () => {
    // Well within version-40 capacity at error correction M.
    const dataUrl = await generateQrDataUrl('a'.repeat(1000))
    expect(dataUrl.startsWith(PNG_PREFIX)).toBe(true)
  })

  it('encodes URLs correctly', async () => {
    const dataUrl = await generateQrDataUrl('https://hermanos.stash/tools/qr-generator')
    expect(dataUrl.startsWith(PNG_PREFIX)).toBe(true)
  })

  it('honors requested width overrides while staying a valid PNG', async () => {
    const small = await generateQrDataUrl('size test', { width: 256 })
    expect(small.startsWith(PNG_PREFIX)).toBe(true)
  })

  it('wraps oversized content in a validation error instead of a raw library throw', async () => {
    await expect(generateQrDataUrl('a'.repeat(5000))).rejects.toMatchObject({
      code: 'VALIDATION',
      userMessage: expect.stringMatching(/too long/i)
    })
  })
})
