import { describe, expect, it } from 'vitest'
import { outputDirPrefKey } from './use-output-dir'

describe('outputDirPrefKey', () => {
  it('namespaces the remembered folder under the tool id', () => {
    expect(outputDirPrefKey('image-convert')).toBe('outDir:image-convert')
    expect(outputDirPrefKey('video-gif')).toBe('outDir:video-gif')
  })

  it('keeps distinct tools independent', () => {
    const keys = ['image-convert', 'image-compress', 'pdf-split', 'zip-extract'].map(
      outputDirPrefKey
    )
    expect(new Set(keys).size).toBe(keys.length)
  })
})
