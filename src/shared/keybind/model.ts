/** Canonical keybind: lowercase tokens joined by `+`, e.g. `ctrl+shift+a`, `mb4`, `ctrl+mb5`. */

export type KeybindParts = {
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  /** Primary key or mouse button token, e.g. `a`, `pagedown`, `mb4`. */
  key: string
}

const MODIFIER_TOKENS = new Set([
  "ctrl",
  "control",
  "alt",
  "option",
  "shift",
  "meta",
  "cmd",
  "command",
  "win",
  "super",
  "commandorcontrol",
])

const CODE_TO_TOKEN: Record<string, string> = {
  Space: "space",
  Enter: "enter",
  Escape: "esc",
  Backspace: "backspace",
  Tab: "tab",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Home: "home",
  End: "end",
  PageUp: "pageup",
  PageDown: "pagedown",
  Insert: "insert",
  Delete: "delete",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backquote: "`",
}

const TOKEN_ALIASES: Record<string, string> = {
  control: "ctrl",
  option: "alt",
  cmd: "meta",
  command: "meta",
  win: "meta",
  super: "meta",
  commandorcontrol: "ctrl",
  escape: "esc",
  return: "enter",
  pgup: "pageup",
  pgdn: "pagedown",
  "page up": "pageup",
  "page down": "pagedown",
  del: "delete",
  lbutton: "mb1",
  rbutton: "mb2",
  mbutton: "mb3",
  middle: "mb3",
  xbutton1: "mb4",
  xbutton2: "mb5",
  x1: "mb4",
  x2: "mb5",
}

/** DOM button index → token (matches common script MB naming). */
const MOUSE_BUTTON_TOKENS = ["mb1", "mb3", "mb2", "mb4", "mb5"] as const

function canonicalizeToken(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  return TOKEN_ALIASES[trimmed] ?? trimmed
}

export function isModifierToken(token: string): boolean {
  const canonical = canonicalizeToken(token)
  return (
    canonical === "ctrl" ||
    canonical === "alt" ||
    canonical === "shift" ||
    canonical === "meta"
  )
}

export function isMouseToken(token: string): boolean {
  return /^mb[1-5]$/.test(canonicalizeToken(token))
}

export function parseKeybind(input: string): KeybindParts | null {
  const parts = input
    .trim()
    .toLowerCase()
    .split("+")
    .map((part) => canonicalizeToken(part))
    .filter(Boolean)

  if (parts.length === 0) return null

  let ctrl = false
  let alt = false
  let shift = false
  let meta = false
  let key: string | null = null

  for (const part of parts) {
    if (part === "ctrl") {
      ctrl = true
      continue
    }
    if (part === "alt") {
      alt = true
      continue
    }
    if (part === "shift") {
      shift = true
      continue
    }
    if (part === "meta") {
      meta = true
      continue
    }
    if (MODIFIER_TOKENS.has(part)) continue
    key = part
  }

  // Allow modifier-only binds (e.g. `ctrl`).
  if (!key) {
    if (ctrl || alt || shift || meta) {
      key = ctrl
        ? "ctrl"
        : alt
          ? "alt"
          : shift
            ? "shift"
            : "meta"
      return {
        ctrl: key === "ctrl" ? false : ctrl,
        alt: key === "alt" ? false : alt,
        shift: key === "shift" ? false : shift,
        meta: key === "meta" ? false : meta,
        key,
      }
    }
    return null
  }

  return { ctrl, alt, shift, meta, key }
}

export function formatKeybind(parts: KeybindParts): string {
  const tokens: string[] = []
  if (parts.ctrl) tokens.push("ctrl")
  if (parts.alt) tokens.push("alt")
  if (parts.shift) tokens.push("shift")
  if (parts.meta) tokens.push("meta")
  tokens.push(canonicalizeToken(parts.key))
  return tokens.join("+")
}

export function normalizeKeybind(input: string): string {
  const parsed = parseKeybind(input)
  if (!parsed) return input.trim().toLowerCase()
  return formatKeybind(parsed)
}

export function formatKeybindLabel(hotkey: string): string {
  return hotkey
    .split("+")
    .filter(Boolean)
    .map((part) => {
      const lower = canonicalizeToken(part)
      if (lower === "ctrl") return "Ctrl"
      if (lower === "alt") return "Alt"
      if (lower === "shift") return "Shift"
      if (lower === "meta") return "Meta"
      if (lower === "pagedown") return "Page Down"
      if (lower === "pageup") return "Page Up"
      if (/^mb[1-5]$/.test(lower)) return lower.toUpperCase()
      if (lower.length === 1) return lower.toUpperCase()
      if (/^f\d{1,2}$/.test(lower)) return lower.toUpperCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join("+")
}

export function tokenFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (event.repeat) return null

  const code = event.code
  if (code === "ControlLeft" || code === "ControlRight") return "ctrl"
  if (code === "AltLeft" || code === "AltRight") return "alt"
  if (code === "ShiftLeft" || code === "ShiftRight") return "shift"
  if (code === "MetaLeft" || code === "MetaRight") return "meta"

  if (code.startsWith("Key") && code.length === 4) {
    return code.slice(3).toLowerCase()
  }
  if (code.startsWith("Digit") && code.length === 6) {
    return code.slice(5)
  }
  if (code.startsWith("Numpad") && code.length > 6) {
    return `numpad${code.slice(6).toLowerCase()}`
  }
  if (/^F\d{1,2}$/.test(event.key)) {
    return event.key.toLowerCase()
  }

  const mapped = CODE_TO_TOKEN[code]
  if (mapped) return mapped

  if (event.key.length === 1) return event.key.toLowerCase()
  return event.key.toLowerCase()
}

export function tokenFromMouseEvent(event: MouseEvent): string | null {
  return MOUSE_BUTTON_TOKENS[event.button] ?? null
}

export function keybindFromKeyboardEvent(event: KeyboardEvent): KeybindParts | null {
  const token = tokenFromKeyboardEvent(event)
  if (!token) return null

  if (isModifierToken(token)) {
    // Modifier-only commits are handled on keyup by the recorder hook.
    return null
  }

  return {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
    key: token,
  }
}

export function keybindFromMouseEvent(event: MouseEvent): KeybindParts | null {
  const token = tokenFromMouseEvent(event)
  if (!token) return null
  return {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
    key: token,
  }
}

export function keybindFromModifierKeyup(event: KeyboardEvent): KeybindParts | null {
  const token = tokenFromKeyboardEvent(event)
  if (!token || !isModifierToken(token)) return null

  // Only commit a lone modifier when no other modifiers remain held.
  const stillHeld =
    (event.ctrlKey && token !== "ctrl") ||
    (event.altKey && token !== "alt") ||
    (event.shiftKey && token !== "shift") ||
    (event.metaKey && token !== "meta")

  if (stillHeld) return null

  return {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: token,
  }
}
