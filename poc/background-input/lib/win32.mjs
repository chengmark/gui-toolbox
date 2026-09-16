/**
 * Minimal Win32 helpers for the background-input POC (Windows only).
 */
import koffi from 'koffi'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)

export const WM_KEYDOWN = 0x0100
export const WM_KEYUP = 0x0101
export const WM_CHAR = 0x0102
export const WM_SYSKEYDOWN = 0x0104
export const WM_SYSKEYUP = 0x0105

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
const KEYEVENTF_EXTENDEDKEY = 0x0001
const KEYEVENTF_KEYUP = 0x0002

let apis = null

function ensureWin32() {
  if (process.platform !== 'win32') {
    throw new Error(
      'These POC scripts only run on Windows (need user32/kernel32).',
    )
  }
}

function loadApis() {
  if (apis) return apis
  ensureWin32()

  const user32 = koffi.load('user32.dll')
  const kernel32 = koffi.load('kernel32.dll')

  const WNDENUMPROC = koffi.proto(
    'bool __stdcall WNDENUMPROC(void *hwnd, intptr_t lParam)',
  )

  apis = {
    EnumWindows: user32.func(
      'bool __stdcall EnumWindows(WNDENUMPROC *lpEnumFunc, intptr_t lParam)',
    ),
    IsWindowVisible: user32.func('bool __stdcall IsWindowVisible(void *hWnd)'),
    GetWindowTextLengthW: user32.func(
      'int __stdcall GetWindowTextLengthW(void *hWnd)',
    ),
    GetWindowTextW: user32.func(
      'int __stdcall GetWindowTextW(void *hWnd, void *lpString, int nMaxCount)',
    ),
    GetWindowThreadProcessId: user32.func(
      'uint __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *lpdwProcessId)',
    ),
    GetForegroundWindow: user32.func('void * __stdcall GetForegroundWindow()'),
    PostMessageW: user32.func(
      'bool __stdcall PostMessageW(void *hWnd, uint Msg, uintptr_t wParam, uintptr_t lParam)',
    ),
    SendMessageW: user32.func(
      'intptr_t __stdcall SendMessageW(void *hWnd, uint Msg, uintptr_t wParam, uintptr_t lParam)',
    ),
    keybd_event: user32.func(
      'void __stdcall keybd_event(uint8_t bVk, uint8_t bScan, uint dwFlags, uintptr_t dwExtraInfo)',
    ),
    OpenProcess: kernel32.func(
      'void * __stdcall OpenProcess(uint dwDesiredAccess, bool bInheritHandle, uint dwProcessId)',
    ),
    CloseHandle: kernel32.func('bool __stdcall CloseHandle(void *hObject)'),
    QueryFullProcessImageNameW: kernel32.func(
      'bool __stdcall QueryFullProcessImageNameW(void *hProcess, uint dwFlags, void *lpExeName, _Inout_ uint32 *lpdwSize)',
    ),
    WNDENUMPROC,
  }
  return apis
}

function readWideString(getLength, getText, hwnd) {
  const api = loadApis()
  const len = getLength(hwnd)
  if (len <= 0) return ''
  const buf = Buffer.alloc((len + 1) * 2)
  getText(hwnd, buf, len + 1)
  return buf.toString('utf16le').replace(/\0+$/, '')
}

export function getWindowTitle(hwnd) {
  const api = loadApis()
  return readWideString(api.GetWindowTextLengthW, api.GetWindowTextW, hwnd)
}

export function getWindowPid(hwnd) {
  const api = loadApis()
  const pidBuf = Buffer.alloc(4)
  api.GetWindowThreadProcessId(hwnd, pidBuf)
  return pidBuf.readUInt32LE(0)
}

export function getProcessImageName(pid) {
  const api = loadApis()
  const handle = api.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
  if (!handle || handle === 0n || handle === null) return ''
  try {
    const sizeBuf = Buffer.alloc(4)
    sizeBuf.writeUInt32LE(260, 0)
    const nameBuf = Buffer.alloc(260 * 2)
    const ok = api.QueryFullProcessImageNameW(handle, 0, nameBuf, sizeBuf)
    if (!ok) return ''
    const chars = sizeBuf.readUInt32LE(0)
    return nameBuf.toString('utf16le', 0, chars * 2)
  } finally {
    api.CloseHandle(handle)
  }
}

export function processBaseName(imagePath) {
  if (!imagePath) return ''
  return path.win32.basename(imagePath)
}

/**
 * Enumerate visible top-level windows.
 * @returns {Array<{ hwnd: number, hwndHex: string, pid: number, title: string, exe: string, exeBase: string }>}
 */
export function listWindows({ includeHidden = false } = {}) {
  const api = loadApis()
  const windows = []

  const callback = koffi.register((hwnd) => {
    const visible = api.IsWindowVisible(hwnd)
    if (!includeHidden && !visible) return true
    const title = getWindowTitle(hwnd)
    if (!title.trim()) return true
    const pid = getWindowPid(hwnd)
    const exe = getProcessImageName(pid)
    const hwndNum = Number(koffi.address(hwnd))
    windows.push({
      hwnd: hwndNum,
      hwndHex: `0x${hwndNum.toString(16)}`,
      pid,
      title,
      exe,
      exeBase: processBaseName(exe),
      visible: Boolean(visible),
    })
    return true
  }, koffi.pointer(api.WNDENUMPROC))

  try {
    api.EnumWindows(callback, 0)
  } finally {
    koffi.unregister(callback)
  }

  return windows.sort((a, b) => a.pid - b.pid || a.title.localeCompare(b.title))
}

export function hwndFromNumber(n) {
  // koffi accepts number/bigint as void* on Win64 for these APIs.
  return n
}

export function findWindows({ pid, title, process: processName, hwnd } = {}) {
  const all = listWindows({ includeHidden: false })
  return all.filter((w) => {
    if (hwnd != null && w.hwnd !== Number(hwnd)) return false
    if (pid != null && w.pid !== Number(pid)) return false
    if (title) {
      const t = String(title).toLowerCase()
      if (!w.title.toLowerCase().includes(t)) return false
    }
    if (processName) {
      const p = String(processName).toLowerCase().replace(/\.exe$/i, '')
      const base = w.exeBase.toLowerCase().replace(/\.exe$/i, '')
      if (!base.includes(p)) return false
    }
    return true
  })
}

export function getForegroundHwnd() {
  const api = loadApis()
  const hwnd = api.GetForegroundWindow()
  return Number(koffi.address(hwnd))
}

export function postKeyMessage(hwnd, msg, vk, lParam) {
  const api = loadApis()
  return Boolean(api.PostMessageW(hwndFromNumber(hwnd), msg, vk, lParam))
}

export function sendKeyMessage(hwnd, msg, vk, lParam) {
  const api = loadApis()
  return api.SendMessageW(hwndFromNumber(hwnd), msg, vk, lParam)
}

export function keybdEvent(vk, scan, { up = false, extended = false } = {}) {
  const api = loadApis()
  let flags = 0
  if (extended) flags |= KEYEVENTF_EXTENDEDKEY
  if (up) flags |= KEYEVENTF_KEYUP
  api.keybd_event(vk & 0xff, scan & 0xff, flags, 0)
}

/** Resolve koffi from the repo root when run via bun/node from this folder. */
export function assertKoffiResolvable() {
  try {
    require.resolve('koffi')
  } catch {
    throw new Error(
      'Cannot resolve koffi. From repo root run: bun install && bun poc/background-input/<script>.mjs ...',
    )
  }
}
