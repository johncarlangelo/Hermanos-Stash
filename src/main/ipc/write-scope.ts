import path from 'node:path'
import { stashError } from '../../shared/errors'

/**
 * Write-scope guard for the renderer-facing filesystem bridge.
 *
 * The renderer may only write files to:
 *   1. paths the user explicitly chose via a native save dialog, or
 *   2. directories inside the app-owned temporary workspace root.
 *
 * Reads stay broad (users inspect arbitrary local files by design); writes
 * are deliberately narrow (ARCHITECTURE.md → Security).
 */
export class WriteScopeGuard {
  private approved = new Set<string>()

  constructor(private tempRootProvider: () => string) {}

  /** Register a user-approved save target (called after save dialogs). */
  approve(targetPath: string): void {
    this.approved.add(path.resolve(targetPath))
  }

  /** Drop an approval after it has been consumed or invalidated. */
  revoke(targetPath: string): void {
    this.approved.delete(path.resolve(targetPath))
  }

  isAllowed(targetPath: string): boolean {
    const resolved = path.resolve(targetPath)
    if (this.approved.has(resolved)) return true
    // An approved directory whitelists every write beneath it (e.g. an export
    // folder chosen via the directory picker covers all outputs inside).
    for (const entry of this.approved) {
      if (resolved.startsWith(entry + path.sep)) return true
    }
    const root = this.tempRootProvider()
    return resolved === root || resolved.startsWith(root + path.sep)
  }

  assertAllowed(targetPath: string): void {
    if (!this.isAllowed(targetPath)) {
      throw stashError(
        'FS_WRITE',
        'Saving there is not allowed. Choose a destination with Save As first.',
        { technicalMessage: `unapproved write target: ${targetPath}` }
      )
    }
  }
}
