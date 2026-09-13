import { app } from 'electron'
import path from 'node:path'

/** Project `data/` in dev; packaged `resources/data` for shipped assets. */
export function getShippedDataDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'data')
  }
  return path.join(process.env.APP_ROOT ?? process.cwd(), 'data')
}

/**
 * Writable config root.
 * Dev: `data/config` (alongside other data assets).
 * Packaged: `userData/config` so installs under Program Files stay read-only.
 */
export function getConfigDir(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'config')
  }
  return path.join(getShippedDataDir(), 'config')
}

/** Built-in scripts folder shipped with the app. */
export function getDefaultScriptsDir(): string {
  return path.join(getShippedDataDir(), 'scripts')
}

/** Active override from app-settings (`scripts.folderPath`); null = default. */
let scriptsDirOverride: string | null = null

export function setScriptsDirOverride(folderPath: string | null): void {
  scriptsDirOverride =
    folderPath && folderPath.trim().length > 0
      ? path.resolve(folderPath.trim())
      : null
}

export function getScriptsDir(): string {
  return scriptsDirOverride ?? getDefaultScriptsDir()
}

export function getKeybindJsonPath(): string {
  if (app.isPackaged) {
    return path.join(getConfigDir(), 'keybind.json')
  }
  return path.join(getShippedDataDir(), 'keybinds', 'keybind.json')
}

/** Default settings file (before any user override). */
export function getDefaultAppSettingsPath(): string {
  return path.join(getConfigDir(), 'app-settings.json')
}

/**
 * Packaged factory defaults (read-only template).
 * Dev: `data/config/app-settings-default.json`
 * Packaged: `resources/data/config/app-settings-default.json`
 */
export function getShippedAppSettingsDefaultPath(): string {
  return path.join(getShippedDataDir(), 'config', 'app-settings-default.json')
}

/**
 * Fixed pointer for a custom settings path.
 * Always under Electron userData so we can find settings even after a move.
 */
export function getAppSettingsLocationFile(): string {
  return path.join(app.getPath('userData'), 'app-settings-location.json')
}

export function getTranslatorSettingsPath(): string {
  return path.join(getConfigDir(), 'translator-settings.json')
}

/** Older locations kept for one-time migration. */
export function legacyKeybindPaths(): string[] {
  const userData = app.getPath('userData')
  const root = process.env.APP_ROOT ?? process.cwd()
  return [
    path.join(userData, 'keybind.json'),
    path.join(userData, 'keybinds.json'),
    path.join(root, 'keybind.json'),
    path.join(root, 'data', 'keybinds', 'keybind.json'),
  ]
}

export function legacyTranslatorSettingsPaths(): string[] {
  return [path.join(app.getPath('userData'), 'translator-settings.json')]
}

export function legacyAppSettingsPaths(): string[] {
  return [
    path.join(getConfigDir(), 'app.json'),
    path.join(app.getPath('userData'), 'config', 'app.json'),
    path.join(app.getPath('userData'), 'app.json'),
  ]
}
