/**
 * Key name → { vk, scan, extended } matching electron/main/runner/win-input.ts
 * so POC results are comparable to the real script runner.
 */

const LETTER_SCANS = {
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

const DIGIT_SCANS = {
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

const NAMED_KEYS = {
  backspace: { vk: 0x08, scan: 0x0e, extended: false },
  tab: { vk: 0x09, scan: 0x0f, extended: false },
  enter: { vk: 0x0d, scan: 0x1c, extended: false },
  return: { vk: 0x0d, scan: 0x1c, extended: false },
  escape: { vk: 0x1b, scan: 0x01, extended: false },
  esc: { vk: 0x1b, scan: 0x01, extended: false },
  space: { vk: 0x20, scan: 0x39, extended: false },
  pageup: { vk: 0x21, scan: 0x49, extended: true },
  pagedown: { vk: 0x22, scan: 0x51, extended: true },
  end: { vk: 0x23, scan: 0x4f, extended: true },
  home: { vk: 0x24, scan: 0x47, extended: true },
  left: { vk: 0x25, scan: 0x4b, extended: true },
  up: { vk: 0x26, scan: 0x48, extended: true },
  right: { vk: 0x27, scan: 0x4d, extended: true },
  down: { vk: 0x28, scan: 0x50, extended: true },
  insert: { vk: 0x2d, scan: 0x52, extended: true },
  delete: { vk: 0x2e, scan: 0x53, extended: true },
  shift: { vk: 0xa0, scan: 0x2a, extended: false },
  ctrl: { vk: 0xa2, scan: 0x1d, extended: false },
  alt: { vk: 0xa4, scan: 0x38, extended: false },
}

function fKey(index) {
  if (index < 1 || index > 12) return null
  const vk = 0x70 + (index - 1)
  let scan = 0
  if (index <= 10) scan = 0x3a + index
  else if (index === 11) scan = 0x57
  else scan = 0x58
  return { vk, scan, extended: false }
}

export function resolveKey(name) {
  const key = String(name ?? '')
    .trim()
    .toLowerCase()
  if (!key) return null
  if (NAMED_KEYS[key]) return { ...NAMED_KEYS[key] }
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

/** Build WM_KEYDOWN / WM_KEYUP lParam with hardware scan code. */
export function keyLParam(scan, extended, { up = false, repeat = 1 } = {}) {
  let lp = (repeat & 0xffff) | ((scan & 0xff) << 16)
  if (extended) lp |= 1 << 24
  if (up) {
    lp |= 1 << 30 // previous state
    lp |= 1 << 31 // transition
  }
  return lp >>> 0
}
