export type { Locale } from "@/shared/i18n/types"
export {
  LOCALES,
  LOCALE_OPTIONS,
  detectBrowserLocale,
  isLocale,
} from "@/shared/i18n/types"
export type { MessageCatalog } from "@/shared/i18n/locales/en"
export type { MessageKey } from "@/shared/i18n/translate"
export { translate, getCatalog } from "@/shared/i18n/translate"
export { I18nProvider, useI18n } from "@/shared/i18n/I18nProvider"
