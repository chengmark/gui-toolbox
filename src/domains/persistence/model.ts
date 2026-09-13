export type AppConfigLocale = "en" | "zh-CN" | "zh-TW"

export type AppConfig = {
  common: {
    locale: AppConfigLocale | null
  }
  scripts: {
    schemaVersion: 1
    scriptFavorites: string[]
  }
  translation: {
    enabled: boolean
  }
}

export type AppConfigPatch = {
  common?: Partial<AppConfig["common"]>
  scripts?: Partial<AppConfig["scripts"]>
  translation?: Partial<AppConfig["translation"]>
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  common: { locale: null },
  scripts: { schemaVersion: 1, scriptFavorites: [] },
  translation: { enabled: false },
}

const LEGACY_LOCALE_KEY = "yysls-toolbox.locale"
const LEGACY_FAVORITES_KEY = "yysls-toolbox.script-favorites"

function readLegacyLocale(): AppConfigLocale | null {
  try {
    const raw = localStorage.getItem(LEGACY_LOCALE_KEY)
    if (raw === "en" || raw === "zh-CN" || raw === "zh-TW") return raw
  } catch {
    // ignore
  }
  return null
}

function readLegacyFavorites(): string[] {
  try {
    const raw = localStorage.getItem(LEGACY_FAVORITES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0)
  } catch {
    return []
  }
}

function clearLegacyStorage(): void {
  try {
    localStorage.removeItem(LEGACY_LOCALE_KEY)
    localStorage.removeItem(LEGACY_FAVORITES_KEY)
  } catch {
    // ignore
  }
}

/** Merge file config with any leftover localStorage values, then persist once. */
export async function hydrateAppConfig(): Promise<AppConfig> {
  const api = window.appConfigApi
  if (!api) return structuredClone(DEFAULT_APP_CONFIG)

  let config = await api.get()
  const legacyLocale = readLegacyLocale()
  const legacyFavorites = readLegacyFavorites()

  const patch: AppConfigPatch = {}
  if (config.common.locale == null && legacyLocale) {
    patch.common = { locale: legacyLocale }
  }
  if (config.scripts.scriptFavorites.length === 0 && legacyFavorites.length > 0) {
    patch.scripts = { scriptFavorites: legacyFavorites }
  }

  if (patch.common || patch.scripts || patch.translation) {
    config = await api.patch(patch)
  }

  if (legacyLocale || legacyFavorites.length > 0) {
    clearLegacyStorage()
  }

  return config
}
