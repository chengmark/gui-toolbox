import koffi from 'koffi'
import { sendMouseRelative } from './win-input'

const MOUSEEVENTF_LEFTDOWN = 0x0002
const MOUSEEVENTF_LEFTUP = 0x0004
const MOUSEEVENTF_RIGHTDOWN = 0x0008
const MOUSEEVENTF_RIGHTUP = 0x0010
const MOUSEEVENTF_MIDDLEDOWN = 0x0020
const MOUSEEVENTF_MIDDLEUP = 0x0040

const BUTTON_FLAGS: Record<string, [number, number]> = {
  left: [MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP],
  right: [MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP],
  middle: [MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP],
}

type User32Api = {
  GetCursorPos: (pt: Buffer) => number
  SetCursorPos: (x: number, y: number) => number
  mouse_event: (
    flags: number,
    dx: number,
    dy: number,
    data: number,
    extra: number,
  ) => void
}

let user32: User32Api | null = null

function getUser32(): User32Api {
  if (user32) return user32
  if (process.platform !== 'win32') {
    throw new Error('Mouse commands are only supported on Windows')
  }
  const lib = koffi.load('user32.dll')
  user32 = {
    GetCursorPos: lib.func('bool __stdcall GetCursorPos(_Out_ void *lpPoint)') as User32Api['GetCursorPos'],
    SetCursorPos: lib.func('bool __stdcall SetCursorPos(int X, int Y)') as User32Api['SetCursorPos'],
    mouse_event: lib.func(
      'void __stdcall mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, uintptr_t dwExtraInfo)',
    ) as User32Api['mouse_event'],
  }
  return user32
}

export function normalizeMouseButton(button: unknown): string {
  const name = String(button ?? 'left')
    .trim()
    .toLowerCase()
  if (name === 'mid' || name === 'wheel') return 'middle'
  if (name === 'right' || name === 'middle') return name
  return 'left'
}

export function getCursorPos(): { x: number; y: number } {
  const api = getUser32()
  const buf = Buffer.alloc(8)
  api.GetCursorPos(buf)
  return { x: buf.readInt32LE(0), y: buf.readInt32LE(4) }
}

export function setCursorPos(x: number, y: number): void {
  getUser32().SetCursorPos(Math.round(x), Math.round(y))
}

export function mouseClick(button: string): void {
  const [down, up] = BUTTON_FLAGS[normalizeMouseButton(button)] ?? BUTTON_FLAGS.left
  const api = getUser32()
  api.mouse_event(down, 0, 0, 0, 0)
  api.mouse_event(up, 0, 0, 0, 0)
}

export function mouseMoveRelative(dx: number, dy: number): void {
  sendMouseRelative(dx, dy)
}
