import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react"
import { useAppConfig } from "@/domains/persistence"
import { translate, type MessageKey } from "@/shared/i18n/translate"
import { detectBrowserLocale, isLocale, type Locale } from "@/shared/i18n/types"

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

/** null / missing → follow OS / browser language preference. */
function resolveLocale(stored: Locale | null): Locale {
  if (stored && isLocale(stored)) return stored
  return detectBrowserLocale()
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { config, setLocale: persistLocale } = useAppConfig()
  const locale = resolveLocale(config.common.locale)

  const setLocale = useCallback(
    (next: Locale) => {
      void persistLocale(next)
    },
    [persistLocale],
  )

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider")
  }
  return ctx
}
