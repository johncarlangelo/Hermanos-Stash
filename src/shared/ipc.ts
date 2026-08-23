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
  dialogChooseDirectory: 'dialog:choose-directory',

  fsStat: 'fs:stat',
  fsReadTextFile: 'fs:read-text-file',
  fsWriteTextFile: 'fs:write-text-file',
  fsReadFileBytes: 'fs:read-file-bytes',
  fsWriteFileBytes: 'fs:write-file-bytes',
  fsExportFile: 'fs:export-file',

  imagesConvertBatch: 'images:convert-batch',
  imagesCompressBatch: 'images:compress-batch',

  zipCreateBatch: 'files:zip-create',
  zipExtractBatch: 'files:zip-extract',

  pdfMergeBatch: 'pdf:merge-batch',
  pdfGetInfo: 'pdf:get-info',
  pdfSplitBatch: 'pdf:split',

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

export interface ChooseDirectoryResult {
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

export interface ExportFileRequest {
  sourcePath: string
  targetPath: string
}

export type ImageOutputFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'tiff'

export interface ConvertImagesRequest {
  paths: string[]
  outputDir: string
  format: ImageOutputFormat
  quality?: number
}

export interface CompressImagesRequest {
  paths: string[]
  outputDir: string
  quality: number
  maxDimension?: number
}

/** One successfully processed file inside a batch. */
export interface ImageBatchSuccess {
  source: string
  output: string
  bytesWritten: number
}

/** One failed file inside a batch — the batch itself keeps going. */
export interface ImageBatchFailure {
  source: string
  error: StashError
}

export interface ImageBatchResult {
  succeeded: ImageBatchSuccess[]
  failed: ImageBatchFailure[]
  cancelled: boolean
  operationId: string
}

export interface ZipCreateRequest {
  paths: string[]
  targetZip: string
}

export interface ZipCreateResult {
  bytesWritten: number
  fileCount: number
}

export interface ZipExtractRequest {
  zipPath: string
  outputDir: string
}

export interface ZipExtractResult {
  extractedCount: number
  /** Entry names rejected by the zip-slip guard. */
  skipped: string[]
  topLevelCount: number
}

export interface PdfMergeRequest {
  paths: string[]
  targetPdf: string
}

export interface PdfMergeResult {
  bytesWritten: number
  pageCount: number
}

export interface PdfInfoResult {
  pageCount: number
  sizeBytes: number
}

export interface PdfSplitRequest {
  path: string
  pageSpec: string
  outputDir: string
}

/** One successfully written split output, e.g. "report-p1-p3.pdf". */
export interface PdfSplitSuccess {
  label: string
  output: string
  bytesWritten: number
}

export interface PdfSplitFailure {
  label: string
  error: StashError
}

export interface PdfSplitResult {
  succeeded: PdfSplitSuccess[]
  failed: PdfSplitFailure[]
  cancelled: boolean
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
    chooseDirectory(req?: { title?: string }): Promise<ChooseDirectoryResult>
  }
  fs: {
    stat(path: string): Promise<FileMetadata>
    readTextFile(req: ReadTextFileRequest): Promise<ReadTextFileResult>
    writeTextFile(path: string, content: string): Promise<{ bytesWritten: number }>
    readFileBytes(req: ReadFileBytesRequest): Promise<ReadFileBytesResult>
    writeFileBytes(path: string, bytes: ArrayBuffer): Promise<WriteFileBytesResult>
    exportFile(req: ExportFileRequest): Promise<{ bytesWritten: number }>
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
  processing: {
    convertImages(req: ConvertImagesRequest): Promise<ImageBatchResult>
    compressImages(req: CompressImagesRequest): Promise<ImageBatchResult>
  }
  archives: {
    createZip(req: ZipCreateRequest): Promise<ZipCreateResult>
    extractZip(req: ZipExtractRequest): Promise<ZipExtractResult>
  }
  pdfs: {
    merge(req: PdfMergeRequest): Promise<PdfMergeResult>
    getInfo(path: string): Promise<PdfInfoResult>
    split(req: PdfSplitRequest): Promise<PdfSplitResult>
  }
  progress: {
    subscribe(listener: (event: ProgressEvent) => void): () => void
    cancel(operationId: string): Promise<void>
  }
}
