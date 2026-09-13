import { ipcRenderer, contextBridge } from 'electron'

export type ScriptEntry = {
  filename: string
  name: string
  toggle?: string
}

export type ScriptRunnerStatus = {
  state: 'idle' | 'active' | 'running'
  filename: string | null
  running: boolean
  loaded: boolean
  error: string | null
  lastMessage: string | null
}

export type TranslatorTask = 'idle' | 'pending' | 'converting'

export type TranslatorSettings = {
  copyTrigger: string
  toggle: string
  fieldConvert: string
}

export type TranslatorStatus = {
  enabled: boolean
  task: TranslatorTask
  running: boolean
  settings: TranslatorSettings
  error: string | null
  lastMessage: string | null
}

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

contextBridge.exposeInMainWorld('scriptsApi', {
  list: (): Promise<ScriptEntry[]> => ipcRenderer.invoke('scripts:list'),
  updateName: (filename: string, name: string): Promise<ScriptEntry> =>
    ipcRenderer.invoke('scripts:updateName', filename, name),
  rename: (filename: string, nextFilename: string): Promise<ScriptEntry> =>
    ipcRenderer.invoke('scripts:rename', filename, nextFilename),
  delete: (filename: string): Promise<void> =>
    ipcRenderer.invoke('scripts:delete', filename),
  read: (filename: string): Promise<{ filename: string; content: Record<string, unknown> }> =>
    ipcRenderer.invoke('scripts:read', filename),
  write: (
    filename: string,
    content: Record<string, unknown>,
  ): Promise<ScriptEntry> => ipcRenderer.invoke('scripts:write', filename, content),
  getRunnerStatus: (): Promise<ScriptRunnerStatus> =>
    ipcRenderer.invoke('scripts:runner-getStatus'),
  setActive: (filename: string | null): Promise<ScriptRunnerStatus> =>
    ipcRenderer.invoke('scripts:runner-setActive', filename),
  toggleRunner: (): Promise<ScriptRunnerStatus> =>
    ipcRenderer.invoke('scripts:runner-toggle'),
  unloadRunner: (): Promise<ScriptRunnerStatus> =>
    ipcRenderer.invoke('scripts:runner-unload'),
  onRunnerStatus: (listener: (status: ScriptRunnerStatus) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      status: ScriptRunnerStatus,
    ) => {
      listener(status)
    }
    ipcRenderer.on('scripts:runner-status', handler)
    return () => {
      ipcRenderer.off('scripts:runner-status', handler)
    }
  },
})

contextBridge.exposeInMainWorld('translatorApi', {
  getStatus: (): Promise<TranslatorStatus> =>
    ipcRenderer.invoke('translator:getStatus'),
  setEnabled: (enabled: boolean): Promise<TranslatorStatus> =>
    ipcRenderer.invoke('translator:setEnabled', enabled),
  toggleEnabled: (): Promise<TranslatorStatus> =>
    ipcRenderer.invoke('translator:toggleEnabled'),
  updateSettings: (
    patch: Partial<TranslatorSettings>,
  ): Promise<TranslatorStatus> =>
    ipcRenderer.invoke('translator:updateSettings', patch),
  onStatus: (listener: (status: TranslatorStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: TranslatorStatus) => {
      listener(status)
    }
    ipcRenderer.on('translator:status', handler)
    return () => {
      ipcRenderer.off('translator:status', handler)
    }
  },
})

export type KeybindEntry = {
  id: string
  bind: string
  script: string
  enabled: boolean
  label: string
}

export type KeybindJsScript = {
  filename: string
}

export type KeybindsState = {
  entries: KeybindEntry[]
  scripts: KeybindJsScript[]
  filePath: string
  error: string | null
  lastMessage: string | null
}

contextBridge.exposeInMainWorld('keybindsApi', {
  getState: (): Promise<KeybindsState> => ipcRenderer.invoke('keybinds:getState'),
  refreshScripts: (): Promise<KeybindsState> =>
    ipcRenderer.invoke('keybinds:refreshScripts'),
  setEntries: (entries: KeybindEntry[]): Promise<KeybindsState> =>
    ipcRenderer.invoke('keybinds:setEntries', entries),
  create: (partial?: Partial<KeybindEntry>): Promise<KeybindsState> =>
    ipcRenderer.invoke('keybinds:create', partial),
  update: (
    id: string,
    patch: Partial<KeybindEntry>,
  ): Promise<KeybindsState> => ipcRenderer.invoke('keybinds:update', id, patch),
  remove: (id: string): Promise<KeybindsState> =>
    ipcRenderer.invoke('keybinds:remove', id),
  onState: (listener: (state: KeybindsState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: KeybindsState) => {
      listener(state)
    }
    ipcRenderer.on('keybinds:state', handler)
    return () => {
      ipcRenderer.off('keybinds:state', handler)
    }
  },
})

export type AppConfig = {
  common: {
    locale: 'en' | 'zh-CN' | 'zh-TW' | null
  }
  scripts: {
    schemaVersion: 1
    scriptFavorites: string[]
  }
  translation: {
    enabled: boolean
  }
  updates: {
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

contextBridge.exposeInMainWorld('appConfigApi', {
  get: (): Promise<AppConfig> => ipcRenderer.invoke('appConfig:get'),
  patch: (patch: AppConfigPatch): Promise<AppConfig> =>
    ipcRenderer.invoke('appConfig:patch', patch),
  getPath: (): Promise<AppSettingsPathInfo> =>
    ipcRenderer.invoke('appConfig:getPath'),
  setPath: (filePath: string): Promise<AppSettingsPathInfo> =>
    ipcRenderer.invoke('appConfig:setPath', filePath),
  resetPath: (): Promise<AppSettingsPathInfo> =>
    ipcRenderer.invoke('appConfig:resetPath'),
  choosePath: (): Promise<AppSettingsPathInfo | null> =>
    ipcRenderer.invoke('appConfig:choosePath'),
})

export type UpdaterCheckResult =
  | {
      status: 'available'
      currentVersion: string
      newVersion: string
    }
  | {
      status: 'not-available'
      currentVersion: string
      newVersion?: string
    }
  | {
      status: 'skipped'
      currentVersion: string
      message: string
    }
  | {
      status: 'error'
      currentVersion: string
      message: string
    }

export type UpdaterProgress = {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

contextBridge.exposeInMainWorld('updaterApi', {
  getVersion: (): Promise<string> => ipcRenderer.invoke('updater:get-version'),
  check: (): Promise<UpdaterCheckResult> => ipcRenderer.invoke('updater:check'),
  download: (): Promise<{ started: boolean }> =>
    ipcRenderer.invoke('updater:download'),
  cancelDownload: (): Promise<void> =>
    ipcRenderer.invoke('updater:cancel-download'),
  install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
  onProgress: (listener: (progress: UpdaterProgress) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: UpdaterProgress,
    ) => {
      listener(progress)
    }
    ipcRenderer.on('updater:progress', handler)
    return () => {
      ipcRenderer.off('updater:progress', handler)
    }
  },
  onDownloaded: (listener: () => void) => {
    const handler = () => {
      listener()
    }
    ipcRenderer.on('updater:downloaded', handler)
    return () => {
      ipcRenderer.off('updater:downloaded', handler)
    }
  },
  onError: (listener: (payload: { message: string }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: { message: string },
    ) => {
      listener(payload)
    }
    ipcRenderer.on('updater:error', handler)
    return () => {
      ipcRenderer.off('updater:error', handler)
    }
  },
})

function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true)
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true)
        }
      })
    }
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find((el) => el === child)) {
      return parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find((el) => el === child)) {
      return parent.removeChild(child)
    }
  },
}

function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 40px;
  height: 40px;
  background: #0078d4;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #181818;
  z-index: 9;
}
    `
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

const { appendLoading, removeLoading } = useLoading()
domReady().then(appendLoading)

window.onmessage = (ev) => {
  ev.data.payload === 'removeLoading' && removeLoading()
}

setTimeout(removeLoading, 4999)
