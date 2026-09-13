import { dialog, type IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { patchAppConfig, loadAppConfig } from './app-config'
import { refreshKeybindScripts } from './keybinds'
import {
  getDefaultScriptsDir,
  getScriptsDir,
  setScriptsDirOverride,
} from './paths'
import { unloadScriptRunner } from './runner'

export type ScriptsDirInfo = {
  folderPath: string
  defaultPath: string
  isCustom: boolean
}

function normalizeScriptsFolderPath(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Scripts folder path cannot be empty')
  }
  return path.resolve(trimmed)
}

export async function getScriptsDirInfo(): Promise<ScriptsDirInfo> {
  const config = await loadAppConfig()
  const defaultPath = getDefaultScriptsDir()
  const custom = config.scripts.folderPath
  const folderPath = custom ?? defaultPath
  return {
    folderPath,
    defaultPath,
    isCustom: custom != null,
  }
}

async function applyScriptsFolder(
  folderPath: string | null,
): Promise<ScriptsDirInfo> {
  const defaultPath = getDefaultScriptsDir()
  const resolved =
    folderPath == null ||
    path.resolve(folderPath) === path.resolve(defaultPath)
      ? null
      : normalizeScriptsFolderPath(folderPath)

  if (resolved) {
    await fs.mkdir(resolved, { recursive: true })
  }

  await patchAppConfig({ scripts: { folderPath: resolved } })
  setScriptsDirOverride(resolved)

  try {
    await unloadScriptRunner()
  } catch (error) {
    console.error('[scripts-dir] failed to unload runner', error)
  }
  try {
    await refreshKeybindScripts()
  } catch (error) {
    console.error('[scripts-dir] failed to refresh keybinds', error)
  }

  return getScriptsDirInfo()
}

export async function setScriptsDir(nextPath: string): Promise<ScriptsDirInfo> {
  return applyScriptsFolder(normalizeScriptsFolderPath(nextPath))
}

export async function resetScriptsDir(): Promise<ScriptsDirInfo> {
  return applyScriptsFolder(null)
}

export async function chooseScriptsDir(): Promise<ScriptsDirInfo | null> {
  const info = await getScriptsDirInfo()
  const result = await dialog.showOpenDialog({
    title: 'Choose scripts folder',
    defaultPath: info.folderPath,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return setScriptsDir(result.filePaths[0]!)
}

export function registerScriptsDirIpc(ipcMain: IpcMain): void {
  ipcMain.handle('scripts:getDir', async () => getScriptsDirInfo())
  ipcMain.handle('scripts:setDir', async (_event, folderPath: string) =>
    setScriptsDir(String(folderPath ?? '')),
  )
  ipcMain.handle('scripts:resetDir', async () => resetScriptsDir())
  ipcMain.handle('scripts:chooseDir', async () => chooseScriptsDir())
}

export { getScriptsDir }
