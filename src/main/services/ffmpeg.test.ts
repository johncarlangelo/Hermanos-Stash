import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { candidateDirs, findBundledBinaries, parseVersionLine } from './ffmpeg'

describe('candidateDirs', () => {
  it('prefers the packaged resources dir, then the app root', () => {
    expect(candidateDirs({ resourcesPath: 'C:\\app', appPath: 'D:\\repo' })).toEqual([
      path.join('C:\\app', 'ffmpeg'),
      path.join('D:\\repo', 'resources', 'ffmpeg')
    ])
  })

  it('tolerates missing inputs and de-duplicates', () => {
    const only = candidateDirs({ appPath: '/repo' })
    expect(only).toEqual([path.join('/repo', 'resources', 'ffmpeg')])
    expect(candidateDirs({ appPath: '/same', resourcesPath: '/same' })).toHaveLength(2)
  })
})

describe('findBundledBinaries', () => {
  it('returns null when a directory lacks either executable', () => {
    expect(findBundledBinaries(['Z:/definitely/not/here'])).toBeNull()
  })

  it('finds both exes in the real bundled folder when present', () => {
    // Repo layout check — skipped silently when the binaries are absent
    // (vitest runs from the repo root).
    const repoDir = path.resolve(process.cwd(), 'resources/ffmpeg')
    const probe = findBundledBinaries([repoDir])
    if (!probe) return
    expect(probe.ffmpegPath.toLowerCase()).toContain('ffmpeg')
    expect(probe.ffprobePath.toLowerCase()).toContain('ffprobe')
  })
})

describe('parseVersionLine', () => {
  it('returns the first non-empty line trimmed', () => {
    expect(parseVersionLine('\r\nffmpeg version 6.1-full_build-www.gyan.dev\r\nmore')).toBe(
      'ffmpeg version 6.1-full_build-www.gyan.dev'
    )
  })

  it('returns null for empty output', () => {
    expect(parseVersionLine('')).toBeNull()
    expect(parseVersionLine('\n \n')).toBeNull()
  })
})
