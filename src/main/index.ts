import { app, BrowserWindow, protocol, shell } from 'electron'
import path from 'node:path'
import os from 'node:os'
import { openDatabase } from './services/db'
import {
  AssetStashStore,
  FavoritesStore,
  HistoryStore,
  PrefsStore,
  PromptsStore,
  RecentsStore
} from './services/stores'
import { TempWorkspaceManager } from './services/temp-workspace'
import { ProgressBus } from './ipc/progress'
import { WriteScopeGuard } from './ipc/write-scope'
import { registerIpc } from './ipc/register'
import { getCachedMedia } from './services/media-stream'
import { clampZoomFactor, DEFAULT_ZOOM_FACTOR, overlayHeightFor } from '../shared/utils/zoom'

// Register custom media streaming scheme before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'stash-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

// Prevent GPU cache issues in some environments; harmless elsewhere.
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication')

let mainWindow: BrowserWindow | null = null
let tempManager: TempWorkspaceManager | null = null
let progressBus: ProgressBus | null = null

const isSmokeTest = process.argv.includes('--smoke-test')
const isDev = !!process.env['ELECTRON_RENDERER_URL']

function createWindow(zoomFactor: number): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: '#16181d',
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    // Overlay metrics are window DIPs and do not scale with renderer zoom;
    // the height tracks 40 CSS px per zoom unit (see shared/utils/zoom).
    titleBarOverlay:
      process.platform === 'win32'
        ? {
            color: '#12141a',
            symbolColor: '#9aa2b1',
            height: overlayHeightFor(zoomFactor)
          }
        : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      zoomFactor
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Route progress events to the live window (re-wired if it is recreated).
  mainWindow.webContents.once('did-finish-load', () => {
    progressBus?.setSender(mainWindow!.webContents)
  })

  // Keep external links out of the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (isDev) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    progressBus?.setSender(undefined)
    mainWindow = null
  })
}

function initializeServices(): number {
  const userData = app.getPath('userData')
  const { db } = openDatabase(userData)
  tempManager = new TempWorkspaceManager(os.tmpdir())
  tempManager.purgeStale()

  let zoomFactor = DEFAULT_ZOOM_FACTOR
  try {
    const prefs = new PrefsStore(db)
    zoomFactor = clampZoomFactor(prefs.get('ui.zoom'))
  } catch {
    // A broken prefs row must never block startup — fall back to the default.
  }

  const progress = new ProgressBus()
  progressBus = progress
  registerIpc({
    prefs: new PrefsStore(db),
    favorites: new FavoritesStore(db),
    recents: new RecentsStore(db),
    history: new HistoryStore(db),
    prompts: new PromptsStore(db),
    assets: new AssetStashStore(db),
    temp: tempManager,
    progress,
    writeScope: new WriteScopeGuard(() => tempManager!.rootPath)
  })
  return zoomFactor
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock && !isSmokeTest) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // Protocol handler for in-memory media streaming with range requests
    protocol.handle('stash-media', (request) => {
      try {
        const parsed = new URL(request.url)
        const id = parsed.pathname.replace(/^\/+/, '') || parsed.hostname
        const media = getCachedMedia(id)

        if (!media) {
          return new Response('Media not found or expired', { status: 404 })
        }

        const { buffer, mimeType } = media
        const rangeHeader = request.headers.get('range')

        if (rangeHeader) {
          const parts = rangeHeader.replace(/bytes=/, '').split('-')
          const start = parseInt(parts[0], 10) || 0
          const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1
          const clampedEnd = Math.min(end, buffer.length - 1)
          const chunk = buffer.subarray(start, clampedEnd + 1)

          return new Response(new Uint8Array(chunk), {
            status: 206,
            headers: {
              'Content-Type': mimeType,
              'Content-Range': `bytes ${start}-${clampedEnd}/${buffer.length}`,
              'Content-Length': String(chunk.length),
              'Accept-Ranges': 'bytes'
            }
          })
        }

        return new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': String(buffer.length),
            'Accept-Ranges': 'bytes'
          }
        })
      } catch (err) {
        return new Response(String(err), { status: 500 })
      }
    })

    const zoomFactor = initializeServices()

    if (isSmokeTest) {
      // Headless verification mode: services initialized, then exit cleanly.
      console.log('STASH_SMOKE_OK')
      app.exit(0)
      return
    }

    createWindow(zoomFactor)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(zoomFactor)
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    tempManager?.disposeAll()
  })
}
