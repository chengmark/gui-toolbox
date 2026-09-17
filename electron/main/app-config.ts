import { app, dialog, BrowserWindow, type IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  getAppSettingsLocationFile,
  getConfigDir,
  getDefaultAppSettingsPath,
  getShippedAppSettingsDefaultPath,
  legacyAppSettingsPaths,
  setScriptsDirOverride,
} from './paths'

export const APP_CONFIG_LOCALES = ['en', 'zh-CN', 'zh-TW'] as const
export type AppConfigLocale = (typeof APP_CONFIG_LOCALES)[number]

export const CLOSE_ACTIONS = ['ask', 'tray', 'quit'] as const
export type CloseAction = (typeof CLOSE_ACTIONS)[number]

export type AppConfig = {
  common: {
    /** null = follow OS / browser language until the user picks one in Settings */
    locale: AppConfigLocale | null
    /** Launch GUI Toolbox when the user signs in to Windows (packaged builds). */
    openAtLogin: boolean
    /**
     * Close-button behavior:
     * - ask: prompt minimize-to-tray vs quit (optional remember)
     * - tray: always hide to tray
     * - quit: always exit the app
     */
    closeAction: CloseAction
  }
  scripts: {
    schemaVersion: 1
    scriptFavorites: string[]
    /** Absolute scripts folder; null = shipped default under data/scripts. */
    folderPath: string | null
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
  common: { locale: null, openAtLogin: false, closeAction: 'ask' },
  scripts: { schemaVersion: 1, scriptFavorites: [], folderPath: null },
  translation: { enabled: false },
  updates: { skippedVersion: null },
}

function isCloseAction(value: unknown): value is CloseAction {
  return (
    typeof value === 'string' &&
    (CLOSE_ACTIONS as readonly string[]).includes(value)
  )
}

/** Migrate legacy closeToTray boolean → closeAction. */
function normalizeCloseAction(common: Record<string, unknown>): CloseAction {
  if (isCloseAction(common.closeAction)) return common.closeAction
  if (typeof common.closeToTray === 'boolean') {
    return common.closeToTray ? 'tray' : 'ask'
  }
  return DEFAULT_CONFIG.common.closeAction
}

function normalizeFolderPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return path.resolve(trimmed)
}

function syncScriptsDirOverride(config: AppConfig): void {
  setScriptsDirOverride(config.scripts.folderPath)
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
        openAtLogin: DEFAULT_CONFIG.common.openAtLogin,
        closeAction: DEFAULT_CONFIG.common.closeAction,
      },
      scripts: {
        schemaVersion: 1,
        scriptFavorites: normalizeFavorites(data.scriptFavorites),
        folderPath: null,
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
      openAtLogin:
        typeof common.openAtLogin === 'boolean'
          ? common.openAtLogin
          : DEFAULT_CONFIG.common.openAtLogin,
      closeAction: normalizeCloseAction(common),
    },
    scripts: {
      schemaVersion: 1,
      scriptFavorites: normalizeFavorites(scripts.scriptFavorites),
      folderPath: normalizeFolderPath(scripts.folderPath),
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
  const common =
    data.common && typeof data.common === 'object'
      ? (data.common as Record<string, unknown>)
      : null
  if (
    !common ||
    !('openAtLogin' in common) ||
    (!('closeAction' in common) && !('closeToTray' in common))
  ) {
    return true
  }
  if ('closeToTray' in common && !('closeAction' in common)) return true
  const scripts =
    data.scripts && typeof data.scripts === 'object'
      ? (data.scripts as Record<string, unknown>)
      : null
  if (!scripts || !('folderPath' in scripts)) return true
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
  syncScriptsDirOverride(cached)
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
      openAtLogin:
        patch.common?.openAtLogin === undefined
          ? current.common.openAtLogin
          : Boolean(patch.common.openAtLogin),
      closeAction:
        patch.common?.closeAction === undefined
          ? current.common.closeAction
          : isCloseAction(patch.common.closeAction)
            ? patch.common.closeAction
            : current.common.closeAction,
    },
    scripts: {
      schemaVersion: 1,
      scriptFavorites:
        patch.scripts?.scriptFavorites === undefined
          ? current.scripts.scriptFavorites
          : normalizeFavorites(patch.scripts.scriptFavorites),
      folderPath:
        patch.scripts?.folderPath === undefined
          ? current.scripts.folderPath
          : normalizeFolderPath(patch.scripts.folderPath),
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
  syncScriptsDirOverride(next)
  writeQueue = writeQueue
    .then(() => writeConfig(next))
    .catch((error) => {
      console.error('[app-config] failed to save', error)
    })
  await writeQueue

  // Lazy import avoids a circular dependency with app-behavior ↔ app-config.
  const { applyAppBehaviorFromConfig } = await import('./app-behavior')
  applyAppBehaviorFromConfig(next)

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('appConfig:updated', next)
    }
  }

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
    syncScriptsDirOverride(cached)
    if (needsRewrite(existing)) {
      await writeConfig(cached, resolved)
    }
  } else {
    const factory = await readFactoryDefaults()
    cached = factory != null ? normalizeConfig(factory) : current
    syncScriptsDirOverride(cached)
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
    syncScriptsDirOverride(cached)
    if (needsRewrite(existing)) {
      await writeConfig(cached, defaultPath)
    }
  } else {
    const factory = await readFactoryDefaults()
    cached = factory != null ? normalizeConfig(factory) : current
    syncScriptsDirOverride(cached)
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
