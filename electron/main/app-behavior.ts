/**
 * System tray, open-at-login, and close-button behavior (ask / tray / quit).
 * Close "ask" uses a custom renderer dialog (not the OS message box).
 */
import {
  Tray,
  Menu,
  nativeImage,
  app,
  ipcMain,
  type BrowserWindow,
  type NativeImage,
} from 'electron'
import path from 'node:path'
import {
  patchAppConfig,
  type AppConfig,
  type AppConfigLocale,
  type CloseAction,
} from './app-config'
import { applyWindowsStartup } from './win-logon'

export type ClosePromptChoice = 'tray' | 'quit' | 'cancel'

export type ClosePromptResult = {
  choice: ClosePromptChoice
  remember: boolean
}

let tray: Tray | null = null
let isQuitting = false
let closeAction: CloseAction = 'ask'
let locale: AppConfigLocale | null = null
let closePromptOpen = false
let pendingCloseResolve: ((result: ClosePromptResult) => void) | null = null
let getMainWindow: (() => BrowserWindow | null) | null = null

type TrayCopy = { show: string; quitMenu: string }

const TRAY_COPY: Record<'en' | 'zh-CN' | 'zh-TW', TrayCopy> = {
  en: { show: 'Show GUI Toolbox', quitMenu: 'Quit' },
  'zh-CN': { show: '显示 GUI 工具箱', quitMenu: '退出' },
  'zh-TW': { show: '顯示 GUI 工具箱', quitMenu: '結束' },
}

function trayCopy(): TrayCopy {
  if (locale === 'zh-CN' || locale === 'zh-TW') return TRAY_COPY[locale]
  return TRAY_COPY.en
}

function resolveTrayIcon(): NativeImage {
  const iconPath = path.join(process.env.VITE_PUBLIC ?? '', 'favicon.ico')
  const image = nativeImage.createFromPath(iconPath)
  if (!image.isEmpty()) return image
  return nativeImage.createEmpty()
}

function showMainWindow(): void {
  const win = getMainWindow?.() ?? null
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function buildTrayMenu(): Menu {
  const copy = trayCopy()
  return Menu.buildFromTemplate([
    {
      label: copy.show,
      click: () => showMainWindow(),
    },
    { type: 'separator' },
    {
      label: copy.quitMenu,
      click: () => {
        void quitApp()
      },
    },
  ])
}

export function ensureTray(): void {
  if (tray) {
    tray.setContextMenu(buildTrayMenu())
    return
  }
  tray = new Tray(resolveTrayIcon())
  tray.setToolTip('GUI Toolbox')
  tray.setContextMenu(buildTrayMenu())
  tray.on('double-click', () => showMainWindow())
  tray.on('click', () => showMainWindow())
}

export function destroyTray(): void {
  if (!tray) return
  tray.destroy()
  tray = null
}

export async function quitApp(): Promise<void> {
  isQuitting = true
  destroyTray()
  app.quit()
}

export async function applyOpenAtLogin(
  enabled: boolean,
  asAdmin = false,
  interactive = false,
): Promise<void> {
  await applyWindowsStartup({ openAtLogin: enabled, asAdmin, interactive })
}

export function applyCloseAction(action: CloseAction): void {
  closeAction = action
  if (action === 'tray') {
    ensureTray()
    return
  }
  const win = getMainWindow?.() ?? null
  const hidden = Boolean(win && !win.isDestroyed() && !win.isVisible())
  if (!hidden) destroyTray()
  if (action !== 'tray' && hidden) {
    ensureTray()
  }
}

export async function applyAppBehaviorFromConfig(
  config: AppConfig,
  options?: { startupInteractive?: boolean },
): Promise<void> {
  locale = config.common.locale
  await applyOpenAtLogin(
    Boolean(config.common.openAtLogin),
    Boolean(config.common.openAtLoginAsAdmin),
    Boolean(options?.startupInteractive),
  )
  applyCloseAction(config.common.closeAction)
  if (tray) tray.setContextMenu(buildTrayMenu())
}

export function hideToTray(win: BrowserWindow): void {
  ensureTray()
  win.hide()
}

async function rememberCloseAction(action: 'tray' | 'quit'): Promise<void> {
  await patchAppConfig({ common: { closeAction: action } })
}

function settleClosePrompt(result: ClosePromptResult): void {
  const resolve = pendingCloseResolve
  pendingCloseResolve = null
  resolve?.(result)
}

function promptCloseChoice(win: BrowserWindow): Promise<ClosePromptResult> {
  return new Promise((resolve) => {
    pendingCloseResolve = resolve
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    win.focus()
    win.webContents.send('app:close-prompt')
  })
}

export function registerAppBehavior(options: {
  getMainWindow: () => BrowserWindow | null
}): void {
  getMainWindow = options.getMainWindow

  ipcMain.removeHandler('app:close-prompt-submit')
  ipcMain.handle(
    'app:close-prompt-submit',
    async (_event, raw: ClosePromptResult) => {
      const choice =
        raw?.choice === 'tray' || raw?.choice === 'quit' || raw?.choice === 'cancel'
          ? raw.choice
          : 'cancel'
      const remember = Boolean(raw?.remember) && choice !== 'cancel'
      settleClosePrompt({ choice, remember })
      return true
    },
  )

  app.on('before-quit', () => {
    isQuitting = true
    destroyTray()
    settleClosePrompt({ choice: 'cancel', remember: false })
  })
}

export function attachWindowCloseBehavior(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (isQuitting) return

    if (closeAction === 'quit') return

    if (closeAction === 'tray') {
      event.preventDefault()
      hideToTray(win)
      return
    }

    event.preventDefault()
    if (closePromptOpen) return
    closePromptOpen = true
    void promptCloseChoice(win)
      .then(async (result) => {
        if (result.choice === 'cancel') return
        if (result.remember) {
          await rememberCloseAction(result.choice)
        }
        if (result.choice === 'tray') {
          hideToTray(win)
          return
        }
        void quitApp()
      })
      .finally(() => {
        closePromptOpen = false
      })
  })
}
