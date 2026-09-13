export type {
  TranslatorTask,
  TranslatorKeybindAction,
  TranslatorSettings,
  TranslatorStatus,
} from "@/domains/translator/model"
export {
  DEFAULT_TRANSLATOR_STATUS,
  KEYBIND_ACTIONS,
  statusBadgeText,
  statusBadgeTone,
} from "@/domains/translator/model"
export { useTranslator } from "@/domains/translator/hooks/useTranslator"
export { TranslatorView } from "@/domains/translator/views/TranslatorView"
