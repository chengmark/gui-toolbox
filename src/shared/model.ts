import type { MessageKey } from "@/shared/i18n"

export type AppTab = "scripts" | "translator" | "keybinds" | "settings"

export const APP_TABS = [
  { id: "scripts", labelKey: "nav.scripts" },
  { id: "translator", labelKey: "nav.translator" },
  { id: "keybinds", labelKey: "nav.keybinds" },
  { id: "settings", labelKey: "nav.settings" },
] as const satisfies ReadonlyArray<{ id: AppTab; labelKey: MessageKey }>
