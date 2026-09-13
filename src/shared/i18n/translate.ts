import { en, type MessageCatalog } from "@/shared/i18n/locales/en"
import { zhCN } from "@/shared/i18n/locales/zh-CN"
import { zhTW } from "@/shared/i18n/locales/zh-TW"
import type { Locale } from "@/shared/i18n/types"

export type MessageKey = {
  [G in keyof MessageCatalog]: `${Extract<G, string>}.${Extract<keyof MessageCatalog[G], string>}`
}[keyof MessageCatalog]

const CATALOGS: Record<Locale, MessageCatalog> = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
}

export function getCatalog(locale: Locale): MessageCatalog {
  return CATALOGS[locale] ?? en
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const [group, leaf] = key.split(".", 2) as [
    keyof MessageCatalog,
    string,
  ]
  const catalog = getCatalog(locale)
  const fallback = en[group] as Record<string, string> | undefined
  const bucket = catalog[group] as Record<string, string> | undefined
  let text = bucket?.[leaf] ?? fallback?.[leaf] ?? key

  // Simple plural: use `key_plural` when count !== 1 and that entry exists.
  if (vars && typeof vars.count === "number" && vars.count !== 1) {
    const pluralLeaf = `${leaf}_plural`
    const plural =
      bucket?.[pluralLeaf] ?? fallback?.[pluralLeaf]
    if (plural) text = plural
  }

  if (!vars) return text
  return Object.entries(vars).reduce(
    (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
    text,
  )
}
