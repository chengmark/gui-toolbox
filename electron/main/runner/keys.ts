import { UiohookKey } from 'uiohook-napi'

/** Aliases aligned with Python runner.utils.KEY_ALIASES (+ uiohook listen codes). */
const KEY_ALIASES: Record<string, number> = {
  backspace: UiohookKey.Backspace,
  tab: UiohookKey.Tab,
  enter: UiohookKey.Enter,
  return: UiohookKey.Enter,
  escape: UiohookKey.Escape,
  esc: UiohookKey.Escape,
  space: UiohookKey.Space,
  pageup: UiohookKey.PageUp,
  'page up': UiohookKey.PageUp,
  pagedown: UiohookKey.PageDown,
  'page down': UiohookKey.PageDown,
  pgup: UiohookKey.PageUp,
  pgdn: UiohookKey.PageDown,
  end: UiohookKey.End,
  home: UiohookKey.Home,
  left: UiohookKey.ArrowLeft,
  up: UiohookKey.ArrowUp,
  right: UiohookKey.ArrowRight,
  down: UiohookKey.ArrowDown,
  insert: UiohookKey.Insert,
  delete: UiohookKey.Delete,
  del: UiohookKey.Delete,
  ctrl: UiohookKey.Ctrl,
  control: UiohookKey.Ctrl,
  shift: UiohookKey.Shift,
  alt: UiohookKey.Alt,
  meta: UiohookKey.Meta,
  win: UiohookKey.Meta,
  ...Object.fromEntries(
    '0123456789abcdefghijklmnopqrstuvwxyz'.split('').map((ch) => [
      ch,
      UiohookKey[ch.toUpperCase() as keyof typeof UiohookKey] as number,
    ]),
  ),
  ...Object.fromEntries(
    Array.from({ length: 24 }, (_, i) => [
      `f${i + 1}`,
      UiohookKey[`F${i + 1}` as keyof typeof UiohookKey] as number,
    ]),
  ),
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [
      `numpad${i}`,
      UiohookKey[`Numpad${i}` as keyof typeof UiohookKey] as number,
    ]),
  ),
  numpadmultiply: UiohookKey.NumpadMultiply,
  numpadadd: UiohookKey.NumpadAdd,
  numpadsubtract: UiohookKey.NumpadSubtract,
  numpaddecimal: UiohookKey.NumpadDecimal,
  numpaddivide: UiohookKey.NumpadDivide,
  numpadenter: UiohookKey.NumpadEnter,
}

/** Map script.json key names like Python normalize_key_name. */
export function normalizeKeyName(k: string): string {
  const raw = String(k ?? '').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  if (lower === 'control') return 'ctrl'
  if (lower === 'escape') return 'esc'
  if (lower === 'return') return 'enter'
  if (lower === 'pageup' || lower === 'pgup') return 'page up'
  if (lower === 'pagedown' || lower === 'pgdn') return 'page down'
  if (lower.startsWith('numpad') && lower.length > 6) return lower
  if (lower.startsWith('f') && /^\d+$/.test(lower.slice(1))) return lower
  if (raw.length === 1) return lower
  return lower
}

/** uiohook keycode for hotkey matching (listen path only). */
export function resolveKeyCode(name: string): number | null {
  const key = normalizeKeyName(name)
  if (!key) return null
  // Prefer exact alias including spaced names
  if (KEY_ALIASES[key] != null) return KEY_ALIASES[key]
  const compact = key.replace(/\s+/g, '')
  return KEY_ALIASES[compact] ?? null
}

/** Expand args like "1111" into ["1","1","1","1"] (KeyPress only). */
export function expandKeySequence(keyText: string): string[] {
  const raw = String(keyText ?? '').trim()
  if (!raw) return []

  const lower = raw.toLowerCase()
  if (
    lower === 'ctrl' ||
    lower === 'control' ||
    lower === 'shift' ||
    lower === 'alt' ||
    lower === 'esc' ||
    lower === 'escape' ||
    lower === 'home' ||
    lower === 'end' ||
    lower === 'pgup' ||
    lower === 'pgdn' ||
    lower === 'pageup' ||
    lower === 'pagedown' ||
    lower === 'page up' ||
    lower === 'page down' ||
    lower === 'space' ||
    lower === 'enter' ||
    lower === 'return'
  ) {
    return [normalizeKeyName(raw)]
  }
  if (lower.startsWith('f') && /^\d+$/.test(lower.slice(1))) return [lower]
  if (raw.length === 1) return [normalizeKeyName(raw)]
  if (Array.from(raw).every((ch) => ch.length === 1)) {
    return Array.from(raw).map((ch) => normalizeKeyName(ch))
  }
  return [normalizeKeyName(raw)]
}

export function normalizeHotkeyToken(input: string): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
}
