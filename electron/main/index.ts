import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { registerUpdaterIpc } from './update'
import {
  deleteScript,
  listScripts,
  readScript,
  renameScript,
  updateScriptName,
  writeScript,
} from './scripts'
import {
  registerTranslatorIpc,
  startTranslator,
  stopTranslator,
} from './translator'
import {
  registerScriptRunnerIpc,
  startScriptRunner,
  stopScriptRunner,
} from './runner'
import {
  registerKeybindsIpc,
  startKeybinds,
  stopKeybinds,
} from './keybinds'
import { registerAppConfigIpc, loadAppConfig } from './app-config'
import { destroyAppToast } from './app-toast'
import { registerScriptsDirIpc } from './scripts-dir'
import {
  applyAppBehaviorFromConfig,
  attachWindowCloseBehavior,
  registerAppBehavior,
} from './app-behavior'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (process.platform === 'win32' && os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'GUI Toolbox',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    show: false,
    backgroundColor: '#181818',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#141414',
      symbolColor: '#cccccc',
      height: 36,
    },
    webPreferences: {
      preload,
    },
  })

  win.once('ready-to-show', () => {
    if (win && !win.isDestroyed()) win.show()
  })

  win.on('closed', () => {
    win = null
  })

  attachWindowCloseBehavior(win)

  startTranslator(win)
  startScriptRunner(win)
  startKeybinds(win)

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('main-process-message', new Date().toLocaleString())
    }
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  ipcMain.handle('scripts:list', async () => listScripts())
  ipcMain.handle(
    'scripts:updateName',
    async (_event, filename: string, name: string) =>
      updateScriptName(filename, name),
  )
  // Back-compat alias for older preload builds
  ipcMain.handle(
    'scripts:updateDescription',
    async (_event, filename: string, description: string) =>
      updateScriptName(filename, description),
  )
  ipcMain.handle(
    'scripts:rename',
    async (_event, filename: string, nextFilename: string) =>
      renameScript(filename, nextFilename),
  )
  ipcMain.handle('scripts:delete', async (_event, filename: string) =>
    deleteScript(filename),
  )
  ipcMain.handle('scripts:read', async (_event, filename: string) =>
    readScript(filename),
  )
  ipcMain.handle(
    'scripts:write',
    async (_event, filename: string, content: Record<string, unknown>) =>
      writeScript(filename, content),
  )

  registerTranslatorIpc(ipcMain)
  registerScriptRunnerIpc(ipcMain)
  registerKeybindsIpc(ipcMain)
  registerAppConfigIpc(ipcMain)
  registerScriptsDirIpc(ipcMain)
  registerUpdaterIpc()
  registerAppBehavior({ getMainWindow: () => win })
  void loadAppConfig().then((config) => {
    applyAppBehaviorFromConfig(config)
    void createWindow()
  })
})

app.on('window-all-closed', () => {
  // When close-to-tray hides the window, this may not fire until a real quit.
  stopTranslator()
  stopScriptRunner()
  stopKeybinds()
  destroyAppToast()
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopTranslator()
  stopScriptRunner()
  stopKeybinds()
  destroyAppToast()
})

app.on('second-instance', () => {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    win.focus()
    return
  }
  void createWindow()
})

app.on('activate', () => {
  if (win && !win.isDestroyed()) {
    if (!win.isVisible()) win.show()
    win.focus()
    return
  }
  const allWindows = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed())
  if (allWindows.length) {
    allWindows[0].show()
    allWindows[0].focus()
  } else {
    void createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
