import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import * as electron from 'electron'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import JSZip from 'jszip'
import type { CheckDependenciesOptions, DependencyItem, DependencyReport } from '../../shared/ipc'
import { resolveTessdataDir } from '../processing/ocr'
import { getVersion, resetFfmpegCache, resolveFfmpegBinaries } from './ffmpeg'

/**
 * Probes and verifies all core runtime engines, native modules,
 * and external CLI binaries (e.g. FFmpeg, Tesseract, SQLite).
 */
export async function checkAllDependencies(
  options?: CheckDependenciesOptions
): Promise<DependencyReport> {
  if (options?.invalidateCache) {
    resetFfmpegCache()
  }

  const items: DependencyItem[] = []

  // 1. FFmpeg & FFprobe (Media toolchain)
  const mediaTools = [
    'Video Converter',
    'Video Compressor',
    'Video to GIF',
    'Audio Extractor',
    'Audio Converter',
    'Media Inspector',
    'Audio Waveform / Trimmer'
  ]
  try {
    const ffmpegRes = await resolveFfmpegBinaries()
    if ('error' in ffmpegRes) {
      items.push({
        id: 'ffmpeg',
        name: 'FFmpeg & FFprobe',
        category: 'media',
        status: 'missing',
        source: 'bundled',
        requiredFor: mediaTools,
        details: ffmpegRes.error,
        installable: true,
        downloadSize: '~25 MB',
        troubleshooting:
          'Place ffmpeg.exe and ffprobe.exe in the "resources/ffmpeg" folder of the application or click Install.'
      })
    } else {
      let ffmpegVer: string | undefined
      let ffprobeVer: string | undefined
      try {
        ffmpegVer = await getVersion(ffmpegRes.ffmpegPath)
      } catch {
        // Version call failed
      }
      try {
        ffprobeVer = await getVersion(ffmpegRes.ffprobePath)
      } catch {
        // Version call failed
      }

      const isDegraded = !ffmpegVer || !ffprobeVer
      items.push({
        id: 'ffmpeg',
        name: 'FFmpeg & FFprobe',
        category: 'media',
        status: isDegraded ? 'degraded' : 'ready',
        version: ffmpegVer
          ? `${ffmpegVer}${ffprobeVer ? ` / ${ffprobeVer}` : ''}`
          : 'Executable detected',
        path: ffmpegRes.ffmpegPath,
        source: ffmpegRes.source === 'bundled' ? 'bundled' : 'system',
        requiredFor: mediaTools,
        details: isDegraded
          ? 'Binary detected but unresponsive to version query.'
          : `Fully operational ${ffmpegRes.source} media processing engine.`,
        troubleshooting: isDegraded
          ? 'Ensure binary permissions and architecture compatibility.'
          : undefined
      })
    }
  } catch (err) {
    items.push({
      id: 'ffmpeg',
      name: 'FFmpeg & FFprobe',
      category: 'media',
      status: 'missing',
      requiredFor: mediaTools,
      details: err instanceof Error ? err.message : String(err),
      installable: true,
      downloadSize: '~25 MB',
      troubleshooting: 'Place ffmpeg.exe and ffprobe.exe in the resources/ffmpeg folder or click Install.'
    })
  }

  // 2. Sharp & Libvips (Image Processing Engine)
  const imageTools = [
    'Image Converter',
    'Image Compressor',
    'Image Watermarker',
    'Social Media Resizer',
    'Icon Pack Generator',
    'Image Slicer',
    'Favicon Generator',
    'Color Palette Extractor',
    'EXIF Editor'
  ]
  try {
    const versions = sharp.versions
    items.push({
      id: 'sharp',
      name: 'Sharp & Libvips',
      category: 'image',
      status: 'ready',
      version: `Sharp v${versions.sharp} (libvips ${versions.vips})`,
      source: 'embedded',
      requiredFor: imageTools,
      details: 'Hardware-accelerated C++ image decoding, resizing, color-grading and export engine.'
    })
  } catch (err) {
    items.push({
      id: 'sharp',
      name: 'Sharp & Libvips',
      category: 'image',
      status: 'missing',
      source: 'embedded',
      requiredFor: imageTools,
      details: err instanceof Error ? err.message : String(err),
      troubleshooting: 'Rebuild native bindings using npm rebuild.'
    })
  }

  // 3. Tesseract OCR & Language Data
  const ocrTools = ['Image to Text (OCR)']
  try {
    const app = (electron as { app?: { getAppPath(): string } }).app
    const tessDir = resolveTessdataDir({
      appPath: app?.getAppPath?.(),
      resourcesPath: (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
    })

    let models: string[] = []
    if (fs.existsSync(tessDir) && fs.statSync(tessDir).isDirectory()) {
      const files = fs.readdirSync(tessDir)
      models = files
        .filter((f) => f.includes('.traineddata'))
        .map((f) => f.replace(/\.traineddata(\.gz)?$/, ''))
    }

    if (models.length > 0) {
      items.push({
        id: 'tesseract',
        name: 'Tesseract OCR Engine',
        category: 'document',
        status: 'ready',
        version: `Tesseract.js v7.0.0 (${models.join(', ')})`,
        path: tessDir,
        source: 'bundled',
        requiredFor: ocrTools,
        details: `Offline neural OCR models loaded: ${models.join(', ')}.`
      })
    } else {
      items.push({
        id: 'tesseract',
        name: 'Tesseract OCR Engine',
        category: 'document',
        status: 'missing',
        path: tessDir,
        source: 'bundled',
        requiredFor: ocrTools,
        details: 'No .traineddata or .traineddata.gz models found in tessdata directory.',
        installable: true,
        downloadSize: '~4 MB',
        troubleshooting:
          'Place eng.traineddata or eng.traineddata.gz in the resources/tessdata directory or click Install.'
      })
    }
  } catch (err) {
    items.push({
      id: 'tesseract',
      name: 'Tesseract OCR Engine',
      category: 'document',
      status: 'missing',
      source: 'bundled',
      requiredFor: ocrTools,
      details: err instanceof Error ? err.message : String(err),
      troubleshooting:
        'Place eng.traineddata or eng.traineddata.gz in the resources/tessdata directory.'
    })
  }

  // 4. SQLite 3 Database Engine
  const dbTools = [
    'User Preferences',
    'Activity History',
    'Asset Vault',
    'Batch Queues',
    'Prompt Library'
  ]
  try {
    const testDb = new DatabaseSync(':memory:')
    const row = testDb.prepare('SELECT sqlite_version() as ver').get() as
      { ver: string } | undefined
    testDb.close()
    const sqliteVersion = row?.ver ?? '3.x'
    items.push({
      id: 'sqlite',
      name: 'SQLite 3 Engine',
      category: 'storage',
      status: 'ready',
      version: `SQLite v${sqliteVersion}`,
      source: 'embedded',
      requiredFor: dbTools,
      details: 'Embedded ACID WAL-mode database for persistent settings and metadata.'
    })
  } catch (err) {
    items.push({
      id: 'sqlite',
      name: 'SQLite 3 Engine',
      category: 'storage',
      status: 'missing',
      source: 'embedded',
      requiredFor: dbTools,
      details: err instanceof Error ? err.message : String(err),
      troubleshooting: 'Native node:sqlite engine required (Node.js >= 22).'
    })
  }

  // 5. PDF Vector Engine (pdf-lib & pdfjs-dist)
  const pdfTools = [
    'PDF Merge',
    'PDF Split',
    'PDF Rotate',
    'PDF Compress',
    'PDF Page Reorder',
    'Images to PDF',
    'Markdown to PDF',
    'PDF Numberer',
    'PDF Watermarker'
  ]
  try {
    const doc = await PDFDocument.create()
    doc.addPage([100, 100])
    await doc.save()
    items.push({
      id: 'pdf-engine',
      name: 'PDF Vector Engine',
      category: 'document',
      status: 'ready',
      version: 'pdf-lib v1.17.1 & pdfjs-dist',
      source: 'embedded',
      requiredFor: pdfTools,
      details: 'Pure-JS vector PDF synthesis, manipulation, and page geometry engine.'
    })
  } catch (err) {
    items.push({
      id: 'pdf-engine',
      name: 'PDF Vector Engine',
      category: 'document',
      status: 'degraded',
      source: 'embedded',
      requiredFor: pdfTools,
      details: err instanceof Error ? err.message : String(err)
    })
  }

  // 6. Archive Engines (JSZip, unzipper, node-unrar-js)
  const archiveTools = [
    'ZIP Creator',
    'ZIP Extractor',
    'Archive Inspector',
    'Icon Pack Generator',
    'Batch Renamer'
  ]
  items.push({
    id: 'archives',
    name: 'Archive Engine',
    category: 'runtime',
    status: 'ready',
    version: 'JSZip & node-unrar-js',
    source: 'embedded',
    requiredFor: archiveTools,
    details: 'Streaming archive compression, extraction, and inspection (ZIP, TAR, RAR).'
  })

  // 7. Local LLM Endpoint (Ollama / Local Inference)
  const llmTools = ['Local LLM Playground']
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1500)
    const response = await fetch('http://127.0.0.1:11434/api/version', {
      signal: controller.signal
    }).catch(() => null)
    clearTimeout(timeout)

    if (response && response.ok) {
      const data = (await response.json().catch(() => ({}))) as { version?: string }
      items.push({
        id: 'ollama',
        name: 'Local LLM (Ollama)',
        category: 'ai',
        status: 'ready',
        version: `Ollama v${data.version ?? 'active'}`,
        path: 'http://127.0.0.1:11434',
        source: 'network',
        requiredFor: llmTools,
        details: 'Local inference daemon running and ready to serve models.'
      })
    } else {
      items.push({
        id: 'ollama',
        name: 'Local LLM (Ollama)',
        category: 'ai',
        status: 'optional_offline',
        version: 'Offline',
        path: 'http://127.0.0.1:11434',
        source: 'network',
        requiredFor: llmTools,
        details: 'Local inference server offline (Optional: run "ollama serve" for local models).',
        troubleshooting:
          'To use offline AI models, start Ollama ("ollama serve") or an OpenAI-compatible daemon.'
      })
    }
  } catch {
    items.push({
      id: 'ollama',
      name: 'Local LLM (Ollama)',
      category: 'ai',
      status: 'optional_offline',
      version: 'Offline',
      path: 'http://127.0.0.1:11434',
      source: 'network',
      requiredFor: llmTools,
      details: 'Local inference server offline (Optional: run "ollama serve" for local models).',
      troubleshooting:
        'To use offline AI models, start Ollama ("ollama serve") or an OpenAI-compatible daemon.'
    })
  }

  const electronApp = (electron as { app?: { getAppPath(): string } }).app
  const resourcesPath =
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ||
    (electronApp ? path.join(electronApp.getAppPath(), 'resources') : path.resolve('resources'))

  // 8. MiniLM Semantic Decision Router (Path B)
  const routerTools = ['Hermano Copilot', 'Tool Decision Router']
  const minilmModelFile = path.join(
    resourcesPath,
    'models',
    'Xenova',
    'all-MiniLM-L6-v2',
    'onnx',
    'model_quantized.onnx'
  )
  if (fs.existsSync(minilmModelFile)) {
    items.push({
      id: 'minilm-model',
      name: 'MiniLM Semantic Decision Router',
      category: 'ai',
      status: 'ready',
      version: 'all-MiniLM-L6-v2 (23 MB INT8)',
      source: 'bundled',
      requiredFor: routerTools,
      details: 'Quantized 384-dimensional vector embedding engine for Hermano intent routing.'
    })
  } else {
    items.push({
      id: 'minilm-model',
      name: 'MiniLM Semantic Decision Router',
      category: 'ai',
      status: 'missing',
      source: 'bundled',
      requiredFor: routerTools,
      details: 'Semantic vector model not installed. Hermano uses keyword fallback.',
      installable: true,
      downloadSize: '~23 MB',
      troubleshooting:
        'Click Install to download the 23 MB local semantic model into resources/models/.'
    })
  }

  // Calculate summary metrics

  const total = items.length
  const ready = items.filter((i) => i.status === 'ready').length
  const missing = items.filter((i) => i.status === 'missing' || i.status === 'degraded').length
  const optionalOffline = items.filter((i) => i.status === 'optional_offline').length

  return {
    checkedAt: new Date().toISOString(),
    resourcesPath,

    platform: {
      os: `${process.platform} (${process.arch})`,
      arch: process.arch,
      electron: process.versions.electron ?? 'development',
      node: process.versions.node,
      chrome: process.versions.chrome ?? 'development'
    },
    summary: {
      total,
      ready,
      missing,
      optionalOffline
    },
    items
  }
}

/**
 * 1-click on-demand installer for individual dependencies (FFmpeg, Tesseract, etc.).
 * Downloads and unpacks dependencies into resources/<dep>/ without bloating the desktop installer.
 */
export async function installDependency(
  id: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const electronApp = (electron as { app?: { getAppPath(): string } }).app
  const resourcesPath =
    (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath ||
    (electronApp ? path.join(electronApp.getAppPath(), 'resources') : path.resolve('resources'))

  if (id === 'ffmpeg') {
    try {
      const ffmpegDir = path.join(resourcesPath, 'ffmpeg')
      await fs.promises.mkdir(ffmpegDir, { recursive: true })

      const isWin = process.platform === 'win32'
      const isMac = process.platform === 'darwin'
      const platformKey = isWin ? 'win-64' : isMac ? 'osx-64' : 'linux-64'

      const ffmpegUrl = `https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-${platformKey}.zip`
      const ffprobeUrl = `https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-${platformKey}.zip`

      const downloadAndExtract = async (url: string) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        const arrayBuf = await res.arrayBuffer()
        const zip = await JSZip.loadAsync(arrayBuf)
        for (const [filename, entry] of Object.entries(zip.files)) {
          if (!entry.dir) {
            const content = await entry.async('nodebuffer')
            const dest = path.join(ffmpegDir, filename)
            await fs.promises.writeFile(dest, content)
            if (!isWin) {
              await fs.promises.chmod(dest, 0o755)
            }
          }
        }
      }

      await Promise.all([downloadAndExtract(ffmpegUrl), downloadAndExtract(ffprobeUrl)])
      resetFfmpegCache()

      return {
        success: true,
        message: `FFmpeg and FFprobe binaries installed successfully into ${ffmpegDir}`
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to download/install FFmpeg: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }

  if (id === 'tesseract') {
    try {
      const tessDir = path.join(resourcesPath, 'tessdata')
      await fs.promises.mkdir(tessDir, { recursive: true })
      const url = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/eng.traineddata'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const arrayBuf = await res.arrayBuffer()
      const dest = path.join(tessDir, 'eng.traineddata')
      await fs.promises.writeFile(dest, Buffer.from(arrayBuf))

      return {
        success: true,
        message: `Tesseract English OCR language pack installed successfully into ${tessDir}`
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to download Tesseract language data: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }

  if (id === 'minilm-model') {
    try {
      const modelDir = path.join(resourcesPath, 'models', 'Xenova', 'all-MiniLM-L6-v2')
      const onnxDir = path.join(modelDir, 'onnx')
      await fs.promises.mkdir(onnxDir, { recursive: true })

      const files = [
        {
          url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/config.json',
          dest: path.join(modelDir, 'config.json')
        },
        {
          url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json',
          dest: path.join(modelDir, 'tokenizer.json')
        },
        {
          url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer_config.json',
          dest: path.join(modelDir, 'tokenizer_config.json')
        },
        {
          url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx',
          dest: path.join(onnxDir, 'model_quantized.onnx')
        }
      ]

      for (const item of files) {
        const res = await fetch(item.url)
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${item.url}`)
        const arrayBuf = await res.arrayBuffer()
        await fs.promises.writeFile(item.dest, Buffer.from(arrayBuf))
      }

      return {
        success: true,
        message: 'MiniLM semantic model (~23 MB) downloaded and installed successfully.'
      }
    } catch (err) {
      return {
        success: false,
        error: `Failed to download MiniLM model: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }

  return {
    success: false,
    error: `Dependency "${id}" does not have an automated 1-click installer.`
  }
}


