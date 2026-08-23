import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { IPC } from '../../shared/ipc'
import type {
  AudioCodec,
  ConvertAudioRequest,
  ExtractAudioRequest,
  FileMetadata,
  HashAlgorithm,
  HashFileResult,
  HistoryEntryInput,
  ImageBatchFailure,
  ImageBatchResult,
  ImageBatchSuccess,
  ImageOutputFormat,
  MediaBatchFailure,
  MediaBatchResult,
  MediaBatchSuccess,
  MediaCapabilities,
  VideoOutputFormat,
  PdfSplitFailure,
  PdfSplitResult,
  PdfSplitSuccess
} from '../../shared/ipc'
import { serializeStashError, stashError } from '../../shared/errors'
import { FavoritesStore, HistoryStore, PrefsStore, RecentsStore } from '../services/stores'
import { TempWorkspaceManager } from '../services/temp-workspace'
import { getVersion, resolveFfmpegBinaries } from '../services/ffmpeg'
import { ProgressBus } from './progress'
import { WriteScopeGuard } from './write-scope'
import { assertNumber, assertOptionalString, assertString, parseFilters } from './validate'
import { createZipArchive, extractZipArchive } from '../processing/archives'
import {
  SUPPORTED_FORMATS,
  compressImage,
  convertImage,
  formatForExtension
} from '../processing/images'
import { PDF_INPUT_LIMIT_BYTES, getPdfInfo, mergePdfs, splitPdfPages } from '../processing/pdf'
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
import { parsePageRanges } from '../../shared/utils/page-ranges'

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
/** Hard cap for raw binary reads/writes — larger files are rejected upfront. */
const BINARY_FILE_LIMIT_BYTES = 64 * 1024 * 1024
/** Serialized preference values larger than this are rejected. */
const PREF_VALUE_LIMIT_BYTES = 64 * 1024

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

interface ImageBatchPlan {
  prefix: string
  message: string
  outputNameFor(source: string): string
  process(inputPath: string, tempOutput: string): Promise<number>
}

/**
 * Full lifecycle for one image batch: temp workspace → process → verify →
 * export to the user-approved folder → cleanup, with cooperative cancellation.
 */
async function runImageBatch(
  services: IpcServices,
  req: { paths: string[]; outputDir: string },
  plan: ImageBatchPlan
): Promise<ImageBatchResult> {
  services.writeScope.assertAllowed(req.outputDir)
  const opDir = services.temp.createOperation(plan.prefix)
  const { id, handle } = services.progress.begin(plan.message)
  const succeeded: ImageBatchSuccess[] = []
  const failed: ImageBatchFailure[] = []
  let cancelled = false
  try {
    const usedNames = new Set<string>()
    let index = 0
    for (const source of req.paths) {
      if (services.progress.isCancelled(id)) {
        cancelled = true
        break
      }
      handle.report(req.paths.length === 0 ? null : index / req.paths.length, path.basename(source))
      try {
        const name = uniqueName(plan.outputNameFor(source), usedNames)
        const tempOutput = path.join(opDir, `${index}-${name}`)
        await plan.process(source, tempOutput)
        // Verify the temp output exists before promoting it to the target.
        await fs.stat(tempOutput)
        const target = path.join(req.outputDir, name)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.copyFile(tempOutput, target)
        const stat = await fs.stat(target)
        succeeded.push({ source, output: target, bytesWritten: stat.size })
      } catch (err) {
        failed.push({ source, error: serializeStashError(err) })
      }
      index += 1
    }
  } finally {
    if (!cancelled) {
      if (succeeded.length === 0 && failed.length > 0 && failed.length === req.paths.length) {
        handle.fail(failed[0]!.error)
      } else {
        handle.done()
      }
    }
    services.temp.cleanup(opDir)
  }
  return { succeeded, failed, cancelled, operationId: id }
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
  req: { path: string; outputDir: string },
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
      const name = uniqueName(plan.outputNameFor(sourceName), new Set())
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
    return runImageBatch(
      services,
      { paths, outputDir },
      {
        prefix: 'image-convert',
        message: 'Converting images…',
        outputNameFor: (source) => swapExtension(path.basename(source), format),
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
    return runImageBatch(
      services,
      { paths, outputDir },
      {
        prefix: 'image-compress',
        message: 'Compressing images…',
        outputNameFor: (source) => {
          const base = path.basename(source)
          const dot = base.lastIndexOf('.')
          const stem = dot <= 0 ? base : base.slice(0, dot)
          const ext = formatForExtension(dot <= 0 ? '' : base.slice(dot)) ?? ''
          return `${stem}-min${ext}`
        },
        process: (input, tempOutput) =>
          compressImage(input, tempOutput, { quality, maxDimension }).then((r) => r.bytesWritten)
      }
    )
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
    return runMediaOperation(
      services,
      { path: inputPath, outputDir },
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
    return runMediaOperation(
      services,
      { path: inputPath, outputDir },
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
    return runMediaOperation(
      services,
      { path: inputPath, outputDir },
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
    return runMediaOperation(
      services,
      { path: inputPath, outputDir },
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
    return runMediaOperation(
      services,
      { path: inputPath, outputDir },
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

  // --- Progress / cancellation ----------------------------------------------
  handle(IPC.progressCancel, (_e, operationId: unknown) =>
    services.progress.cancel(assertString(operationId, 'operationId'))
  )
}
