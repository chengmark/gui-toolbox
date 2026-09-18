/**
 * Global keybind capture for the shared recorder UI.
 * Mouse is captured via uiohook (screen-wide); in-window clicks stay on the
 * DOM path so the Record button can be ignored via [data-keybind-record].
 */
import { BrowserWindow, screen, type IpcMain } from 'electron'
import {
  uIOhook,
  UiohookKey,
  type UiohookKeyboardEvent,
  type UiohookMouseEvent,
} from 'uiohook-napi'
import { formatKeybind, type KeybindParts } from '../../src/shared/keybind/model'

/** libuiohook button ids → canonical mb* tokens. */
const UIOHOOK_BUTTON_TO_TOKEN: Record<number, string> = {
  1: 'mb1',
  2: 'mb2',
  3: 'mb3',
  4: 'mb4',
  5: 'mb5',
}

let recording = false
let hookAttached = false
let win: BrowserWindow | null = null

export function isKeybindRecording(): boolean {
  return recording
}

function isInsideMainWindow(x: number, y: number): boolean {
  if (!win || win.isDestroyed()) return false
  // uiohook reports physical screen pixels; BrowserWindow bounds are DIP.
  const dip = screen.screenToDipPoint({ x, y })
  const bounds = win.getBounds()
  return (
    dip.x >= bounds.x &&
    dip.x < bounds.x + bounds.width &&
    dip.y >= bounds.y &&
    dip.y < bounds.y + bounds.height
  )
}

function send(channel: 'keybindRecorder:result' | 'keybindRecorder:cancel', payload?: string) {
  if (!win || win.isDestroyed()) return
  if (channel === 'keybindRecorder:result') {
    win.webContents.send(channel, payload)
  } else {
    win.webContents.send(channel)
  }
}

function finishWithBind(parts: KeybindParts): void {
  const bind = formatKeybind(parts)
  stopRecording()
  send('keybindRecorder:result', bind)
}

function finishCancel(): void {
  stopRecording()
  send('keybindRecorder:cancel')
}

function onKeyDown(event: UiohookKeyboardEvent): void {
  if (!recording) return
  if (event.keycode === UiohookKey.Escape) {
    finishCancel()
  }
}

function onMouseDown(event: UiohookMouseEvent): void {
  if (!recording) return
  // In-window clicks are handled by the renderer DOM listener so the Record
  // button ([data-keybind-record]) is not captured as mb1.
  if (isInsideMainWindow(Number(event.x), Number(event.y))) return

  const token = UIOHOOK_BUTTON_TO_TOKEN[Number(event.button)]
  if (!token) return

  finishWithBind({
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
    key: token,
  })
}

function attachHook(): void {
  if (hookAttached) return
  try {
    uIOhook.off('keydown', onKeyDown)
    uIOhook.off('mousedown', onMouseDown)
    uIOhook.on('keydown', onKeyDown)
    uIOhook.on('mousedown', onMouseDown)
    uIOhook.start()
    hookAttached = true
  } catch {
    hookAttached = false
  }
}

function detachHook(): void {
  if (!hookAttached) return
  try {
    uIOhook.off('keydown', onKeyDown)
    uIOhook.off('mousedown', onMouseDown)
  } catch {
    // ignore
  }
  hookAttached = false
}

export function startKeybindRecording(targetWin: BrowserWindow): void {
  win = targetWin
  if (recording) return
  recording = true
  attachHook()
}

export function stopKeybindRecording(): void {
  stopRecording()
}

function stopRecording(): void {
  if (!recording) {
    detachHook()
    return
  }
  recording = false
  detachHook()
}

export function registerKeybindRecorderIpc(ipcMain: IpcMain): void {
  ipcMain.handle('keybindRecorder:start', (event) => {
    const target = BrowserWindow.fromWebContents(event.sender)
    if (!target || target.isDestroyed()) return { ok: false as const }
    startKeybindRecording(target)
    return { ok: true as const }
  })
  ipcMain.handle('keybindRecorder:stop', () => {
    stopKeybindRecording()
    return { ok: true as const }
  })
}
