import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { IPC } from '../../shared/ipc'
import type {
  AudioCodec,
  BatchRenameItem,
  ConvertAudioRequest,
  DirEntry,
  ExtractAudioRequest,
  FileMetadata,
  HashAlgorithm,
  HashFileResult,
  HistoryEntryInput,
  IconPackResult,
  ImageBatchResult,
  ImageOutputFormat,
  MediaBatchFailure,
  MediaBatchResult,
  MediaBatchSuccess,
  MediaCapabilities,
  OcrImageRequest,
  OcrImageResult,
  OcrPsmMode,
  VideoOutputFormat,
  PdfSplitFailure,
  PdfSplitResult,
  PdfSplitSuccess,
  SocialResizeResult
} from '../../shared/ipc'
import { serializeStashError, stashError, type StashError } from '../../shared/errors'
import {
  FavoritesStore,
  HistoryStore,
  PrefsStore,
  PromptsStore,
  RecentsStore
} from '../services/stores'
import { TempWorkspaceManager } from '../services/temp-workspace'
import { getVersion, resolveFfmpegBinaries } from '../services/ffmpeg'
import { ProgressBus } from './progress'
import { WriteScopeGuard } from './write-scope'
import {
  assertNumber,
  assertOptionalString,
  assertString,
  parseFilters,
  parseOptionalFileName,
  parseOptionalNamePattern
} from './validate'
import { createZipArchive, extractZipArchive } from '../processing/archives'
import {
  inspectArchive,
  readArchiveEntry,
  extractArchiveEntry
} from '../processing/archive-inspector'
import {
  SUPPORTED_FORMATS,
  WATERMARK_POSITIONS,
  clampWatermarkFontSize,
  compressImage,
  convertImage,
  formatForExtension,
  isValidWatermarkColor,
  normalizeWatermarkText,
  socialResizeImage,
  watermarkImage
} from '../processing/images'
import { ocrImage } from '../processing/ocr'
import {
  FAVICON_NAME,
  ICON_PACK_SIZES,
  iconFileName,
  loadSquareLogo,
  writeFaviconIco,
  writeIconPng
} from '../processing/icons'
import {
  IMAGES_TO_PDF_EXTENSIONS,
  PDF_INPUT_LIMIT_BYTES,
  compressPdf,
  getPdfInfo,
  imagesToPdf,
  mergePdfs,
  reorderPdf,
  rotatePdf,
  splitPdfPages
} from '../processing/pdf'
import {
  AUDIO_EXTENSION_BY_CODEC,
  compressVideo,
  convertAudio,
  convertVideo,
  extractAudio,
  probeMedia,
  videoToGif,
  type MediaOpResult,
  type MediaToolsContext
} from '../processing/media'
import { parsePageRanges, parsePageSequence } from '../../shared/utils/page-ranges'
import { socialPresetById } from '../../shared/utils/social-presets'
import type { WatermarkPosition } from '../../shared/ipc'
import { clampZoomFactor, overlayHeightFor } from '../../shared/utils/zoom'

export interface IpcServices {
  prefs: PrefsStore
  favorites: FavoritesStore
  recents: RecentsStore
  history: HistoryStore
  prompts: PromptsStore
  temp: TempWorkspaceManager
  progress: ProgressBus
  writeScope: WriteScopeGuard
}

const TEXT_FILE_LIMIT_BYTES = 32 * 1024 * 1024
/** Hard cap for raw binary reads/writes — larger files are rejected upfront. */
const BINARY_FILE_LIMIT_BYTES = 64 * 1024 * 1024
/** Serialized preference values larger than this are rejected. */
const PREF_VALUE_LIMIT_BYTES = 64 * 1024

/** Upper bound for one batch-rename invocation. */
const MAX_RENAMES_PER_BATCH = 1000

/**
 * Plain-language skip reason: structured StashErrors carry an actionable
 * message; raw OS failures keep their own text.
 */
function skipReason(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const message = (err as { userMessage?: unknown }).userMessage
    if (typeof message === 'string' && message) return message
  }
  return err instanceof Error ? err.message : String(err)
}

function optionalWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows()[0]
}

/** Reject paths outside the app-owned temporary workspace. */
function assertInsideTempRoot(temp: TempWorkspaceManager, target: string): void {
  const resolved = path.resolve(target)
  const root = path.resolve(temp.rootPath)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw stashError('VALIDATION', 'That source path is not part of a Stash operation.', {
      technicalMessage: `outside temp root: ${target}`
    })
  }
}

function assertPayload(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) {
    throw stashError('VALIDATION', 'Invalid request payload.')
  }
  return raw as Record<string, unknown>
}

function assertPathsArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((p) => typeof p === 'string')) {
    throw stashError(
      'VALIDATION',
      'Invalid request: "paths" must be a non-empty array of file paths.'
    )
  }
  return value as string[]
}

function parseImageFormat(value: unknown): ImageOutputFormat {
  if (typeof value === 'string' && (SUPPORTED_FORMATS as readonly string[]).includes(value)) {
    return value as ImageOutputFormat
  }
  throw stashError('VALIDATION', 'Invalid request: "format" is not a supported image format.', {
    technicalMessage: `format=${JSON.stringify(value)}`
  })
}

const EXTENSION_BY_FORMAT: Record<ImageOutputFormat, string> = {
  png: '.png',
  jpeg: '.jpg',
  webp: '.webp',
  avif: '.avif',
  tiff: '.tiff'
}

function swapExtension(name: string, format: ImageOutputFormat): string {
  const dot = name.lastIndexOf('.')
  const stem = dot <= 0 ? name : name.slice(0, dot)
  return stem + EXTENSION_BY_FORMAT[format]
}

/** File stem of a base name, e.g. "photo.png" → "photo". */
function stemOf(base: string): string {
  const dot = base.lastIndexOf('.')
  return dot <= 0 ? base : base.slice(0, dot)
}

/**
 * Output extension that keeps the source's own format when sharp can encode
 * it; otherwise falls back to PNG.
 */
function outputExtensionFor(source: string): string {
  const dot = path.basename(source).lastIndexOf('.')
  const extension = dot <= 0 ? '' : path.basename(source).slice(dot).toLowerCase()
  return formatForExtension(extension) !== null ? extension : '.png'
}

function parseWatermarkPosition(value: unknown): WatermarkPosition {
  if (typeof value === 'string' && (WATERMARK_POSITIONS as readonly string[]).includes(value)) {
    return value as WatermarkPosition
  }
  throw stashError('VALIDATION', 'Invalid request: "position" is not a watermark position.', {
    technicalMessage: `position=${JSON.stringify(value)}`
  })
}

/**
 * Expand a validated naming template against one source stem. The pattern was
 * already checked for the {name} token at the IPC boundary.
 */
function applyPatternToName(pattern: string, sourceStem: string): string {
  let stripped = ''
  for (const character of sourceStem) {
    const code = character.charCodeAt(0)
    if ('<>:"/\\|?*'.includes(character) || code <= 31 || code === 127) continue
    stripped += character
  }
  const stem = stripped.trim().slice(0, 120) || 'file'
  return pattern.split('{name}').join(stem)
}

/** Case-insensitive collision handling so batch exports never overwrite each other. */
function uniqueName(name: string, used: Set<string>): string {
  const dot = name.lastIndexOf('.')
  const stem = dot <= 0 ? name : name.slice(0, dot)
  const ext = dot <= 0 ? '' : name.slice(dot)
  let candidate = name
  let counter = 1
  while (used.has(candidate.toLowerCase())) {
    candidate = `${stem}-${counter}${ext}`
    counter += 1
  }
  used.add(candidate.toLowerCase())
  return candidate
}

interface BatchJob {
  source: string
  label: string
  outputName: string
  process(tempOutput: string): Promise<void>
}

interface CompletedJob {
  source: string
  label: string
  output: string
  bytesWritten: number
}

interface FailedJob {
  source: string
  label: string
  error: StashError
}

interface JobBatchOutcome {
  operationId: string
  completed: CompletedJob[]
  failed: FailedJob[]
  cancelled: boolean
}

/**
 * Core batch lifecycle every file-producing tool shares: temp workspace →
 * process → verify → export to the user-approved folder → cleanup, with
 * cooperative cancellation checked between jobs.
 */
async function runJobBatch(
  services: IpcServices,
  outputDir: string,
  opts: { prefix: string; message: string },
  jobs: BatchJob[]
): Promise<JobBatchOutcome> {
  services.writeScope.assertAllowed(outputDir)
  const opDir = services.temp.createOperation(opts.prefix)
  const { id, handle } = services.progress.begin(opts.message)
  const completed: CompletedJob[] = []
  const failed: FailedJob[] = []
  let cancelled = false
  try {
    const usedNames = new Set<string>()
    let index = 0
    for (const job of jobs) {
      if (services.progress.isCancelled(id)) {
        cancelled = true
        break
      }
      handle.report(jobs.length === 0 ? null : index / jobs.length, job.label)
      try {
        const name = uniqueName(job.outputName, usedNames)
        const tempOutput = path.join(opDir, `${index}-${name}`)
        await job.process(tempOutput)
        // Verify the temp output exists before promoting it to the target.
        await fs.stat(tempOutput)
        const target = path.join(outputDir, name)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.copyFile(tempOutput, target)
        const stat = await fs.stat(target)
        completed.push({
          source: job.source,
          label: job.label,
          output: target,
          bytesWritten: stat.size
        })
      } catch (err) {
        failed.push({ source: job.source, label: job.label, error: serializeStashError(err) })
      }
      index += 1
    }
  } finally {
    if (!cancelled) {
      if (completed.length === 0 && failed.length > 0 && failed.length === jobs.length) {
        handle.fail(failed[0]!.error)
      } else {
        handle.done()
      }
    }
    services.temp.cleanup(opDir)
  }
  return { operationId: id, completed, failed, cancelled }
}

function outcomeToImageBatch(outcome: JobBatchOutcome): ImageBatchResult {
  return {
    succeeded: outcome.completed.map((entry) => ({
      source: entry.source,
      output: entry.output,
      bytesWritten: entry.bytesWritten
    })),
    failed: outcome.failed.map((entry) => ({ source: entry.source, error: entry.error })),
    cancelled: outcome.cancelled,
    operationId: outcome.operationId
  }
}

interface ImageBatchPlan {
  prefix: string
  message: string
  outputNameFor(source: string): string
  process(inputPath: string, tempOutput: string): Promise<number>
}

/** One-output-per-input image batch on the shared job lifecycle. */
async function runImageBatch(
  services: IpcServices,
  req: { paths: string[]; outputDir: string },
  plan: ImageBatchPlan
): Promise<ImageBatchResult> {
  const jobs: BatchJob[] = req.paths.map((source) => ({
    source,
    label: path.basename(source),
    outputName: plan.outputNameFor(source),
    process: async (tempOutput) => {
      await plan.process(source, tempOutput)
    }
  }))
  return outcomeToImageBatch(
    await runJobBatch(services, req.outputDir, { prefix: plan.prefix, message: plan.message }, jobs)
  )
}

/**
 * Group label used in output names: single page → "p4", range → "p1-p3".
 */
function splitGroupName(group: number[]): string {
  const first = group[0]!
  const last = group[group.length - 1]!
  return first === last ? `p${first}` : `p${first}-p${last}`
}

/**
 * Full lifecycle for one PDF split: temp workspace → one output per group →
 * export to the user-approved folder → cleanup, with cooperative
 * cancellation checked between groups.
 */
async function runPdfSplit(
  services: IpcServices,
  inputPath: string,
  groups: number[][],
  outputDir: string
): Promise<PdfSplitResult> {
  const opDir = services.temp.createOperation('pdf-split')
  const { id, handle } = services.progress.begin('Splitting PDF…')
  const succeeded: PdfSplitSuccess[] = []
  const failed: PdfSplitFailure[] = []
  let cancelled = false
  try {
    const base = path.basename(inputPath)
    const dot = base.lastIndexOf('.')
    const stem = dot <= 0 ? base : base.slice(0, dot)
    const usedNames = new Set<string>()
    let index = 0
    for (const group of groups) {
      if (services.progress.isCancelled(id)) {
        cancelled = true
        break
      }
      handle.report(
        groups.length === 0 ? null : index / groups.length,
        `${base} · pages ${group[0]}–${group[group.length - 1]}`
      )
      try {
        const name = uniqueName(`${stem}-${splitGroupName(group)}.pdf`, usedNames)
        const tempOutput = path.join(opDir, `${index}-${name}`)
        await splitPdfPages(inputPath, group, tempOutput)
        // Verify the temp output exists before promoting it to the target.
        await fs.stat(tempOutput)
        const target = path.join(outputDir, name)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.copyFile(tempOutput, target)
        const stat = await fs.stat(target)
        succeeded.push({
          label: `${stem}-${splitGroupName(group)}.pdf`,
          output: target,
          bytesWritten: stat.size
        })
      } catch (err) {
        failed.push({
          label: `${stem}-${splitGroupName(group)}.pdf`,
          error: serializeStashError(err)
        })
      }
      index += 1
    }
  } finally {
    if (!cancelled) {
      if (succeeded.length === 0 && failed.length > 0 && failed.length === groups.length) {
        handle.fail(failed[0]!.error)
      } else {
        handle.done()
      }
    }
    services.temp.cleanup(opDir)
  }
  return { succeeded, failed, cancelled }
}

// --- Media (FFmpeg) ---------------------------------------------------------

const VIDEO_EXTENSIONS_BY_FORMAT: Record<VideoOutputFormat, string> = {
  mp4: '.mp4',
  webm: '.webm',
  mkv: '.mkv'
}

function swapExtensionTo(name: string, extension: string): string {
  const dot = name.lastIndexOf('.')
  const stem = dot <= 0 ? name : name.slice(0, dot)
  return stem + extension
}

/** Resolve the FFmpeg toolchain or fail with an actionable message. */
async function requireMediaContext(): Promise<MediaToolsContext> {
  const resolved = await resolveFfmpegBinaries()
  if ('error' in resolved) {
    throw stashError('UNSUPPORTED', resolved.error, { technicalMessage: 'no ffmpeg/ffprobe' })
  }
  return { ffmpegPath: resolved.ffmpegPath, ffprobePath: resolved.ffprobePath }
}

interface MediaOpPlan {
  prefix: string
  message: string
  outputNameFor(sourceName: string): string
  process(
    ctx: MediaToolsContext,
    inputPath: string,
    tempOutput: string,
    hooks: { onProgress(ratio: number | null, message?: string): void; shouldCancel(): boolean }
  ): Promise<MediaOpResult>
}

/**
 * Full lifecycle for one media operation: temp workspace → process with
 * live progress and instant cancellation → verify by re-probing → export to
 * the user-approved folder → cleanup.
 */
async function runMediaOperation(
  services: IpcServices,
  req: { path: string; outputDir: string; fileName?: string },
  plan: MediaOpPlan
): Promise<MediaBatchResult> {
  services.writeScope.assertAllowed(req.outputDir)
  const ctx = await requireMediaContext()
  const opDir = services.temp.createOperation(plan.prefix)
  const { id, handle } = services.progress.begin(plan.message)

  // Instant-cancel wiring: ProgressBus invokes this hook synchronously when
  // the renderer cancels, killing the spawned ffmpeg without waiting for the
  // next poll tick.
  let cancelRequested = false
  services.progress.onCancel(id, () => {
    cancelRequested = true
  })

  const succeeded: MediaBatchSuccess[] = []
  const failed: MediaBatchFailure[] = []
  let cancelled = false
  try {
    if (services.progress.isCancelled(id)) {
      cancelled = true
    } else {
      const sourceName = path.basename(req.path)
      handle.report(null, sourceName)
      const fallbackName = uniqueName(plan.outputNameFor(sourceName), new Set())
      // A user-chosen name replaces the source-derived one; the extension was
      // already force-matched to the chosen format/codec at the IPC boundary.
      const name = req.fileName === undefined ? fallbackName : uniqueName(req.fileName, new Set())
      const tempOutput = path.join(opDir, name)
      try {
        const result = await plan.process(ctx, req.path, tempOutput, {
          onProgress: (ratio, message) => handle.report(ratio, message ?? sourceName),
          shouldCancel: () => cancelRequested || services.progress.isCancelled(id)
        })
        // Verify the temp output exists before promoting it to the target.
        await fs.stat(tempOutput)
        const target = path.join(req.outputDir, name)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.copyFile(tempOutput, target)
        const stat = await fs.stat(target)
        succeeded.push({
          source: req.path,
          output: target,
          bytesWritten: stat.size,
          verified: result.verified
        })
      } catch (err) {
        failed.push({ source: req.path, error: serializeStashError(err) })
      }
    }
  } finally {
    if (!cancelled) {
      if (succeeded.length === 0 && failed.length > 0) {
        handle.fail(failed[0]!.error)
      } else {
        handle.done()
      }
    }
    services.temp.cleanup(opDir)
  }
  return { succeeded, failed, cancelled }
}

function parseVideoFormat(value: unknown): VideoOutputFormat {
  if (typeof value === 'string' && value in VIDEO_EXTENSIONS_BY_FORMAT) {
    return value as VideoOutputFormat
  }
  throw stashError('VALIDATION', 'Invalid request: "format" is not a supported video format.', {
    technicalMessage: `format=${JSON.stringify(value)}`
  })
}

function parseAudioCodec(value: unknown): AudioCodec {
  if (typeof value === 'string' && value in AUDIO_EXTENSION_BY_CODEC) {
    return value as AudioCodec
  }
  throw stashError('VALIDATION', 'Invalid request: "codec" is not a supported audio codec.', {
    technicalMessage: `codec=${JSON.stringify(value)}`
  })
}

// --- Crypto (hashing) ---------------------------------------------------------

const HASH_ALGORITHMS: readonly HashAlgorithm[] = ['md5', 'sha1', 'sha256', 'sha512']

function parseHashAlgorithm(value: unknown): HashAlgorithm {
  if (typeof value === 'string' && HASH_ALGORITHMS.includes(value as HashAlgorithm)) {
    return value as HashAlgorithm
  }
  throw stashError(
    'VALIDATION',
    'Invalid request: "algorithm" is not a supported hash algorithm.',
    { technicalMessage: `algorithm=${JSON.stringify(value)}` }
  )
}

/**
 * Register a channel whose thrown values are always normalized into a
 * serialized StashError before crossing the process boundary.
 */ function handle(channel: string, listener: (...args: never[]) => unknown): void {
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

  handle(IPC.appSetZoom, (event: Electron.IpcMainInvokeEvent, raw: unknown) => {
    const factor = clampZoomFactor(assertNumber(raw, 'factor'))
    event.sender.setZoomFactor(factor)
    if (process.platform === 'win32') {
      try {
        BrowserWindow.fromWebContents(event.sender)?.setTitleBarOverlay({
          height: overlayHeightFor(factor),
          color: '#12141a',
          symbolColor: '#9aa2b1'
        })
      } catch {
        // Overlay metrics only apply while native window controls are shown.
      }
    }
  })

  handle(IPC.shellRevealPath, (_e, raw: unknown) => {
    const target = assertString(raw, 'path')
    // Resolve first so relative renderer paths cannot misdirect the reveal.
    shell.showItemInFolder(path.resolve(target))
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

  handle(IPC.dialogChooseDirectory, async (_e, raw: unknown) => {
    const req = (raw ?? {}) as Record<string, unknown>
    const options: Electron.OpenDialogOptions = {
      title: assertOptionalString(req['title'], 'title'),
      properties: ['openDirectory', 'createDirectory']
    }
    const win = optionalWindow()
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return { cancelled: true }
    const chosen = result.filePaths[0]!
    // Approving a directory whitelists every export beneath it (WriteScopeGuard).
    services.writeScope.approve(chosen)
    return { cancelled: false, path: chosen }
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

  handle(IPC.fsListDir, async (_e, raw: unknown) => {
    const target = assertString(raw, 'path')
    try {
      const dirents = await fs.readdir(target, { withFileTypes: true })
      const entries: DirEntry[] = dirents.map((d) => ({
        name: d.name,
        isDirectory: d.isDirectory()
      }))
      // Directories first, then a case-insensitive alphabetical pass.
      entries.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
      return { entries }
    } catch (err) {
      throw stashError('FS_READ', `Could not read the folder "${path.basename(target)}".`, {
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

  handle(IPC.fsReadFileBytes, async (_e, raw: unknown) => {
    if (typeof raw !== 'object' || raw === null) {
      throw stashError('VALIDATION', 'Invalid request payload.')
    }
    const req = raw as Record<string, unknown>
    const target = assertString(req['path'], 'path')
    const requestedMax =
      req['maxBytes'] === undefined
        ? BINARY_FILE_LIMIT_BYTES
        : assertNumber(req['maxBytes'], 'maxBytes')
    if (requestedMax < 0) {
      throw stashError('VALIDATION', 'Invalid request: "maxBytes" cannot be negative.')
    }
    const maxBytes = Math.min(requestedMax, BINARY_FILE_LIMIT_BYTES)

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
      // Reject oversized files upfront rather than silently truncating previews.
      if (stat.size > BINARY_FILE_LIMIT_BYTES) {
        throw stashError(
          'VALIDATION',
          `"${path.basename(target)}" is too large to load (limit is 64 MB).`,
          { technicalMessage: `sizeBytes=${stat.size}` }
        )
      }
      const length = Math.min(stat.size, maxBytes + 1)
      const buffer = Buffer.alloc(length)
      const { bytesRead } = await handle.read(buffer, 0, length, 0)
      const truncated = bytesRead > maxBytes
      // Slice into a standalone ArrayBuffer so the whole parent allocation
      // never crosses the process boundary.
      const kept = Math.min(bytesRead, maxBytes)
      return {
        bytes: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + kept),
        truncated,
        sizeBytes: stat.size
      }
    } finally {
      await handle.close()
    }
  })

  handle(IPC.fsWriteFileBytes, async (_e, raw: unknown) => {
    if (typeof raw !== 'object' || raw === null) {
      throw stashError('VALIDATION', 'Invalid request payload.')
    }
    const req = raw as Record<string, unknown>
    const target = assertString(req['path'], 'path')
    const rawBytes = req['bytes']
    const isBinary = rawBytes instanceof ArrayBuffer || ArrayBuffer.isView(rawBytes)
    if (!isBinary) {
      throw stashError('VALIDATION', 'Cannot save: the content must be binary data.')
    }
    const view = ArrayBuffer.isView(rawBytes)
      ? new Uint8Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength)
      : new Uint8Array(rawBytes as ArrayBuffer)
    if (view.byteLength > BINARY_FILE_LIMIT_BYTES) {
      throw stashError('VALIDATION', 'That file is too large to save (limit is 64 MB).', {
        technicalMessage: `sizeBytes=${view.byteLength}`
      })
    }
    // Writes are restricted to user-approved (dialog) or temp-workspace paths.
    services.writeScope.assertAllowed(target)
    try {
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, Buffer.from(view))
      return { bytesWritten: view.byteLength }
    } catch (err) {
      throw stashError('FS_WRITE', `Could not save to "${path.basename(target)}".`, {
        technicalMessage: String(err)
      })
    }
  })

  handle(IPC.fsExportFile, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const sourcePath = assertString(req['sourcePath'], 'sourcePath')
    const targetPath = assertString(req['targetPath'], 'targetPath')
    // Exports may only promote files produced inside a Stash operation.
    assertInsideTempRoot(services.temp, sourcePath)
    services.writeScope.assertAllowed(targetPath)
    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await fs.copyFile(sourcePath, targetPath)
      const stat = await fs.stat(targetPath)
      return { bytesWritten: stat.size }
    } catch (err) {
      throw stashError('FS_WRITE', `Could not export to "${path.basename(targetPath)}".`, {
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

  // --- Image processing batches ---------------------------------------------
  handle(IPC.imagesConvertBatch, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const paths = assertPathsArray(req['paths'])
    const outputDir = assertString(req['outputDir'], 'outputDir')
    const format = parseImageFormat(req['format'])
    const quality =
      req['quality'] === undefined ? undefined : assertNumber(req['quality'], 'quality')
    const namePattern = parseOptionalNamePattern(req['namePattern'])
    return runImageBatch(
      services,
      { paths, outputDir },
      {
        prefix: 'image-convert',
        message: 'Converting images…',
        outputNameFor: (source) => {
          const base = path.basename(source)
          const named =
            namePattern === undefined ? base : applyPatternToName(namePattern, stemOf(base))
          return swapExtension(named, format)
        },
        process: (input, tempOutput) =>
          convertImage(input, tempOutput, { format, quality }).then((r) => r.bytesWritten)
      }
    )
  })

  handle(IPC.imagesCompressBatch, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const paths = assertPathsArray(req['paths'])
    const outputDir = assertString(req['outputDir'], 'outputDir')
    const quality = assertNumber(req['quality'], 'quality')
    const maxDimension =
      req['maxDimension'] === undefined
        ? undefined
        : assertNumber(req['maxDimension'], 'maxDimension')
    if (maxDimension !== undefined && (maxDimension < 1 || !Number.isInteger(maxDimension))) {
      throw stashError('VALIDATION', 'Invalid request: "maxDimension" must be a positive integer.')
    }
    const namePattern = parseOptionalNamePattern(req['namePattern'])
    return runImageBatch(
      services,
      { paths, outputDir },
      {
        prefix: 'image-compress',
        message: 'Compressing images…',
        outputNameFor: (source) => {
          const base = path.basename(source)
          const dot = base.lastIndexOf('.')
          const ext = formatForExtension(dot <= 0 ? '' : base.slice(dot)) ?? ''
          const stem = stemOf(base)
          const named = namePattern === undefined ? stem : applyPatternToName(namePattern, stem)
          return `${named}${ext}`
        },
        process: (input, tempOutput) =>
          compressImage(input, tempOutput, { quality, maxDimension }).then((r) => r.bytesWritten)
      }
    )
  })

  handle(IPC.imagesWatermarkBatch, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const paths = assertPathsArray(req['paths'])
    const outputDir = assertString(req['outputDir'], 'outputDir')
    const text = normalizeWatermarkText(assertString(req['text'], 'text', { allowEmpty: true }))
    if (text.length === 0) {
      throw stashError('VALIDATION', 'Invalid request: the watermark text is empty.')
    }
    const position = parseWatermarkPosition(req['position'])
    const fontSize =
      req['fontSize'] === undefined
        ? undefined
        : clampWatermarkFontSize(assertNumber(req['fontSize'], 'fontSize'))
    const color = req['color'] === undefined ? undefined : assertString(req['color'], 'color')
    if (color !== undefined && !isValidWatermarkColor(color)) {
      throw stashError(
        'VALIDATION',
        'Invalid request: "color" must be a #rgb or #rrggbb hex color.',
        {
          technicalMessage: `color=${JSON.stringify(color)}`
        }
      )
    }
    const opacity =
      req['opacity'] === undefined ? undefined : assertNumber(req['opacity'], 'opacity')
    if (opacity !== undefined && (opacity < 0.05 || opacity > 1)) {
      throw stashError('VALIDATION', 'Invalid request: "opacity" must be between 0.05 and 1.')
    }
    const marginRatio =
      req['marginRatio'] === undefined ? undefined : assertNumber(req['marginRatio'], 'marginRatio')
    if (marginRatio !== undefined && (marginRatio < 0.02 || marginRatio > 0.15)) {
      throw stashError(
        'VALIDATION',
        'Invalid request: "marginRatio" must be between 0.02 and 0.15.'
      )
    }
    return runImageBatch(
      services,
      { paths, outputDir },
      {
        prefix: 'image-watermark',
        message: 'Watermarking images…',
        outputNameFor: (source) =>
          `${stemOf(path.basename(source))}-watermarked${outputExtensionFor(source)}`,
        process: (input, tempOutput) =>
          watermarkImage(input, tempOutput, {
            text,
            position,
            ...(fontSize !== undefined ? { fontSize } : {}),
            ...(color !== undefined ? { color } : {}),
            ...(opacity !== undefined ? { opacity } : {}),
            ...(marginRatio !== undefined ? { marginRatio } : {})
          }).then((r) => r.bytesWritten)
      }
    )
  })

  handle(IPC.socialResizeBatch, async (_e, raw: unknown): Promise<SocialResizeResult> => {
    const req = assertPayload(raw)
    const paths = assertPathsArray(req['paths'])
    const outputDir = assertString(req['outputDir'], 'outputDir')
    const presetIds = req['presets']
    if (!Array.isArray(presetIds) || presetIds.length === 0) {
      throw stashError('VALIDATION', 'Invalid request: select at least one social preset.')
    }
    const presets = presetIds.map((id) => {
      const preset = socialPresetById(String(id))
      if (!preset) {
        throw stashError('VALIDATION', 'Invalid request: unknown social preset.', {
          technicalMessage: `preset=${JSON.stringify(id)}`
        })
      }
      return preset
    })
    // Flatten file × preset so every unit reports its own progress label.
    const jobs: BatchJob[] = []
    for (const source of paths) {
      const base = path.basename(source)
      const extension = outputExtensionFor(source)
      for (const preset of presets) {
        jobs.push({
          source,
          label: `${base} · ${preset.label}`,
          outputName: `${stemOf(base)}-${preset.id}${extension}`,
          process: async (tempOutput) => {
            await socialResizeImage(source, tempOutput, preset)
          }
        })
      }
    }
    const outcome = await runJobBatch(
      services,
      outputDir,
      { prefix: 'social-resize', message: 'Resizing to social presets…' },
      jobs
    )
    return {
      succeeded: outcome.completed.map((entry) => ({
        source: entry.source,
        label: entry.label,
        output: entry.output,
        bytesWritten: entry.bytesWritten
      })),
      failed: outcome.failed.map((entry) => ({ label: entry.label, error: entry.error })),
      cancelled: outcome.cancelled
    }
  })

  handle(IPC.imagesOcr, async (_e, raw: unknown, jobId?: unknown): Promise<OcrImageResult> => {
    const req = assertPayload(raw)
    const imagePath = assertString(req['path'], 'path')
    const language = typeof req['language'] === 'string' ? req['language'] : undefined
    const psm = typeof req['psm'] === 'string' ? (req['psm'] as OcrPsmMode) : undefined
    const preprocess =
      req['preprocess'] && typeof req['preprocess'] === 'object'
        ? (req['preprocess'] as OcrImageRequest['preprocess'])
        : undefined

    const operationId = typeof jobId === 'string' ? jobId : undefined
    const { id, handle: opHandle } = services.progress.begin('Extracting text with OCR…')
    const trackingId = operationId ?? id

    try {
      const result = await ocrImage(
        { path: imagePath, language, psm, preprocess },
        (ratio, message) => {
          opHandle.report(ratio, message)
        },
        () => services.progress.isCancelled(trackingId)
      )
      opHandle.done('Text extraction complete')
      return result
    } catch (err) {
      opHandle.fail(err)
      throw err
    }
  })

  handle(IPC.iconsGeneratePack, async (_e, raw: unknown): Promise<IconPackResult> => {
    const req = assertPayload(raw)
    const inputPath = assertString(req['path'], 'path')
    const outputDir = assertString(req['outputDir'], 'outputDir')

    const squareMaster = await loadSquareLogo(inputPath)
    // Fixed artifact names — the 256px PNG is additionally wrapped as favicon.ico.
    const jobs: BatchJob[] = ICON_PACK_SIZES.map((size) => ({
      source: inputPath,
      label: iconFileName(size),
      outputName: iconFileName(size),
      process: async (tempOutput) => {
        await writeIconPng(squareMaster, size, tempOutput)
      }
    }))
    jobs.push({
      source: inputPath,
      label: FAVICON_NAME,
      outputName: FAVICON_NAME,
      process: async (tempOutput) => {
        await writeFaviconIco(squareMaster, tempOutput)
      }
    })

    const outcome = await runJobBatch(
      services,
      outputDir,
      { prefix: 'icon-pack', message: 'Generating icon pack…' },
      jobs
    )
    return {
      succeeded: outcome.completed.map((entry) => ({
        name: entry.label,
        path: entry.output,
        bytesWritten: entry.bytesWritten
      })),
      failed: outcome.failed.map((entry) => ({ name: entry.label, error: entry.error })),
      cancelled: outcome.cancelled
    }
  })

  // --- ZIP archives -----------------------------------------------------------
  handle(IPC.zipCreateBatch, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const paths = assertPathsArray(req['paths'])
    const targetZip = assertString(req['targetZip'], 'targetZip')
    services.writeScope.assertAllowed(targetZip)
    return createZipArchive(paths, targetZip)
  })

  handle(IPC.zipExtractBatch, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const zipPath = assertString(req['zipPath'], 'zipPath')
    const outputDir = assertString(req['outputDir'], 'outputDir')
    services.writeScope.assertAllowed(outputDir)
    return extractZipArchive(zipPath, outputDir)
  })

  handle(IPC.archivesInspect, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const targetPath = assertString(req['path'], 'path')
    const password = assertOptionalString(req['password'], 'password')
    return inspectArchive({
      path: targetPath,
      ...(password ? { password } : {})
    })
  })

  handle(IPC.archivesReadEntry, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const archivePath = assertString(req['archivePath'], 'archivePath')
    const entryPath = assertString(req['entryPath'], 'entryPath')
    const password = assertOptionalString(req['password'], 'password')
    const maxBytes =
      req['maxBytes'] === undefined ? undefined : assertNumber(req['maxBytes'], 'maxBytes')
    return readArchiveEntry({
      archivePath,
      entryPath,
      ...(password ? { password } : {}),
      ...(maxBytes !== undefined ? { maxBytes } : {})
    })
  })

  handle(IPC.archivesExtractEntry, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const archivePath = assertString(req['archivePath'], 'archivePath')
    const entryPath = assertString(req['entryPath'], 'entryPath')
    const targetPath = assertString(req['targetPath'], 'targetPath')
    const password = assertOptionalString(req['password'], 'password')
    services.writeScope.assertAllowed(targetPath)
    return extractArchiveEntry({
      archivePath,
      entryPath,
      targetPath,
      ...(password ? { password } : {})
    })
  })

  handle(IPC.filesBatchRename, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const dir = path.resolve(assertString(req['dir'], 'dir'))
    // Renames touch arbitrary user folders — the folder itself must be a
    // user-approved write target before anything else is considered.
    if (!services.writeScope.isAllowed(dir)) {
      throw stashError(
        'VALIDATION',
        'That folder has not been approved for changes. Pick it again with the folder picker.',
        { technicalMessage: `unapproved rename dir: ${dir}` }
      )
    }
    if (!Array.isArray(req['renames']) || req['renames'].length === 0) {
      throw stashError('VALIDATION', 'Invalid request: "renames" must be a non-empty array.')
    }
    if (req['renames'].length > MAX_RENAMES_PER_BATCH) {
      throw stashError(
        'VALIDATION',
        `Too many renames in one pass (limit is ${MAX_RENAMES_PER_BATCH}).`,
        { technicalMessage: `count=${req['renames'].length}` }
      )
    }
    for (const item of req['renames']) {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as BatchRenameItem).from !== 'string' ||
        typeof (item as BatchRenameItem).to !== 'string'
      ) {
        throw stashError('VALIDATION', 'Invalid request: each rename needs "from" and "to".')
      }
    }

    /** Every old AND new name must live inside the approved directory. */
    function resolveInside(name: string): string {
      const resolved = path.resolve(dir, name)
      const contained = resolved === dir || resolved.startsWith(dir + path.sep)
      if (!contained || !services.writeScope.isAllowed(resolved)) {
        throw stashError('VALIDATION', 'A rename target falls outside the chosen folder.', {
          technicalMessage: `outside rename dir: ${resolved}`
        })
      }
      return resolved
    }

    const renamed: Array<{ from: string; to: string }> = []
    const skipped: Array<{ from: string; reason: string }> = []
    for (const item of req['renames'] as BatchRenameItem[]) {
      try {
        const fromPath = resolveInside(item.from)
        const toPath = resolveInside(item.to)
        if (fromPath === toPath) {
          skipped.push({ from: item.from, reason: 'name unchanged' })
          continue
        }
        let exists = true
        try {
          await fs.stat(fromPath)
        } catch {
          exists = false
        }
        if (!exists) {
          skipped.push({ from: item.from, reason: 'source not found' })
          continue
        }
        let targetTaken = false
        try {
          await fs.stat(toPath)
          targetTaken = true
        } catch {
          targetTaken = false
        }
        if (targetTaken) {
          skipped.push({ from: item.from, reason: 'target exists' })
          continue
        }
        await fs.rename(fromPath, toPath)
        renamed.push({ from: fromPath, to: toPath })
      } catch (err) {
        skipped.push({ from: item.from, reason: skipReason(err) })
      }
    }
    return { renamed, skipped }
  })

  // --- PDF processing --------------------------------------------------------
  handle(IPC.pdfMergeBatch, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const paths = assertPathsArray(req['paths'])
    const targetPdf = assertString(req['targetPdf'], 'targetPdf')
    services.writeScope.assertAllowed(targetPdf)
    let totalBytes = 0
    for (const filePath of paths) {
      if (!filePath.toLowerCase().endsWith('.pdf')) {
        throw stashError('VALIDATION', `"${path.basename(filePath)}" isn't a PDF file.`)
      }
      let stat
      try {
        stat = await fs.stat(filePath)
      } catch (err) {
        throw stashError('FS_READ', `"${path.basename(filePath)}" could not be found or opened.`, {
          technicalMessage: String(err)
        })
      }
      totalBytes += stat.size
      if (totalBytes > PDF_INPUT_LIMIT_BYTES) {
        throw stashError(
          'VALIDATION',
          'The selected documents are too large to merge in one pass (limit is 512 MB total).',
          { technicalMessage: `totalBytes=${totalBytes}` }
        )
      }
    }
    return mergePdfs(paths, targetPdf)
  })

  handle(IPC.pdfGetInfo, (_e, target: unknown) => getPdfInfo(assertString(target, 'path')))

  handle(IPC.pdfSplitBatch, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const inputPath = assertString(req['path'], 'path')
    const pageSpec = assertString(req['pageSpec'], 'pageSpec')
    const outputDir = assertString(req['outputDir'], 'outputDir')
    services.writeScope.assertAllowed(outputDir)
    // The renderer pre-validates for UX; the main process re-validates
    // authoritatively against the real document.
    const info = await getPdfInfo(inputPath)
    const parsed = parsePageRanges(pageSpec, info.pageCount)
    if ('error' in parsed) {
      throw stashError('VALIDATION', parsed.error)
    }
    return runPdfSplit(services, inputPath, parsed.groups, outputDir)
  })

  /** Shared validation for single-PDF → single-output operations. */
  async function loadValidatedSinglePdf(
    req: Record<string, unknown>
  ): Promise<{ path: string; targetPdf: string; pageCount: number }> {
    const inputPath = assertString(req['path'], 'path')
    const targetPdf = assertString(req['targetPdf'], 'targetPdf')
    services.writeScope.assertAllowed(targetPdf)
    if (!inputPath.toLowerCase().endsWith('.pdf')) {
      throw stashError('VALIDATION', `"${path.basename(inputPath)}" isn't a PDF file.`)
    }
    let stat
    try {
      stat = await fs.stat(inputPath)
    } catch (err) {
      throw stashError('FS_READ', `"${path.basename(inputPath)}" could not be found or opened.`, {
        technicalMessage: String(err)
      })
    }
    if (stat.size > PDF_INPUT_LIMIT_BYTES) {
      throw stashError(
        'VALIDATION',
        'That document is too large to process in one pass (limit is 512 MB).',
        { technicalMessage: `sizeBytes=${stat.size}` }
      )
    }
    const info = await getPdfInfo(inputPath)
    return { path: inputPath, targetPdf, pageCount: info.pageCount }
  }

  /** 'all' means every page; anything else is parsed as an ordered sequence. */
  function resolveSequence(pageSpec: string, pageCount: number): number[] {
    if (pageSpec.trim().toLowerCase() === 'all') {
      return Array.from({ length: pageCount }, (_, index) => index)
    }
    const parsed = parsePageSequence(pageSpec, pageCount)
    if ('error' in parsed) {
      throw stashError('VALIDATION', parsed.error)
    }
    return parsed.pages.map((page) => page - 1)
  }

  handle(IPC.pdfRotateBatch, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const { path: inputPath, targetPdf, pageCount } = await loadValidatedSinglePdf(req)
    const pageSpec = assertString(req['pageSpec'], 'pageSpec')
    const angle = assertNumber(req['angle'], 'angle')
    if (angle !== 90 && angle !== 180 && angle !== 270) {
      throw stashError('VALIDATION', 'Invalid request: "angle" must be 90, 180 or 270.')
    }
    const indices = resolveSequence(pageSpec, pageCount)
    return rotatePdf(inputPath, indices, angle, targetPdf)
  })

  handle(IPC.pdfCompressBatch, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const { path: inputPath, targetPdf } = await loadValidatedSinglePdf(req)
    return compressPdf(inputPath, targetPdf)
  })

  handle(IPC.pdfReorderBatch, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const { path: inputPath, targetPdf, pageCount } = await loadValidatedSinglePdf(req)
    const pageSpec = assertString(req['pageSpec'], 'pageSpec')
    const parsed = parsePageSequence(pageSpec, pageCount)
    if ('error' in parsed) {
      throw stashError('VALIDATION', parsed.error)
    }
    return reorderPdf(inputPath, parsed.pages, targetPdf)
  })

  handle(IPC.pdfImagesToPdfBatch, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const paths = assertPathsArray(req['paths'])
    const targetPdf = assertString(req['targetPdf'], 'targetPdf')
    services.writeScope.assertAllowed(targetPdf)
    for (const imagePath of paths) {
      if (
        !(IMAGES_TO_PDF_EXTENSIONS as readonly string[]).includes(
          path.extname(imagePath).toLowerCase()
        )
      ) {
        throw stashError('VALIDATION', `"${path.basename(imagePath)}" isn't a JPG or PNG image.`)
      }
    }
    return imagesToPdf(paths, targetPdf)
  })

  // --- Media (FFmpeg) --------------------------------------------------------
  handle(IPC.mediaGetCapabilities, async (): Promise<MediaCapabilities> => {
    const resolved = await resolveFfmpegBinaries()
    if ('error' in resolved) return { available: false }
    try {
      const [ffmpegVersion, ffprobeVersion] = await Promise.all([
        getVersion(resolved.ffmpegPath).catch(() => undefined),
        getVersion(resolved.ffprobePath).catch(() => undefined)
      ])
      return {
        available: true,
        source: resolved.source,
        ...(ffmpegVersion ? { ffmpegVersion } : {}),
        ...(ffprobeVersion ? { ffprobeVersion } : {})
      }
    } catch {
      return { available: false }
    }
  })

  handle(IPC.mediaProbe, async (_e, raw: unknown) => {
    const target = assertString(raw, 'path')
    // Reads stay broad by design; no write-scope approval needed here.
    const ctx = await requireMediaContext()
    const info = await probeMedia(ctx.ffprobePath, target)
    let sizeBytes = info.sizeBytes ?? 0
    try {
      sizeBytes = (await fs.stat(target)).size
    } catch {
      // Fall back to container-reported size.
    }
    return { info, sizeBytes }
  })

  handle(IPC.mediaConvertVideo, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const inputPath = assertString(req['path'], 'path')
    const outputDir = assertString(req['outputDir'], 'outputDir')
    const format = parseVideoFormat(req['format'])
    const crfQuality =
      req['crfQuality'] === undefined ? undefined : assertNumber(req['crfQuality'], 'crfQuality')
    const fileName = parseOptionalFileName(req['fileName'], VIDEO_EXTENSIONS_BY_FORMAT[format])
    return runMediaOperation(
      services,
      { path: inputPath, outputDir, ...(fileName !== undefined ? { fileName } : {}) },
      {
        prefix: 'media-convert-video',
        message: 'Converting video…',
        outputNameFor: (source) => swapExtensionTo(source, VIDEO_EXTENSIONS_BY_FORMAT[format]),
        process: (ctx, input, tempOutput, hooks) =>
          convertVideo(ctx, input, tempOutput, { format, crfQuality, ...hooks })
      }
    )
  })

  handle(IPC.mediaCompressVideo, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const inputPath = assertString(req['path'], 'path')
    const outputDir = assertString(req['outputDir'], 'outputDir')
    const crfQuality = assertNumber(req['crfQuality'], 'crfQuality')
    const maxDimension =
      req['maxDimension'] === undefined
        ? undefined
        : assertNumber(req['maxDimension'], 'maxDimension')
    const fileName = parseOptionalFileName(req['fileName'], '.mp4')
    return runMediaOperation(
      services,
      { path: inputPath, outputDir, ...(fileName !== undefined ? { fileName } : {}) },
      {
        prefix: 'media-compress-video',
        message: 'Compressing video…',
        outputNameFor: (source) => swapExtensionTo(source, '.mp4'),
        process: (ctx, input, tempOutput, hooks) =>
          compressVideo(ctx, input, tempOutput, {
            crfQuality,
            ...(maxDimension !== undefined && maxDimension > 0 ? { maxDimension } : {}),
            ...hooks
          })
      }
    )
  })

  handle(IPC.mediaVideoToGif, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const inputPath = assertString(req['path'], 'path')
    const outputDir = assertString(req['outputDir'], 'outputDir')
    const fps = assertNumber(req['fps'], 'fps')
    const maxWidth = assertNumber(req['maxWidth'], 'maxWidth')
    const fileName = parseOptionalFileName(req['fileName'], '.gif')
    return runMediaOperation(
      services,
      { path: inputPath, outputDir, ...(fileName !== undefined ? { fileName } : {}) },
      {
        prefix: 'media-video-to-gif',
        message: 'Building GIF…',
        outputNameFor: (source) => swapExtensionTo(source, '.gif'),
        process: (ctx, input, tempOutput, hooks) =>
          videoToGif(ctx, input, tempOutput, {
            fps,
            maxWidth,
            palettePath: path.join(
              path.dirname(tempOutput),
              `palette-${path.basename(tempOutput)}.png`
            ),
            ...hooks
          })
      }
    )
  })

  handle(IPC.mediaExtractAudio, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const inputPath = assertString(req['path'], 'path')
    const outputDir = assertString(req['outputDir'], 'outputDir')
    const codec = parseAudioCodec(req['codec'])
    const bitrateKbps =
      req['bitrateKbps'] === undefined ? undefined : assertNumber(req['bitrateKbps'], 'bitrateKbps')
    const request: ExtractAudioRequest = {
      path: inputPath,
      outputDir,
      codec,
      ...(bitrateKbps !== undefined ? { bitrateKbps } : {})
    }
    const fileName = parseOptionalFileName(req['fileName'], AUDIO_EXTENSION_BY_CODEC[codec])
    return runMediaOperation(
      services,
      { path: inputPath, outputDir, ...(fileName !== undefined ? { fileName } : {}) },
      {
        prefix: 'media-extract-audio',
        message: 'Extracting audio…',
        outputNameFor: (source) => swapExtensionTo(source, AUDIO_EXTENSION_BY_CODEC[codec]),
        process: (ctx, input, tempOutput, hooks) =>
          extractAudio(ctx, input, tempOutput, { ...request, ...hooks })
      }
    )
  })

  handle(IPC.mediaConvertAudio, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const inputPath = assertString(req['path'], 'path')
    const outputDir = assertString(req['outputDir'], 'outputDir')
    const codec = parseAudioCodec(req['codec'])
    const bitrateKbps =
      req['bitrateKbps'] === undefined ? undefined : assertNumber(req['bitrateKbps'], 'bitrateKbps')
    const request: ConvertAudioRequest = {
      path: inputPath,
      outputDir,
      codec,
      ...(bitrateKbps !== undefined ? { bitrateKbps } : {})
    }
    const fileName = parseOptionalFileName(req['fileName'], AUDIO_EXTENSION_BY_CODEC[codec])
    return runMediaOperation(
      services,
      { path: inputPath, outputDir, ...(fileName !== undefined ? { fileName } : {}) },
      {
        prefix: 'media-convert-audio',
        message: 'Converting audio…',
        outputNameFor: (source) => swapExtensionTo(source, AUDIO_EXTENSION_BY_CODEC[codec]),
        process: (ctx, input, tempOutput, hooks) =>
          convertAudio(ctx, input, tempOutput, { ...request, ...hooks })
      }
    )
  })

  // --- Crypto (hashing) --------------------------------------------------------
  handle(IPC.cryptoHashText, async (_e, raw: unknown) => {
    const req = assertPayload(raw)
    const algorithm = parseHashAlgorithm(req['algorithm'])
    const text = req['text']
    if (typeof text !== 'string') {
      throw stashError('VALIDATION', 'Invalid request: "text" must be a string.')
    }
    if (Buffer.byteLength(text, 'utf-8') > TEXT_FILE_LIMIT_BYTES) {
      throw stashError('VALIDATION', 'That text is too large to hash in one pass.')
    }
    const hex = crypto.createHash(algorithm).update(text, 'utf-8').digest('hex')
    return { hex }
  })

  handle(IPC.cryptoHashFile, async (_e, raw: unknown): Promise<HashFileResult> => {
    const req = assertPayload(raw)
    const target = assertString(req['path'], 'path')
    const algorithm = parseHashAlgorithm(req['algorithm'])
    let stat: Awaited<ReturnType<typeof fs.stat>>
    try {
      stat = await fs.stat(target)
    } catch (err) {
      throw stashError('FS_READ', `"${path.basename(target)}" could not be found or opened.`, {
        technicalMessage: String(err)
      })
    }
    return new Promise<HashFileResult>((resolve, reject) => {
      const hash = crypto.createHash(algorithm)
      const stream = createReadStream(target)
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve({ hex: hash.digest('hex'), sizeBytes: stat.size }))
      stream.on('error', (err) =>
        reject(
          stashError('FS_READ', `Could not read "${path.basename(target)}".`, {
            technicalMessage: String(err)
          })
        )
      )
    })
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

  // --- Prompt library ---------------------------------------------------------
  handle(IPC.promptsList, () => services.prompts.list())
  handle(IPC.promptsSave, (_e, input: unknown) => {
    if (typeof input !== 'object' || input === null) {
      throw stashError('VALIDATION', 'Invalid prompt payload.')
    }
    const req = input as Record<string, unknown>
    return services.prompts.save({
      id: req['id'] === undefined ? undefined : assertNumber(req['id'], 'id'),
      title: typeof req['title'] === 'string' ? req['title'] : '',
      body: typeof req['body'] === 'string' ? req['body'] : '',
      tags: Array.isArray(req['tags'])
        ? (req['tags'] as unknown[]).filter((t): t is string => typeof t === 'string')
        : []
    })
  })
  handle(IPC.promptsDelete, (_e, id: unknown) => services.prompts.delete(assertNumber(id, 'id')))

  // --- Progress / cancellation ----------------------------------------------
  handle(IPC.progressCancel, (_e, operationId: unknown) =>
    services.progress.cancel(assertString(operationId, 'operationId'))
  )
}
