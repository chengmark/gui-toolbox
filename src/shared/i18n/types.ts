export const LOCALES = ["en", "zh-CN", "zh-TW"] as const

export type Locale = (typeof LOCALES)[number]

export const LOCALE_OPTIONS: ReadonlyArray<{
  id: Locale
  /** Native language name shown in the picker. */
  nativeLabel: string
}> = [
  { id: "en", nativeLabel: "English" },
  { id: "zh-CN", nativeLabel: "简体中文" },
  { id: "zh-TW", nativeLabel: "繁體中文" },
]

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en"
  const candidates = [navigator.language, ...(navigator.languages ?? [])]
  for (const raw of candidates) {
    const lower = raw.toLowerCase()
    if (lower === "zh-cn" || lower === "zh-hans" || lower.startsWith("zh-hans")) {
      return "zh-CN"
    }
    if (
      lower === "zh-tw" ||
      lower === "zh-hk" ||
      lower === "zh-mo" ||
      lower === "zh-hant" ||
      lower.startsWith("zh-hant")
    ) {
      return "zh-TW"
    }
    if (lower === "zh" || lower.startsWith("zh-")) {
      return "zh-CN"
    }
    if (lower === "en" || lower.startsWith("en-")) return "en"
  }
  return "en"
}
