import { describe, expect, it } from 'vitest'
import '../../renderer/tools'
import { EXTENSION_TOOL_HINTS, extensionOfPath, toolsForExtension } from './routing'
import { TOOL_DEFINITIONS } from '../../renderer/tools'

describe('extensionOfPath', () => {
  it('extracts lowercase extensions from paths', () => {
    expect(extensionOfPath('C:\\a\\b\\Photo.JPG')).toBe('jpg')
    expect(extensionOfPath('/x/archive.tar.gz')).toBe('gz')
    expect(extensionOfPath('README')).toBe('')
  })
})

describe('toolsForExtension', () => {
  it('returns registered tools in preference order', () => {
    expect(toolsForExtension('.PDF')).toEqual([
      'pdf-preview',
      'pdf-merge',
      'pdf-split',
      'pdf-rotate',
      'pdf-reorder',
      'pdf-compress',
      'pdf-to-images'
    ])
    expect(toolsForExtension('png')[0]).toBe('image-preview')
  })

  it('filters hints down to registered tools only', () => {
    const registered = new Set(TOOL_DEFINITIONS.map((d) => d.id))
    for (const [ext, ids] of toolsForExtensionEntries()) {
      for (const id of ids) {
        expect(registered.has(id), `${id} hinted for .${ext} but not registered`).toBe(true)
      }
    }
  })

  it('returns empty for unknown or empty extensions', () => {
    expect(toolsForExtension('zzz')).toEqual([])
    expect(toolsForExtension('')).toEqual([])
    expect(toolsForExtension('   ')).toEqual([])
  })
})

function toolsForExtensionEntries(): Array<[string, string[]]> {
  return Object.entries(EXTENSION_TOOL_HINTS).map(([ext]) => [ext, toolsForExtension(ext)])
}
