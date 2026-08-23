import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TempWorkspaceManager, tempRootFor } from './temp-workspace'

function makeManager(): { manager: TempWorkspaceManager; base: string } {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'stash-test-'))
  return { manager: new TempWorkspaceManager(base), base }
}

describe('TempWorkspaceManager', () => {
  it('creates isolated operation directories under the workspace root', () => {
    const { manager, base } = makeManager()
    try {
      const dir = manager.createOperation('pdf-merge')
      expect(path.dirname(dir)).toBe(path.join(base, tempRootFor('').split(path.sep).pop()!))
      expect(fs.existsSync(dir)).toBe(true)
      expect(path.basename(dir)).toMatch(/^pdf-merge-/)
      const other = manager.createOperation('pdf-merge')
      expect(other).not.toBe(dir)
    } finally {
      manager.disposeAll()
    }
  })

  it('sanitizes unsafe prefixes', () => {
    const { manager } = makeManager()
    try {
      const dir = manager.createOperation('../../evil name!')
      expect(path.basename(dir)).toMatch(/^[a-z0-9_-]+-[a-z0-9]+-[a-f0-9]{12}$/)
    } finally {
      manager.disposeAll()
    }
  })

  it('cleans up its own directories but refuses paths outside the root', () => {
    const { manager, base } = makeManager()
    try {
      const dir = manager.createOperation()
      manager.cleanup(dir)
      expect(fs.existsSync(dir)).toBe(false)
      expect(() => manager.cleanup(base)).toThrow(/outside the temporary workspace/)
    } finally {
      manager.disposeAll()
    }
  })

  it('purges stale directories older than the threshold', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'stash-test-'))
    const realNow = Date.now()
    const fakeNow = realNow
    const manager = new TempWorkspaceManager(
      base,
      () => fakeNow,
      () => 'a'.repeat(12)
    )
    const stale = manager.createOperation('stale')

    // Backdate the directory's mtime beyond the staleness threshold.
    const pastMs = realNow - 72 * 60 * 60 * 1000
    fs.utimesSync(stale, pastMs / 1000, pastMs / 1000)

    const fresh = manager.createOperation('fresh')
    expect(manager.purgeStale()).toBeGreaterThanOrEqual(1)
    expect(fs.existsSync(stale)).toBe(false)
    expect(fs.existsSync(fresh)).toBe(true)
    manager.disposeAll()
  })
})
