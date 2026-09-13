/**
 * Win32 keyboard/mouse injection matching the Python runner
 * (keyboard → keybd_event with hardware scan codes).
 *
 * uiohook's post path uses VK-only SendInput (wScan=0), which many games ignore.
 */
import koffi from 'koffi'

const KEYEVENTF_EXTENDEDKEY = 0x0001
const KEYEVENTF_KEYUP = 0x0002

const INPUT_MOUSE = 0
const MOUSEEVENTF_MOVE = 0x0001

const MAPVK_VK_TO_VSC_EX = 4

export type WinKey = {
  vk: number
  /** Hardware scan code (low byte). */
  scan: number
  extended: boolean
}

/** US layout scan codes used by the Python `keyboard` package. */
const LETTER_SCANS: Record<string, number> = {
  a: 0x1e,
  b: 0x30,
  c: 0x2e,
  d: 0x20,
  e: 0x12,
  f: 0x21,
  g: 0x22,
  h: 0x23,
  i: 0x17,
  j: 0x24,
  k: 0x25,
  l: 0x26,
  m: 0x32,
  n: 0x31,
  o: 0x18,
  p: 0x19,
  q: 0x10,
  r: 0x13,
  s: 0x1f,
  t: 0x14,
  u: 0x16,
  v: 0x2f,
  w: 0x11,
  x: 0x2d,
  y: 0x15,
  z: 0x2c,
}

const DIGIT_SCANS: Record<string, number> = {
  '1': 0x02,
  '2': 0x03,
  '3': 0x04,
  '4': 0x05,
  '5': 0x06,
  '6': 0x07,
  '7': 0x08,
  '8': 0x09,
  '9': 0x0a,
  '0': 0x0b,
}

const NAMED_KEYS: Record<string, WinKey> = {
  backspace: { vk: 0x08, scan: 0x0e, extended: false },
  tab: { vk: 0x09, scan: 0x0f, extended: false },
  enter: { vk: 0x0d, scan: 0x1c, extended: false },
  return: { vk: 0x0d, scan: 0x1c, extended: false },
  escape: { vk: 0x1b, scan: 0x01, extended: false },
  esc: { vk: 0x1b, scan: 0x01, extended: false },
  space: { vk: 0x20, scan: 0x39, extended: false },
  pageup: { vk: 0x21, scan: 0x49, extended: true },
  'page up': { vk: 0x21, scan: 0x49, extended: true },
  pgup: { vk: 0x21, scan: 0x49, extended: true },
  pagedown: { vk: 0x22, scan: 0x51, extended: true },
  'page down': { vk: 0x22, scan: 0x51, extended: true },
  pgdn: { vk: 0x22, scan: 0x51, extended: true },
  end: { vk: 0x23, scan: 0x4f, extended: true },
  home: { vk: 0x24, scan: 0x47, extended: true },
  left: { vk: 0x25, scan: 0x4b, extended: true },
  up: { vk: 0x26, scan: 0x48, extended: true },
  right: { vk: 0x27, scan: 0x4d, extended: true },
  down: { vk: 0x28, scan: 0x50, extended: true },
  insert: { vk: 0x2d, scan: 0x52, extended: true },
  delete: { vk: 0x2e, scan: 0x53, extended: true },
  del: { vk: 0x2e, scan: 0x53, extended: true },
  shift: { vk: 0xa0, scan: 0x2a, extended: false },
  lshift: { vk: 0xa0, scan: 0x2a, extended: false },
  rshift: { vk: 0xa1, scan: 0x36, extended: false },
  ctrl: { vk: 0xa2, scan: 0x1d, extended: false },
  control: { vk: 0xa2, scan: 0x1d, extended: false },
  lctrl: { vk: 0xa2, scan: 0x1d, extended: false },
  rctrl: { vk: 0xa3, scan: 0x1d, extended: true },
  alt: { vk: 0xa4, scan: 0x38, extended: false },
  lalt: { vk: 0xa4, scan: 0x38, extended: false },
  ralt: { vk: 0xa5, scan: 0x38, extended: true },
  meta: { vk: 0x5b, scan: 0x5b, extended: true },
  win: { vk: 0x5b, scan: 0x5b, extended: true },
  lwin: { vk: 0x5b, scan: 0x5b, extended: true },
  rwin: { vk: 0x5c, scan: 0x5c, extended: true },
}

type User32InputApi = {
  keybd_event: (vk: number, scan: number, flags: number, extra: number) => void
  MapVirtualKeyW: (code: number, mapType: number) => number
  SendInput: (nInputs: number, pInputs: Buffer, cbSize: number) => number
  mouse_event: (
    flags: number,
    dx: number,
    dy: number,
    data: number,
    extra: number,
  ) => void
}

let api: User32InputApi | null = null
let inputSize = 0

function getApi(): User32InputApi {
  if (api) return api
  if (process.platform !== 'win32') {
    throw new Error('Keyboard/mouse injection is only supported on Windows')
  }
  const lib = koffi.load('user32.dll')
  api = {
    keybd_event: lib.func(
      'void __stdcall keybd_event(uint8_t bVk, uint8_t bScan, uint dwFlags, uintptr_t dwExtraInfo)',
    ) as User32InputApi['keybd_event'],
    MapVirtualKeyW: lib.func(
      'uint __stdcall MapVirtualKeyW(uint uCode, uint uMapType)',
    ) as User32InputApi['MapVirtualKeyW'],
    SendInput: lib.func(
      'uint __stdcall SendInput(uint cInputs, void *pInputs, int cbSize)',
    ) as User32InputApi['SendInput'],
    mouse_event: lib.func(
      'void __stdcall mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uintptr_t dwExtraInfo)',
    ) as User32InputApi['mouse_event'],
  }
  // INPUT is 40 bytes on x64 (DWORD type + padding + union)
  inputSize = process.arch === 'ia32' ? 28 : 40
  return api
}

function fKey(index: number): WinKey | null {
  if (index < 1 || index > 24) return null
  const vk = 0x70 + (index - 1)
  let scan = 0
  if (index <= 10) scan = 0x3a + index
  else if (index === 11) scan = 0x57
  else if (index === 12) scan = 0x58
  else {
    const mapped = getApi().MapVirtualKeyW(vk, MAPVK_VK_TO_VSC_EX)
    scan = mapped & 0xff
  }
  return { vk, scan, extended: false }
}

export function resolveWinKey(name: string): WinKey | null {
  const raw = String(name ?? '').trim()
  if (!raw) return null
  const key = raw.toLowerCase()

  if (NAMED_KEYS[key]) return NAMED_KEYS[key]

  if (key.length === 1 && LETTER_SCANS[key]) {
    return {
      vk: key.toUpperCase().charCodeAt(0),
      scan: LETTER_SCANS[key],
      extended: false,
    }
  }

  if (key.length === 1 && DIGIT_SCANS[key]) {
    return {
      vk: 0x30 + Number(key),
      scan: DIGIT_SCANS[key],
      extended: false,
    }
  }

  const fMatch = /^f(\d{1,2})$/.exec(key)
  if (fMatch) return fKey(Number(fMatch[1]))

  return null
}

function keyFlags(extended: boolean, up: boolean): number {
  let flags = 0
  if (extended) flags |= KEYEVENTF_EXTENDEDKEY
  if (up) flags |= KEYEVENTF_KEYUP
  return flags
}

/** Match Python keyboard._winkeyboard: keybd_event(vk, scan, flags, 0). */
export function keyDown(name: string): boolean {
  const key = resolveWinKey(name)
  if (!key) {
    console.warn(`[runner] Unknown key: ${name}`)
    return false
  }
  getApi().keybd_event(key.vk, key.scan & 0xff, keyFlags(key.extended, false), 0)
  return true
}

export function keyUp(name: string): boolean {
  const key = resolveWinKey(name)
  if (!key) return false
  getApi().keybd_event(key.vk, key.scan & 0xff, keyFlags(key.extended, true), 0)
  return true
}

export function keyTap(name: string): boolean {
  if (!keyDown(name)) return false
  keyUp(name)
  return true
}

/** Relative mouse move via SendInput (Python runner.mouse.send_mouse_relative). */
export function sendMouseRelative(dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return
  const user32 = getApi()
  const buf = Buffer.alloc(inputSize)
  buf.writeUInt32LE(INPUT_MOUSE, 0)
  const base = process.arch === 'ia32' ? 4 : 8
  buf.writeInt32LE(Math.round(dx), base)
  buf.writeInt32LE(Math.round(dy), base + 4)
  buf.writeUInt32LE(0, base + 8)
  buf.writeUInt32LE(MOUSEEVENTF_MOVE, base + 12)
  const sent = user32.SendInput(1, buf, inputSize)
  if (sent !== 1) {
    user32.mouse_event(MOUSEEVENTF_MOVE, Math.round(dx), Math.round(dy), 0, 0)
  }
}
