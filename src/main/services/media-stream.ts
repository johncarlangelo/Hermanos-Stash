interface CachedMedia {
  buffer: Buffer
  mimeType: string
  timestamp: number
}

const mediaCache = new Map<string, CachedMedia>()

/**
 * Registers an in-memory media buffer for HTTP 206 partial content streaming.
 * Returns a stable token id for `stash-media://stream/<token>`.
 */
export function registerMediaBuffer(buffer: Buffer | Uint8Array, mimeType: string): string {
  const nodeBuf = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  mediaCache.set(id, {
    buffer: nodeBuf,
    mimeType,
    timestamp: Date.now()
  })

  // Purge old cache entries (keep max 30 recent items)
  if (mediaCache.size > 30) {
    const sorted = Array.from(mediaCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)
    for (let i = 0; i < sorted.length - 30; i++) {
      mediaCache.delete(sorted[i][0])
    }
  }
  return id
}

export function getCachedMedia(id: string): CachedMedia | undefined {
  return mediaCache.get(id)
}
