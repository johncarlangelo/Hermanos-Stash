import { describe, expect, it } from 'vitest'
import { getCachedMedia, registerMediaBuffer } from './media-stream'

describe('MediaStream Service', () => {
  it('registers and retrieves cached media buffers', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])
    const id = registerMediaBuffer(data, 'video/mp4')

    const cached = getCachedMedia(id)
    expect(cached).toBeDefined()
    expect(cached?.mimeType).toBe('video/mp4')
    expect(cached?.buffer.length).toBe(5)
    expect(cached?.buffer[0]).toBe(1)
  })

  it('handles Buffer input directly', () => {
    const nodeBuf = Buffer.from('hello world', 'utf-8')
    const id = registerMediaBuffer(nodeBuf, 'text/plain')

    const cached = getCachedMedia(id)
    expect(cached).toBeDefined()
    expect(cached?.buffer.toString('utf-8')).toBe('hello world')
  })
})
