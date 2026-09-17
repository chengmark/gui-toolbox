export type { AppTab } from "@/shared/model"
export { APP_TABS } from "@/shared/model"
export { AppShell } from "@/shared/components/AppShell"
export { ViewTransition } from "@/shared/components/ViewTransition"
export { PageHeader, PlaceholderPage } from "@/shared/components/PageFrame"
export { InlineEditCell } from "@/shared/components/InlineEditCell"
export { useDebouncedCallback } from "@/shared/hooks/useDebouncedCallback"
export {
  KeybindRecorder,
  useKeybindRecording,
  formatKeybind,
  formatKeybindLabel,
  normalizeKeybind,
  parseKeybind,
} from "@/shared/keybind"
export type { KeybindParts, KeybindRecorderProps } from "@/shared/keybind"
export {
  I18nProvider,
  useI18n,
  LOCALE_OPTIONS,
  LOCALES,
} from "@/shared/i18n"
export type { Locale, MessageKey } from "@/shared/i18n"

