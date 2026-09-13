/// <reference types="vite/client" />

type ScriptEntry = {
  filename: string
  name: string
  toggle?: string
}

type ScriptRunnerStatus = {
  state: "idle" | "active" | "running"
  filename: string | null
  running: boolean
  loaded: boolean
  error: string | null
  lastMessage: string | null
}

type TranslatorTask = "idle" | "pending" | "converting"

type TranslatorSettings = {
  copyTrigger: string
  toggle: string
  fieldConvert: string
}

type TranslatorStatus = {
  enabled: boolean
  task: TranslatorTask
  running: boolean
  settings: TranslatorSettings
  error: string | null
  lastMessage: string | null
}

type KeybindEntry = {
  id: string
  bind: string
  script: string
  enabled: boolean
  label: string
}

type KeybindJsScript = {
  filename: string
}

type KeybindsState = {
  entries: KeybindEntry[]
  scripts: KeybindJsScript[]
  filePath: string
  error: string | null
  lastMessage: string | null
}

type AppConfig = {
  common: {
    locale: "en" | "zh-CN" | "zh-TW" | null
  }
  scripts: {
    schemaVersion: 1
    scriptFavorites: string[]
  }
  translation: {
    enabled: boolean
  }
}

type AppConfigPatch = {
  common?: Partial<AppConfig["common"]>
  scripts?: Partial<AppConfig["scripts"]>
  translation?: Partial<AppConfig["translation"]>
}

type AppSettingsPathInfo = {
  filePath: string
  defaultPath: string
  isCustom: boolean
  configDir: string
  packaged: boolean
}

interface Window {
  ipcRenderer: import("electron").IpcRenderer
  scriptsApi: {
    list: () => Promise<ScriptEntry[]>
    updateName: (filename: string, name: string) => Promise<ScriptEntry>
    rename: (filename: string, nextFilename: string) => Promise<ScriptEntry>
    delete: (filename: string) => Promise<void>
    read: (filename: string) => Promise<{ filename: string; content: Record<string, unknown> }>
    write: (filename: string, content: Record<string, unknown>) => Promise<ScriptEntry>
    getRunnerStatus: () => Promise<ScriptRunnerStatus>
    setActive: (filename: string | null) => Promise<ScriptRunnerStatus>
    toggleRunner: () => Promise<ScriptRunnerStatus>
    unloadRunner: () => Promise<ScriptRunnerStatus>
    onRunnerStatus: (listener: (status: ScriptRunnerStatus) => void) => () => void
  }
  translatorApi: {
    getStatus: () => Promise<TranslatorStatus>
    setEnabled: (enabled: boolean) => Promise<TranslatorStatus>
    toggleEnabled: () => Promise<TranslatorStatus>
    updateSettings: (patch: Partial<TranslatorSettings>) => Promise<TranslatorStatus>
    onStatus: (listener: (status: TranslatorStatus) => void) => () => void
  }
  keybindsApi: {
    getState: () => Promise<KeybindsState>
    refreshScripts: () => Promise<KeybindsState>
    setEntries: (entries: KeybindEntry[]) => Promise<KeybindsState>
    create: (partial?: Partial<KeybindEntry>) => Promise<KeybindsState>
    update: (id: string, patch: Partial<KeybindEntry>) => Promise<KeybindsState>
    remove: (id: string) => Promise<KeybindsState>
    onState: (listener: (state: KeybindsState) => void) => () => void
  }
  appConfigApi: {
    get: () => Promise<AppConfig>
    patch: (patch: AppConfigPatch) => Promise<AppConfig>
    getPath: () => Promise<AppSettingsPathInfo>
    setPath: (filePath: string) => Promise<AppSettingsPathInfo>
    resetPath: () => Promise<AppSettingsPathInfo>
    choosePath: () => Promise<AppSettingsPathInfo | null>
  }
}
