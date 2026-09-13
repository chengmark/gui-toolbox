export type TranslatorTask = "idle" | "pending" | "converting"

export type TranslatorKeybindAction = "copyTrigger" | "toggle" | "fieldConvert"

export type TranslatorSettings = {
  copyTrigger: string
  toggle: string
  fieldConvert: string
}

export type TranslatorStatus = {
  enabled: boolean
  task: TranslatorTask
  running: boolean
  settings: TranslatorSettings
  error: string | null
  lastMessage: string | null
}

export const DEFAULT_TRANSLATOR_STATUS: TranslatorStatus = {
  enabled: false,
  task: "idle",
  running: false,
  settings: {
    copyTrigger: "ctrl+c",
    toggle: "delete",
    fieldConvert: "pagedown",
  },
  error: null,
  lastMessage: null,
}

export const KEYBIND_ACTIONS: ReadonlyArray<{
  id: TranslatorKeybindAction
}> = [
  { id: "copyTrigger" },
  { id: "fieldConvert" },
  { id: "toggle" },
]

/** @deprecated Prefer translating badge keys in UI via useI18n. */
export function statusBadgeText(status: Pick<TranslatorStatus, "enabled" | "task">): string {
  if (!status.enabled) return "Disabled"
  if (status.task === "pending") return "Enabled · Pending"
  if (status.task === "converting") return "Enabled · Converting"
  return "Enabled · Idle"
}

export function statusBadgeTone(
  status: Pick<TranslatorStatus, "enabled" | "task">,
): "success" | "warning" | "info" | "muted" {
  if (!status.enabled) return "muted"
  if (status.task === "pending") return "warning"
  if (status.task === "converting") return "info"
  return "success"
}
