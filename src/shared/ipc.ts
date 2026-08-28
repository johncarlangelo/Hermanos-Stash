import type { StashError } from './errors'

/**
 * Narrow, typed IPC surface between renderer and main.
 * Channel names are grouped by domain and must stay stable.
 */
export const IPC = {
  appGetInfo: 'app:get-info',
  appRevealDataFolder: 'app:reveal-data-folder',
  appSetZoom: 'app:set-zoom',

  shellRevealPath: 'shell:reveal-path',

  dialogOpenFile: 'dialog:open-file',
  dialogSaveFile: 'dialog:save-file',
  dialogChooseDirectory: 'dialog:choose-directory',

  fsStat: 'fs:stat',
  fsListDir: 'fs:list-dir',
  fsReadTextFile: 'fs:read-text-file',
  fsWriteTextFile: 'fs:write-text-file',
  fsReadFileBytes: 'fs:read-file-bytes',
  fsWriteFileBytes: 'fs:write-file-bytes',
  fsExportFile: 'fs:export-file',

  imagesConvertBatch: 'images:convert-batch',
  imagesCompressBatch: 'images:compress-batch',
  imagesWatermarkBatch: 'images:watermark-batch',
  imagesOcr: 'images:ocr',
  socialResizeBatch: 'social:resize-batch',
  iconsGeneratePack: 'icons:generate-pack',

  zipCreateBatch: 'files:zip-create',
  zipExtractBatch: 'files:zip-extract',
  filesBatchRename: 'files:batch-rename',

  pdfMergeBatch: 'pdf:merge-batch',
  pdfGetInfo: 'pdf:get-info',
  pdfSplitBatch: 'pdf:split',
  pdfRotateBatch: 'pdf:rotate',
  pdfCompressBatch: 'pdf:compress',
  pdfReorderBatch: 'pdf:reorder',
  pdfImagesToPdfBatch: 'pdf:images-to-pdf',

  mediaGetCapabilities: 'media:get-capabilities',
  mediaProbe: 'media:probe',
  mediaConvertVideo: 'media:convert-video',
  mediaCompressVideo: 'media:compress-video',
  mediaVideoToGif: 'media:video-to-gif',
  mediaExtractAudio: 'media:extract-audio',
  mediaConvertAudio: 'media:convert-audio',

  cryptoHashText: 'crypto:hash-text',
  cryptoHashFile: 'crypto:hash-file',

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

  promptsList: 'prompts:list',
  promptsSave: 'prompts:save',
  promptsDelete: 'prompts:delete',

  /** main → renderer push channel for long-running operations. */
  progressEvent: 'progress:event',
  progressCancel: 'progress:cancel',

  queueRun: 'queue:run',
  queueList: 'queue:list',
  queueSave: 'queue:save',
  queueDelete: 'queue:delete'
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

// --- Directory listing / batch rename ----------------------------------------

export interface DirEntry {
  name: string
  isDirectory: boolean
}

export interface ListDirResult {
  /** Sorted directories-first, then alphabetically. */
  entries: DirEntry[]
}

export interface BatchRenameItem {
  from: string
  to: string
}

export interface BatchRenameRequest {
  dir: string
  renames: BatchRenameItem[]
}

export interface BatchRenameRenamed {
  from: string
  to: string
}

/** One entry the batch could not rename, with a plain-language reason. */
export interface BatchRenameSkipped {
  from: string
  reason: string
}

export interface BatchRenameResult {
  renamed: BatchRenameRenamed[]
  skipped: BatchRenameSkipped[]
}

export type ImageOutputFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'tiff'

export interface ConvertImagesRequest {
  paths: string[]
  outputDir: string
  format: ImageOutputFormat
  quality?: number
  /** Optional naming template; must contain {name}. Extension stays format-driven. */
  namePattern?: string
}

export interface CompressImagesRequest {
  paths: string[]
  outputDir: string
  quality: number
  maxDimension?: number
  /** Optional naming template; must contain {name}. Extension stays source-driven. */
  namePattern?: string
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

export interface WatermarkImagesRequest {
  paths: string[]
  outputDir: string
  text: string
  position: WatermarkPosition
  fontSize?: number
  color?: string
  opacity?: number
  marginRatio?: number
}

export type WatermarkPosition =
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'top-right'
  | 'top-center'
  | 'top-left'
  | 'center'

export type OcrPsmMode = 'auto' | 'single_block' | 'single_line' | 'single_word' | 'sparse_text'

export interface OcrImageRequest {
  path: string
  language?: string
  psm?: OcrPsmMode
  preprocess?: {
    grayscale?: boolean
    contrastEnhance?: boolean
    threshold?: boolean
  }
}

export interface OcrImageResult {
  text: string
  confidence: number
  wordCount: number
  charCount: number
  lineCount: number
  durationMs: number
}

/** One generated icon-pack artifact, e.g. "icon-128.png" or "favicon.ico". */
export interface IconPackFile {
  name: string
  path: string
  bytesWritten: number
}

export interface IconPackFailure {
  name: string
  error: StashError
}

export interface IconPackRequest {
  path: string
  outputDir: string
}

export interface IconPackResult {
  succeeded: IconPackFile[]
  failed: IconPackFailure[]
  cancelled: boolean
}

export interface SocialResizeRequest {
  paths: string[]
  outputDir: string
  /** Preset ids validated against the shared PRESET_LIST; must be non-empty. */
  presets: string[]
}

/** One file × preset output, labeled for display like "photo.jpg · OG Image". */
export interface SocialResizeSuccess {
  source: string
  label: string
  output: string
  bytesWritten: number
}

export interface SocialResizeFailure {
  label: string
  error: StashError
}

export interface SocialResizeResult {
  succeeded: SocialResizeSuccess[]
  failed: SocialResizeFailure[]
  cancelled: boolean
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

export interface PdfRotateRequest {
  path: string
  /** 'all' or an ordered page spec like "1-3, 7". */
  pageSpec: string
  angle: 90 | 180 | 270
  targetPdf: string
}

export interface PdfRotateResult {
  bytesWritten: number
  rotatedCount: number
}

export interface PdfCompressRequest {
  path: string
  targetPdf: string
}

export interface PdfCompressResult {
  bytesWritten: number
  pageCount: number
}

export interface PdfReorderRequest {
  path: string
  /** Explicit full sequence — 'all' is not accepted here. */
  pageSpec: string
  targetPdf: string
}

export interface PdfReorderResult {
  bytesWritten: number
  pageCount: number
}

/** One image file per page, at each image's natural pixel size. */
export interface ImagesToPdfRequest {
  paths: string[]
  targetPdf: string
}

export type OperationStatus = 'active' | 'done' | 'cancelled' | 'error'

// --- Media (FFmpeg) ---------------------------------------------------------

export interface MediaCapabilities {
  available: boolean
  source?: 'bundled' | 'path'
  ffmpegVersion?: string
  ffprobeVersion?: string
}

/** One decoded stream from ffprobe, sanitized for the renderer. */
export interface MediaStreamInfo {
  type: 'video' | 'audio' | 'other'
  codec?: string
  width?: number
  height?: number
  sampleRate?: number
  channels?: number
}

export interface MediaInfo {
  durationSec?: number
  formatName?: string
  bitrate?: number
  sizeBytes?: number
  streams: MediaStreamInfo[]
}

export interface MediaProbeResult {
  info: MediaInfo
  /** Size on disk of the probed file. */
  sizeBytes: number
}

export type VideoOutputFormat = 'mp4' | 'webm' | 'mkv'

export type AudioCodec = 'aac' | 'mp3' | 'wav' | 'flac' | 'opus'

export interface ConvertVideoRequest {
  path: string
  outputDir: string
  format: VideoOutputFormat
  crfQuality?: number
  /** Optional output base name; the format still forces the extension. */
  fileName?: string
}

export interface CompressVideoRequest {
  path: string
  outputDir: string
  crfQuality: number
  maxDimension?: number
  /** Optional output base name; .mp4 stays forced. */
  fileName?: string
}

export interface VideoToGifRequest {
  path: string
  outputDir: string
  fps: number
  maxWidth: number
  /** Optional output base name; .gif stays forced. */
  fileName?: string
}

export interface ExtractAudioRequest {
  path: string
  outputDir: string
  codec: AudioCodec
  bitrateKbps?: number
  /** Optional output base name; the codec still forces the extension. */
  fileName?: string
}

export interface ConvertAudioRequest {
  path: string
  outputDir: string
  codec: AudioCodec
  bitrateKbps?: number
  /** Optional output base name; the codec still forces the extension. */
  fileName?: string
}

/** One successfully processed media file. */
export interface MediaBatchSuccess {
  source: string
  output: string
  bytesWritten: number
  verified: boolean
}

export interface MediaBatchFailure {
  source: string
  error: StashError
}

export interface MediaBatchResult {
  succeeded: MediaBatchSuccess[]
  failed: MediaBatchFailure[]
  cancelled: boolean
}

export interface ProgressEvent {
  operationId: string
  status: OperationStatus
  /** 0..1 when known, null for indeterminate work. */
  ratio: number | null
  message?: string
  error?: StashError
}

// --- Crypto (hashing) ---------------------------------------------------------

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512'

export interface HashTextRequest {
  algorithm: HashAlgorithm
  text: string
}

export interface HashTextResult {
  hex: string
}

export interface HashFileRequest {
  path: string
  algorithm: HashAlgorithm
}

export interface HashFileResult {
  hex: string
  sizeBytes: number
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

export interface PromptRecord {
  id: number
  title: string
  body: string
  tags: string[]
  createdAtMs: number
  updatedAtMs: number
}

export interface PromptSaveInput {
  id?: number
  title: string
  body: string
  tags: string[]
}

/** Shape exposed on `window.stash` by the preload bridge. */
export interface StashBridge {
  app: {
    getInfo(): Promise<{ version: string; dataFolder: string }>
    revealDataFolder(): Promise<void>
    /** Live-apply a renderer zoom factor (clamped main-side). */
    setZoom(factor: number): Promise<void>
  }
  shell: {
    revealPath(path: string): Promise<void>
  }
  files: {
    /** Absolute OS path for a dropped File (Electron ≥32 removed File.path). */
    getPathForFile(file: File): string
    listDir(path: string): Promise<ListDirResult>
    batchRename(req: BatchRenameRequest): Promise<BatchRenameResult>
  }
  dialogs: {
    openFile(req?: OpenFileDialogRequest): Promise<OpenFileDialogResult>
    saveFile(req?: SaveFileDialogRequest): Promise<SaveFileDialogResult>
    chooseDirectory(req?: { title?: string }): Promise<ChooseDirectoryResult>
  }
  fs: {
    stat(path: string): Promise<FileMetadata>
    readTextFile(req: ReadTextFileRequest): Promise<ReadTextFileResult>
    writeTextFile(req: { path: string; content: string }): Promise<{ bytesWritten: number }>
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
  prompts: {
    list(): Promise<PromptRecord[]>
    save(input: PromptSaveInput): Promise<PromptRecord>
    delete(id: number): Promise<void>
  }
  processing: {
    convertImages(req: ConvertImagesRequest): Promise<ImageBatchResult>
    compressImages(req: CompressImagesRequest): Promise<ImageBatchResult>
    watermarkImages(req: WatermarkImagesRequest): Promise<ImageBatchResult>
    socialResize(req: SocialResizeRequest): Promise<SocialResizeResult>
    ocrImage(req: OcrImageRequest, jobId?: string): Promise<OcrImageResult>
  }
  icons: {
    generatePack(req: IconPackRequest): Promise<IconPackResult>
  }
  archives: {
    createZip(req: ZipCreateRequest): Promise<ZipCreateResult>
    extractZip(req: ZipExtractRequest): Promise<ZipExtractResult>
  }
  pdfs: {
    merge(req: PdfMergeRequest): Promise<PdfMergeResult>
    getInfo(path: string): Promise<PdfInfoResult>
    split(req: PdfSplitRequest): Promise<PdfSplitResult>
    rotate(req: PdfRotateRequest): Promise<PdfRotateResult>
    compress(req: PdfCompressRequest): Promise<PdfCompressResult>
    reorder(req: PdfReorderRequest): Promise<PdfReorderResult>
    imagesToPdf(req: ImagesToPdfRequest): Promise<PdfMergeResult>
  }
  media: {
    getCapabilities(): Promise<MediaCapabilities>
    probe(path: string): Promise<MediaProbeResult>
    convertVideo(req: ConvertVideoRequest): Promise<MediaBatchResult>
    compressVideo(req: CompressVideoRequest): Promise<MediaBatchResult>
    videoToGif(req: VideoToGifRequest): Promise<MediaBatchResult>
    extractAudio(req: ExtractAudioRequest): Promise<MediaBatchResult>
    convertAudio(req: ConvertAudioRequest): Promise<MediaBatchResult>
  }
  crypto: {
    hashText(req: HashTextRequest): Promise<HashTextResult>
    hashFile(req: HashFileRequest): Promise<HashFileResult>
  }
  progress: {
    subscribe(listener: (event: ProgressEvent) => void): () => void
    cancel(operationId: string): Promise<void>
  }
}
