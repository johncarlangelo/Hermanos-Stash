import type { StashError } from './errors'

/**
 * Narrow, typed IPC surface between renderer and main.
 * Channel names are grouped by domain and must stay stable.
 */
export const IPC = {
  appGetInfo: 'app:get-info',
  appRevealDataFolder: 'app:reveal-data-folder',

  dialogOpenFile: 'dialog:open-file',
  dialogSaveFile: 'dialog:save-file',

  fsStat: 'fs:stat',
  fsReadTextFile: 'fs:read-text-file',
  fsWriteTextFile: 'fs:write-text-file',
  fsReadFileBytes: 'fs:read-file-bytes',
  fsWriteFileBytes: 'fs:write-file-bytes',

  tempCreateOperation: 'temp:create-operation',
  tempCleanup: 'temp:cleanup',

  prefsGet: 'prefs:get',
  prefsSet: 'prefs:set',

  favoritesList: 'favorites:list',
  favoritesToggle: 'favorites:toggle',

  recentsList: 'recents:list',
  recentsAdd: 'recents:add',

  historyList: 'history:list',
  historyRecord: 'history:record',
  historyClear: 'history:clear',

  /** main → renderer push channel for long-running operations. */
  progressEvent: 'progress:event',
  progressCancel: 'progress:cancel'
} as const

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface OpenFileDialogRequest {
  title?: string
  filters?: FileFilter[]
  multiSelections?: boolean
}

export interface OpenFileDialogResult {
  cancelled: boolean
  paths: string[]
}

export interface SaveFileDialogRequest {
  title?: string
  defaultName?: string
  filters?: FileFilter[]
}

export interface SaveFileDialogResult {
  cancelled: boolean
  path?: string
}

export interface FileMetadata {
  path: string
  name: string
  extension: string
  sizeBytes: number
  isDirectory: boolean
  createdAtMs: number
  modifiedAtMs: number
}

export interface ReadTextFileRequest {
  path: string
  maxBytes?: number
}

export interface ReadTextFileResult {
  content: string
  truncated: boolean
  sizeBytes: number
}

export interface ReadFileBytesRequest {
  path: string
  maxBytes?: number
}

export interface ReadFileBytesResult {
  /** Structured-clonable, so raw bytes travel over IPC without encoding. */
  bytes: ArrayBuffer
  truncated: boolean
  sizeBytes: number
}

export interface WriteFileBytesResult {
  bytesWritten: number
}

export type OperationStatus = 'active' | 'done' | 'cancelled' | 'error'

export interface ProgressEvent {
  operationId: string
  status: OperationStatus
  /** 0..1 when known, null for indeterminate work. */
  ratio: number | null
  message?: string
  error?: StashError
}

export interface HistoryEntryInput {
  toolId: string
  operation: string
  inputs: string[]
  outputs: string[]
  status: 'success' | 'failure'
  durationMs?: number
  message?: string
}

export interface HistoryEntry extends HistoryEntryInput {
  id: number
  timestampMs: number
}

/** Shape exposed on `window.stash` by the preload bridge. */
export interface StashBridge {
  app: {
    getInfo(): Promise<{ version: string; dataFolder: string }>
    revealDataFolder(): Promise<void>
  }
  dialogs: {
    openFile(req?: OpenFileDialogRequest): Promise<OpenFileDialogResult>
    saveFile(req?: SaveFileDialogRequest): Promise<SaveFileDialogResult>
  }
  fs: {
    stat(path: string): Promise<FileMetadata>
    readTextFile(req: ReadTextFileRequest): Promise<ReadTextFileResult>
    writeTextFile(path: string, content: string): Promise<{ bytesWritten: number }>
    readFileBytes(req: ReadFileBytesRequest): Promise<ReadFileBytesResult>
    writeFileBytes(path: string, bytes: ArrayBuffer): Promise<WriteFileBytesResult>
  }
  temp: {
    createOperation(prefix?: string): Promise<string>
    cleanup(dir: string): Promise<void>
  }
  prefs: {
    get<T = unknown>(key: string): Promise<T | undefined>
    set(key: string, value: unknown): Promise<void>
  }
  favorites: {
    list(): Promise<string[]>
    toggle(toolId: string): Promise<boolean>
  }
  recents: {
    list(limit?: number): Promise<Array<{ toolId: string; lastUsedMs: number; uses: number }>>
    add(toolId: string): Promise<void>
  }
  history: {
    list(limit?: number): Promise<HistoryEntry[]>
    record(entry: HistoryEntryInput): Promise<HistoryEntry>
    clear(): Promise<void>
  }
  progress: {
    subscribe(listener: (event: ProgressEvent) => void): () => void
    cancel(operationId: string): Promise<void>
  }
}
