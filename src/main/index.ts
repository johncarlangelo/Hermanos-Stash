import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import os from 'node:os'
import { openDatabase } from './services/db'
import { FavoritesStore, HistoryStore, PrefsStore, RecentsStore } from './services/stores'
import { TempWorkspaceManager } from './services/temp-workspace'
import { ProgressBus } from './ipc/progress'
import { WriteScopeGuard } from './ipc/write-scope'
import { registerIpc } from './ipc/register'

// Prevent GPU cache issues in some environments; harmless elsewhere.
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication')

let mainWindow: BrowserWindow | null = null
let tempManager: TempWorkspaceManager | null = null
let progressBus: ProgressBus | null = null

const isSmokeTest = process.argv.includes('--smoke-test')
const isDev = !!process.env['ELECTRON_RENDERER_URL']

function createWindow(): void {
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
    // 44/154 match the renderer's 40/140 CSS px at the default 110% zoom.
    titleBarOverlay:
      process.platform === 'win32'
        ? { color: '#12141a', symbolColor: '#9aa2b1', height: 44 }
        : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      zoomFactor: 1.1
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

function initializeServices(): void {
  const userData = app.getPath('userData')
  const { db } = openDatabase(userData)
  tempManager = new TempWorkspaceManager(os.tmpdir())
  tempManager.purgeStale()

  const progress = new ProgressBus()
  progressBus = progress
  registerIpc({
    prefs: new PrefsStore(db),
    favorites: new FavoritesStore(db),
    recents: new RecentsStore(db),
    history: new HistoryStore(db),
    temp: tempManager,
    progress,
    writeScope: new WriteScopeGuard(() => tempManager!.rootPath)
  })
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
    initializeServices()

    if (isSmokeTest) {
      // Headless verification mode: services initialized, then exit cleanly.
      console.log('STASH_SMOKE_OK')
      app.exit(0)
      return
    }

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    tempManager?.disposeAll()
  })
}
