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

type ScriptsDirInfo = {
  folderPath: string
  defaultPath: string
  isCustom: boolean
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
    openAtLogin: boolean
    openAtLoginAsAdmin: boolean
    closeAction: "ask" | "tray" | "quit"
  }
  scripts: {
    schemaVersion: 1
    scriptFavorites: string[]
    folderPath: string | null
  }
  translation: {
    enabled: boolean
  }
  updates: {
    skippedVersion: string | null
  }
}

type AppConfigPatch = {
  common?: Partial<AppConfig["common"]>
  scripts?: Partial<AppConfig["scripts"]>
  translation?: Partial<AppConfig["translation"]>
  updates?: Partial<AppConfig["updates"]>
}

type AppSettingsPathInfo = {
  filePath: string
  defaultPath: string
  isCustom: boolean
  configDir: string
  packaged: boolean
}

type UpdaterCheckResult =
  | {
      status: "available"
      currentVersion: string
      newVersion: string
    }
  | {
      status: "not-available"
      currentVersion: string
      newVersion?: string
    }
  | {
      status: "skipped"
      currentVersion: string
      message: string
    }
  | {
      status: "error"
      currentVersion: string
      message: string
    }

type UpdaterProgress = {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
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
    getDir: () => Promise<ScriptsDirInfo>
    setDir: (folderPath: string) => Promise<ScriptsDirInfo>
    resetDir: () => Promise<ScriptsDirInfo>
    chooseDir: () => Promise<ScriptsDirInfo | null>
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
  keybindRecorderApi: {
    start: () => Promise<{ ok: boolean }>
    stop: () => Promise<{ ok: boolean }>
    onResult: (listener: (bind: string) => void) => () => void
    onCancel: (listener: () => void) => () => void
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
    onUpdated: (listener: (config: AppConfig) => void) => () => void
  }
  appBehaviorApi: {
    onClosePrompt: (listener: () => void) => () => void
    submitClosePrompt: (result: {
      choice: "tray" | "quit" | "cancel"
      remember: boolean
    }) => Promise<boolean>
  }
  updaterApi: {
    getVersion: () => Promise<string>
    check: () => Promise<UpdaterCheckResult>
    download: () => Promise<{ started: boolean }>
    cancelDownload: () => Promise<void>
    install: () => Promise<void>
    onProgress: (listener: (progress: UpdaterProgress) => void) => () => void
    onDownloaded: (listener: () => void) => () => void
    onError: (listener: (payload: { message: string }) => void) => () => void
  }
}
