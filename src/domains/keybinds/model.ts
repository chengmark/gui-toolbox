export type KeybindEntry = {
  id: string
  bind: string
  script: string
  enabled: boolean
  label: string
}

export type KeybindJsScript = {
  filename: string
}

export type KeybindsState = {
  entries: KeybindEntry[]
  scripts: KeybindJsScript[]
  filePath: string
  error: string | null
  lastMessage: string | null
}

export const EMPTY_KEYBINDS_STATE: KeybindsState = {
  entries: [],
  scripts: [],
  filePath: "data/keybinds/keybind.json",
  error: null,
  lastMessage: null,
}

export function createKeybindEntry(): KeybindEntry {
  return {
    id: `kb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    bind: "",
    script: "",
    enabled: true,
    label: "",
  }
}
