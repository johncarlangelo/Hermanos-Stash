import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  HistoryEntryInput,
  OpenFileDialogRequest,
  ProgressEvent,
  ReadTextFileRequest,
  SaveFileDialogRequest,
  StashBridge
} from '../shared/ipc'

/**
 * Secure preload bridge. Only the narrow, typed surface below is exposed to
 * the renderer — no raw Node or Electron APIs leak through (ARCHITECTURE.md).
 */

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>
}

const api: StashBridge = {
  app: {
    getInfo: () => invoke(IPC.appGetInfo),
    revealDataFolder: () => invoke(IPC.appRevealDataFolder)
  },
  dialogs: {
    openFile: (req?: OpenFileDialogRequest) => invoke(IPC.dialogOpenFile, req ?? {}),
    saveFile: (req?: SaveFileDialogRequest) => invoke(IPC.dialogSaveFile, req ?? {})
  },
  fs: {
    stat: (path: string) => invoke(IPC.fsStat, path),
    readTextFile: (req: ReadTextFileRequest) => invoke(IPC.fsReadTextFile, req),
    writeTextFile: (path: string, content: string) => invoke(IPC.fsWriteTextFile, path, content)
  },
  temp: {
    createOperation: (prefix?: string) => invoke(IPC.tempCreateOperation, prefix),
    cleanup: (dir: string) => invoke(IPC.tempCleanup, dir)
  },
  prefs: {
    get: <T>(key: string) => invoke<T | undefined>(IPC.prefsGet, key),
    set: (key: string, value: unknown) => invoke<void>(IPC.prefsSet, key, value)
  },
  favorites: {
    list: () => invoke<string[]>(IPC.favoritesList),
    toggle: (toolId: string) => invoke<boolean>(IPC.favoritesToggle, toolId)
  },
  recents: {
    list: (limit?: number) => invoke(IPC.recentsList, limit),
    add: (toolId: string) => invoke<void>(IPC.recentsAdd, toolId)
  },
  history: {
    list: (limit?: number) => invoke(IPC.historyList, limit),
    record: (entry: HistoryEntryInput) => invoke(IPC.historyRecord, entry),
    clear: () => invoke<void>(IPC.historyClear)
  },
  progress: {
    subscribe: (listener: (event: ProgressEvent) => void) => {
      const wrapped = (_event: IpcRendererEvent, payload: ProgressEvent): void => listener(payload)
      ipcRenderer.on(IPC.progressEvent, wrapped)
      return () => {
        ipcRenderer.removeListener(IPC.progressEvent, wrapped)
      }
    },
    cancel: (operationId: string) => invoke<void>(IPC.progressCancel, operationId)
  }
}

contextBridge.exposeInMainWorld('stash', api)
