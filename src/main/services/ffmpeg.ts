import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
// Outside the Electron runtime this resolves to the binary path (no `app`),
// so guarded access below keeps the pure helpers test-safe.
import * as electron from 'electron'

/**
 * FFmpeg binary management.
 *
 * Resolution order (cached after first success):
 *   1. bundled exes under `resources/ffmpeg` — dev repo or packaged app;
 *   2. whatever `ffmpeg`/`ffprobe` resolves to on the system PATH.
 *
 * Pure helpers take explicit parameters so they are testable without
 * Electron; `resolveFfmpegBinaries` is the thin app-aware wrapper.
 */

export interface FfmpegBinaries {
  ffmpegPath: string
  ffprobePath: string
  source: 'bundled' | 'path'
}

export type FfmpegResolution = FfmpegBinaries | { error: string }

/** Executable names accepted inside a bundled directory, .exe first. */
const EXE_SUFFIXES = process.platform === 'win32' ? ['.exe', ''] : ['', '.exe']

function existsExecutable(dir: string, name: string): string | null {
  for (const suffix of EXE_SUFFIXES) {
    const candidate = path.join(dir, `${name}${suffix}`)
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
    } catch {
      // Unreadable candidate — keep probing other names.
    }
  }
  return null
}

/**
 * Compute the directories that may contain bundled binaries, in priority
 * order. Both inputs are optional so tests can exercise each branch.
 */
export function candidateDirs(input: { appPath?: string; resourcesPath?: string }): string[] {
  const dirs: string[] = []
  // electron-builder style: resources/ffmpeg next to the executable.
  if (input.resourcesPath) dirs.push(path.join(input.resourcesPath, 'ffmpeg'))
  // Development layout: <repo>/resources/ffmpeg beside the project root.
  if (input.appPath) dirs.push(path.join(input.appPath, 'resources', 'ffmpeg'))
  return [...new Set(dirs)]
}

export interface BundledProbe {
  dir: string
  ffmpegPath: string
  ffprobePath: string
}

/** Find both executables in one of the given directories. */
export function findBundledBinaries(dirs: string[]): BundledProbe | null {
  for (const dir of dirs) {
    const ffmpegPath = existsExecutable(dir, 'ffmpeg')
    const ffprobePath = existsExecutable(dir, 'ffprobe')
    if (ffmpegPath && ffprobePath) return { dir, ffmpegPath, ffprobePath }
  }
  return null
}

/** First non-empty line of `-version` output, e.g. "ffmpeg version 6.1 …". */
export function parseVersionLine(stdout: string): string | null {
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.length > 0) return trimmed
  }
  return null
}

/** Spawn an executable with `-version` and resolve its first output line. */
export function getVersion(executablePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(executablePath, ['-version'], { windowsHide: true })
    } catch (err) {
      reject(err)
      return
    }
    let stdout = ''
    let settled = false
    const finish = (err: Error | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err) reject(err)
      else resolve(parseVersionLine(stdout) ?? '')
    }
    const timer = setTimeout(() => {
      child.kill()
      finish(new Error(`version check timed out after 5s: ${executablePath}`))
    }, 5000)
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8')
      const line = parseVersionLine(stdout)
      if (line !== null) {
        child.kill()
        finish(null)
      }
    })
    child.on('error', (err) => finish(err))
    child.on('close', () => finish(new Error(`exited without version output: ${executablePath}`)))
  })
}

let cache: FfmpegBinaries | null | undefined

function bundledPaths(): BundledProbe | null {
  const app = (electron as { app?: { getAppPath(): string } }).app
  if (!app) return null
  return findBundledBinaries(
    candidateDirs({
      appPath: app.getAppPath(),
      resourcesPath: (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    })
  )
}

/** Resolve and cache the FFmpeg toolchain; returns `{ error }` when absent. */
export async function resolveFfmpegBinaries(): Promise<FfmpegResolution> {
  if (cache) return cache

  const bundled = bundledPaths()
  if (bundled) {
    cache = {
      ffmpegPath: bundled.ffmpegPath,
      ffprobePath: bundled.ffprobePath,
      source: 'bundled'
    }
    return cache
  }

  try {
    await getVersion('ffmpeg')
    await getVersion('ffprobe')
    cache = { ffmpegPath: 'ffmpeg', ffprobePath: 'ffprobe', source: 'path' }
    return cache
  } catch {
    return {
      error:
        'FFmpeg was not found. Place ffmpeg.exe and ffprobe.exe in the "resources/ffmpeg" folder of the application.'
    }
  }
}

/** Test seam: forget any cached resolution. */
export function resetFfmpegCache(): void {
  cache = undefined
}
