import { app, dialog, type IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  getAppSettingsLocationFile,
  getConfigDir,
  getDefaultAppSettingsPath,
  getShippedAppSettingsDefaultPath,
  legacyAppSettingsPaths,
} from './paths'

export const APP_CONFIG_LOCALES = ['en', 'zh-CN', 'zh-TW'] as const
export type AppConfigLocale = (typeof APP_CONFIG_LOCALES)[number]

export type AppConfig = {
  common: {
    /** null = follow OS / browser language until the user picks one in Settings */
    locale: AppConfigLocale | null
  }
  scripts: {
    schemaVersion: 1
    scriptFavorites: string[]
  }
  translation: {
    enabled: boolean
  }
  updates: {
    /** Semver the user chose to skip; startup won't prompt for this version again. */
    skippedVersion: string | null
  }
}

export type AppConfigPatch = {
  common?: Partial<AppConfig['common']>
  scripts?: Partial<AppConfig['scripts']>
  translation?: Partial<AppConfig['translation']>
  updates?: Partial<AppConfig['updates']>
}

export type AppSettingsPathInfo = {
  filePath: string
  defaultPath: string
  isCustom: boolean
  configDir: string
  packaged: boolean
}

const DEFAULT_CONFIG: AppConfig = {
  common: { locale: null },
  scripts: { schemaVersion: 1, scriptFavorites: [] },
  translation: { enabled: false },
  updates: { skippedVersion: null },
}

function isLocale(value: unknown): value is AppConfigLocale {
  return (
    typeof value === 'string' &&
    (APP_CONFIG_LOCALES as readonly string[]).includes(value)
  )
}

function normalizeFavorites(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (item): item is string => typeof item === 'string' && item.length > 0,
      ),
    ),
  ]
}

function normalizeConfig(raw: unknown): AppConfig {
  if (!raw || typeof raw !== 'object') {
    return structuredClone(DEFAULT_CONFIG)
  }

  const data = raw as Record<string, unknown>

  // Legacy flat shape: { schemaVersion, locale, scriptFavorites }
  const isFlat =
    'locale' in data ||
    'scriptFavorites' in data ||
    (typeof data.schemaVersion === 'number' && !('common' in data))

  if (isFlat) {
    return {
      common: {
        locale: isLocale(data.locale) ? data.locale : null,
      },
      scripts: {
        schemaVersion: 1,
        scriptFavorites: normalizeFavorites(data.scriptFavorites),
      },
      translation: { enabled: DEFAULT_CONFIG.translation.enabled },
      updates: { skippedVersion: null },
    }
  }

  const common =
    data.common && typeof data.common === 'object'
      ? (data.common as Record<string, unknown>)
      : {}
  const scripts =
    data.scripts && typeof data.scripts === 'object'
      ? (data.scripts as Record<string, unknown>)
      : {}
  const translation =
    data.translation && typeof data.translation === 'object'
      ? (data.translation as Record<string, unknown>)
      : {}
  const updates =
    data.updates && typeof data.updates === 'object'
      ? (data.updates as Record<string, unknown>)
      : {}

  return {
    common: {
      locale: isLocale(common.locale) ? common.locale : null,
    },
    scripts: {
      schemaVersion: 1,
      scriptFavorites: normalizeFavorites(scripts.scriptFavorites),
    },
    translation: {
      enabled:
        typeof translation.enabled === 'boolean'
          ? translation.enabled
          : DEFAULT_CONFIG.translation.enabled,
    },
    updates: {
      skippedVersion:
        typeof updates.skippedVersion === 'string' &&
        updates.skippedVersion.length > 0
          ? updates.skippedVersion
          : null,
    },
  }
}

function needsRewrite(raw: unknown): boolean {
  if (raw == null || typeof raw !== 'object') return true
  const data = raw as Record<string, unknown>
  if ('locale' in data || 'scriptFavorites' in data) return true
  if (!('common' in data) || !('scripts' in data) || !('translation' in data)) {
    return true
  }
  if (!('updates' in data)) return true
  return false
}

async function readJson(filePath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

function normalizeSettingsFilePath(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Settings path cannot be empty')
  }
  const resolved = path.resolve(trimmed)
  if (!resolved.toLowerCase().endsWith('.json')) {
    throw new Error('Settings path must be a .json file')
  }
  return resolved
}

let customSettingsPath: string | null | undefined
let cached: AppConfig | null = null
let writeQueue: Promise<void> = Promise.resolve()

async function loadCustomSettingsPath(): Promise<string | null> {
  if (customSettingsPath !== undefined) return customSettingsPath
  const data = await readJson(getAppSettingsLocationFile())
  if (data && typeof data === 'object') {
    const filePath = (data as Record<string, unknown>).filePath
    if (typeof filePath === 'string' && filePath.trim()) {
      try {
        customSettingsPath = normalizeSettingsFilePath(filePath)
        return customSettingsPath
      } catch {
        // fall through to default
      }
    }
  }
  customSettingsPath = null
  return null
}

async function saveCustomSettingsPath(filePath: string | null): Promise<void> {
  const locationFile = getAppSettingsLocationFile()
  await fs.mkdir(path.dirname(locationFile), { recursive: true })
  if (!filePath) {
    try {
      await fs.unlink(locationFile)
    } catch {
      // ignore missing
    }
    customSettingsPath = null
    return
  }
  await fs.writeFile(
    locationFile,
    `${JSON.stringify({ filePath }, null, 2)}\n`,
    'utf8',
  )
  customSettingsPath = filePath
}

export async function resolveAppConfigPath(): Promise<string> {
  const custom = await loadCustomSettingsPath()
  return custom ?? getDefaultAppSettingsPath()
}

/** @deprecated Prefer resolveAppConfigPath — kept for sync call sites that already awaited load. */
export function getAppConfigPath(): string {
  return customSettingsPath ?? getDefaultAppSettingsPath()
}

async function writeConfig(config: AppConfig, filePath?: string): Promise<void> {
  const target = filePath ?? (await resolveAppConfigPath())
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

async function readFactoryDefaults(): Promise<unknown | null> {
  return readJson(getShippedAppSettingsDefaultPath())
}

async function readSettingsFromDisk(filePath: string): Promise<{
  raw: unknown | null
  config: AppConfig
  seededFromFactory: boolean
}> {
  let raw = await readJson(filePath)
  let seededFromFactory = false

  if (raw == null) {
    for (const legacy of legacyAppSettingsPaths()) {
      if (path.resolve(legacy) === path.resolve(filePath)) continue
      const legacyRaw = await readJson(legacy)
      if (legacyRaw != null) {
        raw = legacyRaw
        break
      }
    }
  }

  if (raw == null) {
    const factory = await readFactoryDefaults()
    if (factory != null) {
      raw = factory
      seededFromFactory = true
    }
  }

  return { raw, config: normalizeConfig(raw), seededFromFactory }
}

export async function loadAppConfig(): Promise<AppConfig> {
  if (cached) return cached
  const filePath = await resolveAppConfigPath()
  const { raw, config, seededFromFactory } = await readSettingsFromDisk(filePath)
  cached = config
  // Create / migrate the writable settings file when missing or legacy-shaped.
  if (needsRewrite(raw) || raw == null || seededFromFactory) {
    await writeConfig(cached, filePath)
  }
  return cached
}

export async function getAppConfig(): Promise<AppConfig> {
  return loadAppConfig()
}

export async function patchAppConfig(patch: AppConfigPatch): Promise<AppConfig> {
  const current = await loadAppConfig()
  const next: AppConfig = {
    common: {
      locale:
        patch.common?.locale === undefined
          ? current.common.locale
          : patch.common.locale === null
            ? null
            : isLocale(patch.common.locale)
              ? patch.common.locale
              : current.common.locale,
    },
    scripts: {
      schemaVersion: 1,
      scriptFavorites:
        patch.scripts?.scriptFavorites === undefined
          ? current.scripts.scriptFavorites
          : normalizeFavorites(patch.scripts.scriptFavorites),
    },
    translation: {
      enabled:
        patch.translation?.enabled === undefined
          ? current.translation.enabled
          : Boolean(patch.translation.enabled),
    },
    updates: {
      skippedVersion:
        patch.updates?.skippedVersion === undefined
          ? current.updates.skippedVersion
          : patch.updates.skippedVersion === null ||
              patch.updates.skippedVersion === ''
            ? null
            : String(patch.updates.skippedVersion),
    },
  }

  cached = next
  writeQueue = writeQueue
    .then(() => writeConfig(next))
    .catch((error) => {
      console.error('[app-config] failed to save', error)
    })
  await writeQueue
  return next
}

export async function getAppSettingsPathInfo(): Promise<AppSettingsPathInfo> {
  const filePath = await resolveAppConfigPath()
  const defaultPath = getDefaultAppSettingsPath()
  const custom = await loadCustomSettingsPath()
  return {
    filePath,
    defaultPath,
    isCustom: custom != null,
    configDir: path.dirname(filePath),
    packaged: app.isPackaged,
  }
}

export async function setAppSettingsPath(nextPath: string): Promise<AppSettingsPathInfo> {
  const resolved = normalizeSettingsFilePath(nextPath)
  const defaultPath = getDefaultAppSettingsPath()
  const current = await loadAppConfig()

  if (path.resolve(resolved) === path.resolve(defaultPath)) {
    await saveCustomSettingsPath(null)
  } else {
    await saveCustomSettingsPath(resolved)
  }

  // Prefer existing file at the destination; otherwise seed with factory defaults
  // or the current in-memory config.
  const existing = await readJson(resolved)
  if (existing != null) {
    cached = normalizeConfig(existing)
    if (needsRewrite(existing)) {
      await writeConfig(cached, resolved)
    }
  } else {
    const factory = await readFactoryDefaults()
    cached = factory != null ? normalizeConfig(factory) : current
    await writeConfig(cached, resolved)
  }

  return getAppSettingsPathInfo()
}

export async function resetAppSettingsPath(): Promise<AppSettingsPathInfo> {
  const current = await loadAppConfig()
  await saveCustomSettingsPath(null)
  const defaultPath = getDefaultAppSettingsPath()
  const existing = await readJson(defaultPath)
  if (existing != null) {
    cached = normalizeConfig(existing)
    if (needsRewrite(existing)) {
      await writeConfig(cached, defaultPath)
    }
  } else {
    const factory = await readFactoryDefaults()
    cached = factory != null ? normalizeConfig(factory) : current
    await writeConfig(cached, defaultPath)
  }
  return getAppSettingsPathInfo()
}

export async function chooseAppSettingsPath(): Promise<AppSettingsPathInfo | null> {
  const info = await getAppSettingsPathInfo()
  const result = await dialog.showSaveDialog({
    title: 'Choose app settings file',
    defaultPath: info.filePath,
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  })
  if (result.canceled || !result.filePath) return null
  return setAppSettingsPath(result.filePath)
}

export function registerAppConfigIpc(ipcMain: IpcMain): void {
  ipcMain.handle('appConfig:get', async () => getAppConfig())
  ipcMain.handle('appConfig:patch', async (_event, patch: AppConfigPatch) =>
    patchAppConfig(patch ?? {}),
  )
  ipcMain.handle('appConfig:getPath', async () => getAppSettingsPathInfo())
  ipcMain.handle('appConfig:setPath', async (_event, filePath: string) =>
    setAppSettingsPath(String(filePath ?? '')),
  )
  ipcMain.handle('appConfig:resetPath', async () => resetAppSettingsPath())
  ipcMain.handle('appConfig:choosePath', async () => chooseAppSettingsPath())
}
