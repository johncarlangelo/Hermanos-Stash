import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  BatchRenameRequest,
  CompressImagesRequest,
  CompressVideoRequest,
  ConvertAudioRequest,
  ConvertImagesRequest,
  ConvertVideoRequest,
  ExportFileRequest,
  ExtractAudioRequest,
  HashFileRequest,
  HashTextRequest,
  HistoryEntryInput,
  IconPackRequest,
  OcrImageRequest,
  OcrImageResult,
  PromptSaveInput,
  ImagesToPdfRequest,
  OpenFileDialogRequest,
  PdfCompressRequest,
  PdfMergeRequest,
  PdfReorderRequest,
  PdfRotateRequest,
  PdfSplitRequest,
  ProgressEvent,
  ReadFileBytesRequest,
  ReadTextFileRequest,
  SaveFileDialogRequest,
  SocialResizeRequest,
  StashBridge,
  VideoToGifRequest,
  WatermarkImagesRequest,
  ZipCreateRequest,
  ZipExtractRequest,
  ArchiveInspectRequest,
  ArchiveInspectResult,
  ArchiveReadEntryRequest,
  ArchiveReadEntryResult,
  ArchiveExtractEntryRequest,
  ArchiveExtractEntryResult,
  AssetFilter
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
    revealDataFolder: () => invoke(IPC.appRevealDataFolder),
    setZoom: (factor: number) => invoke<void>(IPC.appSetZoom, factor)
  },
  shell: {
    revealPath: (path: string) => invoke<void>(IPC.shellRevealPath, path)
  },
  dialogs: {
    openFile: (req?: OpenFileDialogRequest) => invoke(IPC.dialogOpenFile, req ?? {}),
    saveFile: (req?: SaveFileDialogRequest) => invoke(IPC.dialogSaveFile, req ?? {}),
    chooseDirectory: (req?: { title?: string }) => invoke(IPC.dialogChooseDirectory, req ?? {})
  },
  fs: {
    stat: (path: string) => invoke(IPC.fsStat, path),
    readTextFile: (req: ReadTextFileRequest) => invoke(IPC.fsReadTextFile, req),
    writeTextFile: (req: { path: string; content: string }) => invoke(IPC.fsWriteTextFile, req),
    readFileBytes: (req: ReadFileBytesRequest) => invoke(IPC.fsReadFileBytes, req),
    writeFileBytes: (path: string, bytes: ArrayBuffer) =>
      invoke(IPC.fsWriteFileBytes, { path, bytes }),
    exportFile: (req: ExportFileRequest) => invoke(IPC.fsExportFile, req)
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
  prompts: {
    list: () => invoke(IPC.promptsList),
    save: (input: PromptSaveInput) => invoke(IPC.promptsSave, input),
    delete: (id: number) => invoke(IPC.promptsDelete, id)
  },
  processing: {
    convertImages: (req: ConvertImagesRequest) => invoke(IPC.imagesConvertBatch, req),
    compressImages: (req: CompressImagesRequest) => invoke(IPC.imagesCompressBatch, req),
    watermarkImages: (req: WatermarkImagesRequest) => invoke(IPC.imagesWatermarkBatch, req),
    socialResize: (req: SocialResizeRequest) => invoke(IPC.socialResizeBatch, req),
    ocrImage: (req: OcrImageRequest, jobId?: string) =>
      invoke<OcrImageResult>(IPC.imagesOcr, req, jobId)
  },
  icons: {
    generatePack: (req: IconPackRequest) => invoke(IPC.iconsGeneratePack, req)
  },
  archives: {
    createZip: (req: ZipCreateRequest) => invoke(IPC.zipCreateBatch, req),
    extractZip: (req: ZipExtractRequest) => invoke(IPC.zipExtractBatch, req),
    inspect: (req: ArchiveInspectRequest) => invoke<ArchiveInspectResult>(IPC.archivesInspect, req),
    readEntry: (req: ArchiveReadEntryRequest) =>
      invoke<ArchiveReadEntryResult>(IPC.archivesReadEntry, req),
    extractEntry: (req: ArchiveExtractEntryRequest) =>
      invoke<ArchiveExtractEntryResult>(IPC.archivesExtractEntry, req)
  },
  pdfs: {
    merge: (req: PdfMergeRequest) => invoke(IPC.pdfMergeBatch, req),
    getInfo: (path: string) => invoke(IPC.pdfGetInfo, path),
    split: (req: PdfSplitRequest) => invoke(IPC.pdfSplitBatch, req),
    rotate: (req: PdfRotateRequest) => invoke(IPC.pdfRotateBatch, req),
    compress: (req: PdfCompressRequest) => invoke(IPC.pdfCompressBatch, req),
    reorder: (req: PdfReorderRequest) => invoke(IPC.pdfReorderBatch, req),
    imagesToPdf: (req: ImagesToPdfRequest) => invoke(IPC.pdfImagesToPdfBatch, req)
  },
  media: {
    getCapabilities: () => invoke(IPC.mediaGetCapabilities),
    probe: (path: string) => invoke(IPC.mediaProbe, path),
    convertVideo: (req: ConvertVideoRequest) => invoke(IPC.mediaConvertVideo, req),
    compressVideo: (req: CompressVideoRequest) => invoke(IPC.mediaCompressVideo, req),
    videoToGif: (req: VideoToGifRequest) => invoke(IPC.mediaVideoToGif, req),
    extractAudio: (req: ExtractAudioRequest) => invoke(IPC.mediaExtractAudio, req),
    convertAudio: (req: ConvertAudioRequest) => invoke(IPC.mediaConvertAudio, req)
  },
  crypto: {
    hashText: (req: HashTextRequest) => invoke(IPC.cryptoHashText, req),
    hashFile: (req: HashFileRequest) => invoke(IPC.cryptoHashFile, req)
  },
  files: {
    // Electron ≥ 32 removed File.path; this is the documented replacement,
    // exposed through the bridge so sandboxed renderers stay Node-free.
    getPathForFile: (file: File) => webUtils.getPathForFile(file),
    listDir: (path: string) => invoke(IPC.fsListDir, path),
    batchRename: (req: BatchRenameRequest) => invoke(IPC.filesBatchRename, req)
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
  },
  assets: {
    list: (filter?: AssetFilter) => invoke(IPC.assetsList, filter),
    add: (filePath: string, sourceToolId?: string, tags?: string[]) =>
      invoke(IPC.assetsAdd, filePath, sourceToolId, tags),
    addBatch: (filePaths: string[], sourceToolId?: string) =>
      invoke(IPC.assetsAddBatch, filePaths, sourceToolId),
    toggleFavorite: (id: number) => invoke(IPC.assetsToggleFavorite, id),
    remove: (id: number) => invoke(IPC.assetsRemove, id),
    checkExistence: (id: number) => invoke(IPC.assetsCheckExistence, id),
    cleanupMissing: () => invoke(IPC.assetsCleanupMissing)
  }
}

contextBridge.exposeInMainWorld('stash', api)
