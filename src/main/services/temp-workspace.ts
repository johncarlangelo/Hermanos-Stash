import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

/**
 * Temporary workspace manager.
 *
 * Every processing operation gets an isolated directory under a single
 * app-owned root inside the OS temp folder. Stale directories from previous
 * sessions are purged at startup; everything is wiped again on quit
 * (ARCHITECTURE.md → File lifecycle).
 */

export const TEMP_ROOT_NAME = 'hermanos-stash'
/** Directories older than this are treated as abandoned by previous sessions. */
export const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000

export function tempRootFor(osTmpDir: string): string {
  return path.join(osTmpDir, TEMP_ROOT_NAME)
}

export class TempWorkspaceManager {
  private root: string

  constructor(
    osTmpDir: string,
    private now: () => number = Date.now,
    private rng: () => string = () => randomBytes(6).toString('hex')
  ) {
    this.root = tempRootFor(osTmpDir)
    fs.mkdirSync(this.root, { recursive: true })
  }

  get rootPath(): string {
    return this.root
  }

  /** Create (or reuse) the isolated directory for one operation. */
  createOperation(prefix?: string): string {
    const safePrefix = (prefix ?? 'op').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'op'
    const dir = path.join(this.root, `${safePrefix}-${this.now().toString(36)}-${this.rng()}`)
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  /** Remove one operation directory if it belongs to our workspace. */
  cleanup(dir: string): void {
    const resolved = path.resolve(dir)
    const normalizedRoot = path.resolve(this.root)
    if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
      throw new Error('Refusing to clean up a directory outside the temporary workspace.')
    }
    fs.rmSync(resolved, { recursive: true, force: true })
  }

  /** Remove abandoned directories left behind by earlier sessions. */
  purgeStale(): number {
    let removed = 0
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(this.root, { withFileTypes: true })
    } catch {
      return 0
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dir = path.join(this.root, entry.name)
      try {
        const stat = fs.statSync(dir)
        if (this.now() - stat.mtimeMs > STALE_THRESHOLD_MS) {
          this.cleanup(dir)
          removed += 1
        }
      } catch {
        // Unreadable entry — skip it rather than fail startup.
      }
    }
    return removed
  }

  /** Wipe everything on quit. */
  disposeAll(): void {
    try {
      fs.rmSync(this.root, { recursive: true, force: true })
    } catch {
      // Best effort during shutdown.
    }
  }
}
