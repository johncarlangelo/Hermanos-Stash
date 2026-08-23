import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { IPC } from '../../shared/ipc'
import type { FileMetadata, HistoryEntryInput } from '../../shared/ipc'
import { serializeStashError, stashError } from '../../shared/errors'
import { FavoritesStore, HistoryStore, PrefsStore, RecentsStore } from '../services/stores'
import { TempWorkspaceManager } from '../services/temp-workspace'
import { ProgressBus } from './progress'
import { WriteScopeGuard } from './write-scope'
import { assertNumber, assertOptionalString, assertString, parseFilters } from './validate'

export interface IpcServices {
  prefs: PrefsStore
  favorites: FavoritesStore
  recents: RecentsStore
  history: HistoryStore
  temp: TempWorkspaceManager
  progress: ProgressBus
  writeScope: WriteScopeGuard
}

const TEXT_FILE_LIMIT_BYTES = 32 * 1024 * 1024
/** Serialized preference values larger than this are rejected. */
const PREF_VALUE_LIMIT_BYTES = 64 * 1024

function optionalWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows()[0]
}

/**
 * Register a channel whose thrown values are always normalized into a
 * serialized StashError before crossing the process boundary.
 */
function handle(channel: string, listener: (...args: never[]) => unknown): void {
  ipcMain.handle(channel, async (...args: unknown[]) => {
    try {
      return await (listener as (...a: unknown[]) => unknown)(...args)
    } catch (err) {
      throw serializeStashError(err)
    }
  })
}

/** Register all narrow IPC channels. Each handler validates renderer input. */
export function registerIpc(services: IpcServices): void {
  // --- App info -----------------------------------------------------------
  handle(IPC.appGetInfo, () => ({
    version: app.getVersion(),
    dataFolder: app.getPath('userData')
  }))

  handle(IPC.appRevealDataFolder, async () => {
    await shell.openPath(app.getPath('userData'))
  })

  // --- Dialogs ------------------------------------------------------------
  handle(IPC.dialogOpenFile, async (_e: unknown, raw: unknown) => {
    const req = (raw ?? {}) as Record<string, unknown>
    const title = assertOptionalString(req['title'], 'title')
    const filters = parseFilters(req['filters']) ?? [{ name: 'All Files', extensions: ['*'] }]
    const multiSelections = req['multiSelections'] === true
    const options: Electron.OpenDialogOptions = {
      title,
      filters,
      properties: multiSelections ? ['openFile', 'multiSelections'] : ['openFile']
    }
    const win = optionalWindow()
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) return { cancelled: true, paths: [] }
    return { cancelled: false, paths: result.filePaths }
  })

  handle(IPC.dialogSaveFile, async (_e, raw: unknown) => {
    const req = (raw ?? {}) as Record<string, unknown>
    const saveOptions: Electron.SaveDialogOptions = {
      title: assertOptionalString(req['title'], 'title'),
      defaultPath: assertOptionalString(req['defaultName'], 'defaultName'),
      filters: parseFilters(req['filters'])
    }
    const win = optionalWindow()
    const result = win
      ? await dialog.showSaveDialog(win, saveOptions)
      : await dialog.showSaveDialog(saveOptions)
    if (result.canceled || !result.filePath) return { cancelled: true }
    // Only paths the user explicitly chose become writable targets.
    services.writeScope.approve(result.filePath)
    return { cancelled: false, path: result.filePath }
  })

  // --- Filesystem ---------------------------------------------------------
  handle(IPC.fsStat, async (_e, raw: unknown) => {
    const target = assertString(raw, 'path')
    try {
      const stat = await fs.stat(target)
      return {
        path: target,
        name: path.basename(target),
        extension: path.extname(target).toLowerCase(),
        sizeBytes: stat.size,
        isDirectory: stat.isDirectory(),
        createdAtMs: stat.birthtimeMs,
        modifiedAtMs: stat.mtimeMs
      } satisfies FileMetadata
    } catch (err) {
      throw stashError('FS_READ', `Could not read "${path.basename(target)}".`, {
        technicalMessage: String(err)
      })
    }
  })

  handle(IPC.fsReadTextFile, async (_e, raw: unknown) => {
    if (typeof raw !== 'object' || raw === null) {
      throw stashError('VALIDATION', 'Invalid request payload.')
    }
    const req = raw as Record<string, unknown>
    const target = assertString(req['path'], 'path')
    const requestedMax =
      req['maxBytes'] === undefined
        ? TEXT_FILE_LIMIT_BYTES
        : assertNumber(req['maxBytes'], 'maxBytes')
    if (requestedMax < 0) {
      throw stashError('VALIDATION', 'Invalid request: "maxBytes" cannot be negative.')
    }
    const maxBytes = Math.min(requestedMax, TEXT_FILE_LIMIT_BYTES)

    let handle
    try {
      handle = await fs.open(target, 'r')
    } catch (err) {
      throw stashError('FS_READ', `Could not open "${path.basename(target)}".`, {
        technicalMessage: String(err)
      })
    }
    try {
      const stat = await handle.stat()
      const length = Math.min(stat.size, maxBytes + 1)
      const buffer = Buffer.alloc(length)
      const { bytesRead } = await handle.read(buffer, 0, length, 0)
      const truncated = bytesRead > maxBytes
      const content = buffer.subarray(0, Math.min(bytesRead, maxBytes)).toString('utf-8')
      return { content, truncated, sizeBytes: stat.size }
    } finally {
      await handle.close()
    }
  })

  handle(IPC.fsWriteTextFile, async (_e, raw: unknown) => {
    if (typeof raw !== 'object' || raw === null) {
      throw stashError('VALIDATION', 'Invalid request payload.')
    }
    const req = raw as Record<string, unknown>
    const target = assertString(req['path'], 'path')
    if (typeof req['content'] !== 'string') {
      throw stashError('VALIDATION', 'Cannot save: the content must be text.')
    }
    const content = req['content']
    // Writes are restricted to user-approved (dialog) or temp-workspace paths.
    services.writeScope.assertAllowed(target)
    try {
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, content, 'utf-8')
      return { bytesWritten: Buffer.byteLength(content, 'utf-8') }
    } catch (err) {
      throw stashError('FS_WRITE', `Could not save to "${path.basename(target)}".`, {
        technicalMessage: String(err)
      })
    }
  })

  // --- Temporary workspace --------------------------------------------------
  handle(IPC.tempCreateOperation, (_e, prefix: unknown) =>
    services.temp.createOperation(prefix === undefined ? undefined : assertString(prefix, 'prefix'))
  )

  handle(IPC.tempCleanup, async (_e, dir: unknown) => {
    services.temp.cleanup(assertString(dir, 'dir'))
  })

  // --- Preferences ----------------------------------------------------------
  handle(IPC.prefsGet, (_e, key: unknown) => services.prefs.get(assertString(key, 'key')))
  handle(IPC.prefsSet, (_e, key: unknown, value: unknown) => {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) {
      throw stashError('VALIDATION', 'Preferences must be JSON-serializable values.')
    }
    if (Buffer.byteLength(serialized, 'utf-8') > PREF_VALUE_LIMIT_BYTES) {
      throw stashError('VALIDATION', 'That preference value is too large to store.')
    }
    services.prefs.set(assertString(key, 'key'), value)
  })

  // --- Favorites / recents / history ---------------------------------------
  handle(IPC.favoritesList, () => services.favorites.list())
  handle(IPC.favoritesToggle, (_e, toolId: unknown) =>
    services.favorites.toggle(assertString(toolId, 'toolId'))
  )
  handle(IPC.recentsList, (_e, limit: unknown) =>
    services.recents.list(limit === undefined ? undefined : assertNumber(limit, 'limit'))
  )
  handle(IPC.recentsAdd, (_e, toolId: unknown) => {
    services.recents.add(assertString(toolId, 'toolId'))
  })
  handle(IPC.historyList, (_e, limit: unknown) =>
    services.history.list(limit === undefined ? undefined : assertNumber(limit, 'limit'))
  )
  handle(IPC.historyRecord, (_e, entry: HistoryEntryInput) => services.history.record(entry))
  handle(IPC.historyClear, () => services.history.clear())

  // --- Progress / cancellation ----------------------------------------------
  handle(IPC.progressCancel, (_e, operationId: unknown) =>
    services.progress.cancel(assertString(operationId, 'operationId'))
  )
}
