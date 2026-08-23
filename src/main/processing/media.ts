import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ERROR_CODES, stashError } from '../../shared/errors'
import type { AudioCodec, MediaInfo, MediaStreamInfo, VideoOutputFormat } from '../../shared/ipc'

/**
 * FFmpeg-backed media processing services.
 *
 * Every operation follows the shared file lifecycle: validate → temporary
 * workspace (caller-owned) → process with progress/cancellation → verify the
 * output by re-probing it → hand back bytes written. Pure parsers are
 * exported separately so they can be unit tested against fixtures.
 */

export interface MediaToolsContext {
  ffmpegPath: string
  ffprobePath: string
}

/** Optional progress/cancellation wiring supplied by the IPC layer. */
export interface MediaOpHooks {
  onProgress?: (ratio: number | null, message?: string) => void
  shouldCancel?: () => boolean
}

export interface MediaOpResult {
  outputPath: string
  bytesWritten: number
  verified: boolean
  info: MediaInfo
}

// --- Pure parsers -----------------------------------------------------------

/** Parse one `key=value` progress line; null for anything else. */
export function parseFfmpegProgressLine(line: string): { key: string; value: string } | null {
  const eq = line.indexOf('=')
  if (eq <= 0) return null
  const key = line.slice(0, eq).trim()
  const value = line.slice(eq + 1).trim()
  if (key.length === 0 || value.length === 0) return null
  return { key, value }
}

/** Convert an ffmpeg `HH:MM:SS.micros` timestamp into seconds. */
export function outTimeStringToSeconds(value: string): number | null {
  const parts = value.split(':')
  if (parts.length !== 3) return null
  const hours = Number(parts[0])
  const minutes = Number(parts[1])
  const seconds = Number(parts[2])
  if (![hours, minutes, seconds].every(Number.isFinite)) return null
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Progress ratio from one ffmpeg `-progress` line. `out_time_us` and the
 * historically mislabeled `out_time_ms` both carry microseconds; `out_time`
 * carries a wall-clock timestamp.
 */
export function progressRatioFromLine(
  key: string,
  value: string,
  totalDurationSec: number | null
): number | null {
  if (totalDurationSec === null || totalDurationSec <= 0) return null
  let seconds: number | null = null
  if (key === 'out_time_us' || key === 'out_time_ms') {
    const micros = Number(value)
    seconds = Number.isFinite(micros) ? micros / 1_000_000 : null
  } else if (key === 'out_time') {
    seconds = outTimeStringToSeconds(value)
  }
  if (seconds === null) return null
  return Math.min(1, Math.max(0, seconds / totalDurationSec))
}

interface RawFfprobeStream {
  codec_type?: string
  codec_name?: string
  width?: number
  height?: number
  sample_rate?: string
  channels?: number
}

interface RawFfprobeOutput {
  format?: {
    duration?: string
    format_name?: string
    bit_rate?: string
    size?: string
  }
  streams?: RawFfprobeStream[]
}

/**
 * Parse realistic ffprobe `-print_format json -show_format -show_streams`
 * output into a sanitized MediaInfo. Throws on malformed JSON.
 */
export function parseFfprobeJson(stdout: string): MediaInfo {
  let raw: RawFfprobeOutput
  try {
    raw = JSON.parse(stdout) as RawFfprobeOutput
  } catch {
    throw new Error('ffprobe did not return valid JSON')
  }
  const streams: MediaStreamInfo[] = (raw.streams ?? []).map((stream) => {
    const type =
      stream.codec_type === 'video' ? 'video' : stream.codec_type === 'audio' ? 'audio' : 'other'
    const sampleRate = stream.sample_rate !== undefined ? Number(stream.sample_rate) : undefined
    return {
      type,
      ...(stream.codec_name !== undefined ? { codec: stream.codec_name } : {}),
      ...(stream.width !== undefined ? { width: stream.width } : {}),
      ...(stream.height !== undefined ? { height: stream.height } : {}),
      ...(sampleRate !== undefined && Number.isFinite(sampleRate) ? { sampleRate } : {}),
      ...(stream.channels !== undefined ? { channels: stream.channels } : {})
    }
  })
  const durationSec =
    raw.format?.duration !== undefined && Number.isFinite(Number(raw.format.duration))
      ? Number(raw.format.duration)
      : undefined
  const bitrate =
    raw.format?.bit_rate !== undefined && Number.isFinite(Number(raw.format.bit_rate))
      ? Number(raw.format.bit_rate)
      : undefined
  const sizeBytes =
    raw.format?.size !== undefined && Number.isFinite(Number(raw.format.size))
      ? Number(raw.format.size)
      : undefined
  return {
    ...(durationSec !== undefined ? { durationSec } : {}),
    ...(raw.format?.format_name !== undefined ? { formatName: raw.format.format_name } : {}),
    ...(bitrate !== undefined ? { bitrate } : {}),
    ...(sizeBytes !== undefined ? { sizeBytes } : {}),
    streams
  }
}

// --- Process wrappers -------------------------------------------------------

function spawnCapture(
  executable: string,
  args: string[]
): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(executable, args, { windowsHide: true })
    } catch (err) {
      reject(err)
      return
    }
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8')
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout }))
  })
}

/** Probe any media file via ffprobe; rejects with an actionable StashError. */
export async function probeMedia(ffprobePath: string, inputPath: string): Promise<MediaInfo> {
  const name = path.basename(inputPath)
  let result: { code: number | null; stdout: string }
  try {
    result = await spawnCapture(ffprobePath, [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      inputPath
    ])
  } catch (err) {
    throw stashError('UNSUPPORTED', `FFmpeg tools could not be started to inspect "${name}".`, {
      technicalMessage: String(err)
    })
  }
  if (result.code !== 0) {
    throw stashError('UNSUPPORTED', `"${name}" isn't a readable media file.`, {
      technicalMessage: `ffprobe exited with code ${result.code}`
    })
  }
  try {
    return parseFfprobeJson(result.stdout)
  } catch (err) {
    throw stashError(
      'UNSUPPORTED',
      `"${name}" could not be inspected — it may be corrupted or unsupported.`,
      { technicalMessage: String((err as Error)?.message ?? err) }
    )
  }
}

export interface RunFfmpegOptions {
  ffmpegPath: string
  args: string[]
  /** Known source/output duration used to derive 0..1 progress ratios. */
  totalDurationSec: number | null
  onProgress?: (ratio: number | null, message?: string) => void
  shouldCancel?: () => boolean
  /** Basename shown in error messages. */
  sourceName?: string
}

export interface RunFfmpegResult {
  wasCancelled: false
  rawStderrTail: string
}

const STDERR_TAIL_LINES = 15

/**
 * Spawn one ffmpeg invocation with machine-readable progress on stdout.
 * Cancellation kills the child immediately (`child.kill()` terminates
 * directly on Windows) and rejects with a structured CANCELLED error.
 */
export async function runFfmpeg(opts: RunFfmpegOptions): Promise<RunFfmpegResult> {
  const sourceName = opts.sourceName

  return new Promise<RunFfmpegResult>((resolve, reject) => {
    const args = ['-hide_banner', '-y', ...opts.args, '-progress', 'pipe:1', '-nostats']
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(opts.ffmpegPath, args, { windowsHide: true })
    } catch (err) {
      reject(
        stashError('UNSUPPORTED', 'FFmpeg could not be started.', { technicalMessage: String(err) })
      )
      return
    }

    const stderrChunks: string[] = []
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk.toString('utf-8'))
      // Keep memory bounded on very chatty encodes.
      if (stderrChunks.length > 400) stderrChunks.splice(0, 200)
    })

    const stderrTail = (): string =>
      stderrChunks.join('').split(/\r?\n/).filter(Boolean).slice(-STDERR_TAIL_LINES).join('\n')

    let settled = false
    const settle = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearInterval(poller)
      fn()
    }

    // Poll cancellation on a fixed cadence AND react instantly through the
    // ProgressBus onCancel hook (checked once right away as well).
    const checkCancelled = (): void => {
      if (!opts.shouldCancel?.()) return
      child.kill()
      settle(() =>
        reject(
          stashError(
            ERROR_CODES.CANCELLED,
            `${sourceName ? `"${sourceName}"` : 'The operation'} was cancelled.`,
            { recoverable: true }
          )
        )
      )
    }
    const poller = setInterval(checkCancelled, 500)

    let lineBuffer = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString('utf-8')
      const lines = lineBuffer.split(/\r?\n/)
      lineBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const parsed = parseFfmpegProgressLine(line)
        if (!parsed) continue
        const ratio = progressRatioFromLine(parsed.key, parsed.value, opts.totalDurationSec)
        if (ratio !== null) opts.onProgress?.(ratio)
      }
    })

    child.on('error', (err) =>
      settle(() =>
        reject(
          stashError('UNSUPPORTED', 'FFmpeg could not be started.', {
            technicalMessage: String(err)
          })
        )
      )
    )

    child.on('close', (code) =>
      settle(() => {
        if (code === 0) {
          resolve({ wasCancelled: false, rawStderrTail: stderrTail() })
          return
        }
        reject(
          stashError(
            'UNSUPPORTED',
            `"${sourceName ?? 'the file'}" couldn't be processed by FFmpeg.`,
            { technicalMessage: stderrTail() || `ffmpeg exited with code ${code}` }
          )
        )
      })
    )

    checkCancelled()
  })
}

// --- Verification -----------------------------------------------------------

export type VerifyExpectation =
  | { kind: 'video'; expectedDurationSec?: number }
  | { kind: 'audio'; expectedDurationSec?: number }
  | { kind: 'gif' }

export interface VerifySummary {
  verified: true
  actualDurationSec?: number
}

const DURATION_TOLERANCE_RATIO = 0.1

/**
 * Pure verification against probed metadata: container/stream kind first,
 * then duration within ±10% when both sides are known.
 */
export function verifyMediaInfo(info: MediaInfo, expectation: VerifyExpectation): VerifySummary {
  const label =
    expectation.kind === 'gif'
      ? 'GIF animation'
      : expectation.kind === 'video'
        ? 'video file'
        : 'audio file'

  const hasKind = (type: MediaStreamInfo['type']): boolean =>
    info.streams.some((stream) => stream.type === type)
  const ok =
    expectation.kind === 'gif'
      ? (info.formatName ?? '').toLowerCase().includes('gif') && hasKind('video')
      : hasKind(expectation.kind)

  if (!ok) {
    throw stashError(
      'UNSUPPORTED',
      `The result wasn't a valid ${label}. The conversion produced unexpected data.`,
      {
        technicalMessage: `format=${info.formatName ?? '?'} streams=${info.streams
          .map((s) => s.type)
          .join(',')}`
      }
    )
  }

  const expected = expectation.kind === 'gif' ? undefined : expectation.expectedDurationSec
  const actual = info.durationSec
  if (
    expected !== undefined &&
    actual !== undefined &&
    expected > 0 &&
    Math.abs(actual - expected) > expected * DURATION_TOLERANCE_RATIO
  ) {
    throw stashError(
      'UNSUPPORTED',
      `The ${label} came out with unexpected length (${actual.toFixed(1)}s instead of ${expected.toFixed(1)}s).`,
      { technicalMessage: `expected≈${expected}s actual=${actual}s` }
    )
  }
  return { verified: true, ...(actual !== undefined ? { actualDurationSec: actual } : {}) }
}

/** Re-probe a produced file and confirm it matches what was requested. */
export async function verifyOutputMedia(
  ffprobePath: string,
  outputPath: string,
  expectation: VerifyExpectation
): Promise<VerifySummary> {
  const info = await probeMedia(ffprobePath, outputPath)
  return verifyMediaInfo(info, expectation)
}

// --- Shared option plumbing -------------------------------------------------

export function clampCrf(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.round(Math.min(51, Math.max(0, value)))
}

export function clampBitrateKbps(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return Math.round(Math.min(320, Math.max(32, value)))
}

/** Aspect-preserving scale filter capped at the larger edge (or null). */
export function buildScaleFilter(maxDimension: number): string | null {
  if (!Number.isInteger(maxDimension) || maxDimension < 16) return null
  return `scale='if(gt(iw,ih),min(${maxDimension},iw),-2)':'if(gt(iw,ih),-2,min(${maxDimension},ih))'`
}

const VIDEO_CODEC_BY_FORMAT: Record<
  VideoOutputFormat,
  { video: string; audio: string; preset: boolean }
> = {
  mp4: { video: 'libx264', audio: 'aac', preset: true },
  mkv: { video: 'libx264', audio: 'aac', preset: true },
  webm: { video: 'libvpx-vp9', audio: 'libopus', preset: false }
}

export const AUDIO_CODEC_NAME: Record<AudioCodec, string> = {
  aac: 'aac',
  mp3: 'mp3',
  wav: 'pcm_s16le',
  flac: 'flac',
  opus: 'libopus'
}

export const AUDIO_EXTENSION_BY_CODEC: Record<AudioCodec, string> = {
  aac: '.m4a',
  mp3: '.mp3',
  wav: '.wav',
  flac: '.flac',
  opus: '.opus'
}

const LOSSY_CODECS: readonly AudioCodec[] = ['aac', 'mp3', 'opus']

async function finalizeOutput(
  ctx: MediaToolsContext,
  outputPath: string,
  expectation: VerifyExpectation
): Promise<Pick<MediaOpResult, 'bytesWritten' | 'verified' | 'info'>> {
  const stat = await fs.stat(outputPath)
  const info = await probeMedia(ctx.ffprobePath, outputPath)
  const verification = verifyMediaInfo(info, expectation)
  return { bytesWritten: stat.size, verified: verification.verified, info }
}

async function finishOperation(
  ctx: MediaToolsContext,
  outputPath: string,
  expectation: VerifyExpectation
): Promise<MediaOpResult> {
  return {
    outputPath,
    ...(await finalizeOutput(ctx, outputPath, expectation))
  }
}

// --- High-level operations --------------------------------------------------

export async function convertVideo(
  ctx: MediaToolsContext,
  inputPath: string,
  outputPath: string,
  opts: { format: VideoOutputFormat; crfQuality?: number } & MediaOpHooks
): Promise<MediaOpResult> {
  const codecs = VIDEO_CODEC_BY_FORMAT[opts.format]
  const crf = clampCrf(opts.crfQuality, 23)
  const probed = await probeMedia(ctx.ffprobePath, inputPath)
  await runFfmpeg({
    ffmpegPath: ctx.ffmpegPath,
    args: [
      '-i',
      inputPath,
      '-c:v',
      codecs.video,
      ...(codecs.preset ? ['-preset', 'veryfast'] : []),
      '-crf',
      String(crf),
      '-c:a',
      codecs.audio,
      outputPath
    ],
    totalDurationSec: probed.durationSec ?? null,
    onProgress: opts.onProgress,
    shouldCancel: opts.shouldCancel,
    sourceName: path.basename(inputPath)
  })
  return finishOperation(ctx, outputPath, {
    kind: 'video',
    expectedDurationSec: probed.durationSec
  })
}

export async function compressVideo(
  ctx: MediaToolsContext,
  inputPath: string,
  outputPath: string,
  opts: { crfQuality?: number; maxDimension?: number } & MediaOpHooks
): Promise<MediaOpResult> {
  const crf = clampCrf(opts.crfQuality, 28)
  const scale = opts.maxDimension !== undefined ? buildScaleFilter(opts.maxDimension) : null
  const probed = await probeMedia(ctx.ffprobePath, inputPath)
  await runFfmpeg({
    ffmpegPath: ctx.ffmpegPath,
    args: [
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      String(crf),
      ...(scale ? ['-vf', scale] : []),
      '-c:a',
      'aac',
      outputPath
    ],
    totalDurationSec: probed.durationSec ?? null,
    onProgress: opts.onProgress,
    shouldCancel: opts.shouldCancel,
    sourceName: path.basename(inputPath)
  })
  return finishOperation(ctx, outputPath, {
    kind: 'video',
    expectedDurationSec: probed.durationSec
  })
}

export async function videoToGif(
  ctx: MediaToolsContext,
  inputPath: string,
  outputPath: string,
  opts: { fps: number; maxWidth: number; palettePath: string } & MediaOpHooks
): Promise<MediaOpResult> {
  const fps = [10, 15, 24].includes(opts.fps) ? opts.fps : 10
  const maxWidth = [320, 480, 640].includes(opts.maxWidth) ? opts.maxWidth : 480
  const filters = `fps=${fps},scale=${maxWidth}:-1:flags=lanczos`
  const probed = await probeMedia(ctx.ffprobePath, inputPath)
  const common = {
    ffmpegPath: ctx.ffmpegPath,
    totalDurationSec: probed.durationSec ?? null,
    shouldCancel: opts.shouldCancel,
    sourceName: path.basename(inputPath)
  }

  // Pass 1 — build an optimized palette from the source frames (~15% of work).
  opts.onProgress?.(null, 'Analyzing colors…')
  await runFfmpeg({
    ...common,
    args: ['-i', inputPath, '-vf', `${filters},palettegen`, opts.palettePath],
    onProgress: (ratio) =>
      opts.onProgress?.(ratio === null ? null : ratio * 0.15, 'Analyzing colors…')
  })

  // Pass 2 — apply the palette to produce the final GIF (~85% of work).
  opts.onProgress?.(0.15, 'Rendering GIF…')
  await runFfmpeg({
    ...common,
    args: [
      '-i',
      inputPath,
      '-i',
      opts.palettePath,
      '-lavfi',
      `${filters}[x];[x][1:v]paletteuse`,
      outputPath
    ],
    onProgress: (ratio) =>
      opts.onProgress?.(ratio === null ? null : 0.15 + ratio * 0.85, 'Rendering GIF…')
  })

  return finishOperation(ctx, outputPath, { kind: 'gif' })
}

export async function extractAudio(
  ctx: MediaToolsContext,
  inputPath: string,
  outputPath: string,
  opts: { codec: AudioCodec; bitrateKbps?: number } & MediaOpHooks
): Promise<MediaOpResult> {
  return transcodeAudio(ctx, inputPath, outputPath, { ...opts, stripVideo: true })
}

export async function convertAudio(
  ctx: MediaToolsContext,
  inputPath: string,
  outputPath: string,
  opts: { codec: AudioCodec; bitrateKbps?: number } & MediaOpHooks
): Promise<MediaOpResult> {
  return transcodeAudio(ctx, inputPath, outputPath, { ...opts, stripVideo: false })
}

async function transcodeAudio(
  ctx: MediaToolsContext,
  inputPath: string,
  outputPath: string,
  opts: { codec: AudioCodec; bitrateKbps?: number; stripVideo: boolean } & MediaOpHooks
): Promise<MediaOpResult> {
  const codecName = AUDIO_CODEC_NAME[opts.codec]
  const lossy = LOSSY_CODECS.includes(opts.codec)
  const kbps = lossy ? clampBitrateKbps(opts.bitrateKbps ?? 192) : undefined
  const probed = await probeMedia(ctx.ffprobePath, inputPath)
  await runFfmpeg({
    ffmpegPath: ctx.ffmpegPath,
    args: [
      '-i',
      inputPath,
      ...(opts.stripVideo ? ['-vn', '-map', '0:a:0'] : []),
      '-c:a',
      codecName,
      ...(kbps !== undefined ? ['-b:a', `${kbps}k`] : []),
      outputPath
    ],
    totalDurationSec: probed.durationSec ?? null,
    onProgress: opts.onProgress,
    shouldCancel: opts.shouldCancel,
    sourceName: path.basename(inputPath)
  })
  return finishOperation(ctx, outputPath, {
    kind: 'audio',
    expectedDurationSec: probed.durationSec
  })
}
