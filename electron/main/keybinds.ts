import { type BrowserWindow, type IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  uIOhook,
  type UiohookKeyboardEvent,
  type UiohookMouseEvent,
} from 'uiohook-napi'
import {
  isMouseToken,
  normalizeKeybind,
  parseKeybind,
  type KeybindParts,
} from '../../src/shared/keybind/model'
import { getKeybindJsonPath, getScriptsDir, getShippedDataDir, legacyKeybindPaths } from './paths'
import { resolveKeyCode } from './runner/keys'
import { showAppToast } from './app-toast'

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

const MOUSE_BUTTON_ALIASES: Record<string, number> = {
  mb1: 1,
  mb2: 2,
  mb3: 3,
  mb4: 4,
  mb5: 5,
}

/** Canonical store: `data/keybinds/keybind.json` in dev, userData/config when packaged. */
export { getKeybindJsonPath }

function createId(): string {
  return `kb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function modifiersMatch(
  event: {
    ctrlKey: boolean
    altKey: boolean
    shiftKey: boolean
    metaKey: boolean
  },
  parts: KeybindParts,
): boolean {
  return (
    event.ctrlKey === parts.ctrl &&
    event.altKey === parts.alt &&
    event.shiftKey === parts.shift &&
    event.metaKey === parts.meta
  )
}

function matchesKeyboard(
  event: UiohookKeyboardEvent,
  parts: KeybindParts,
): boolean {
  if (isMouseToken(parts.key)) return false
  const keycode = resolveKeyCode(parts.key)
  if (keycode == null) return false
  return event.keycode === keycode && modifiersMatch(event, parts)
}

function matchesMouse(event: UiohookMouseEvent, parts: KeybindParts): boolean {
  if (!isMouseToken(parts.key)) return false
  const button = MOUSE_BUTTON_ALIASES[parts.key]
  if (button == null) return false
  return Number(event.button) === button && modifiersMatch(event, parts)
}

function normalizeEntry(raw: unknown): KeybindEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const bind =
    typeof item.bind === 'string' ? normalizeKeybind(item.bind) : ''
  const script = typeof item.script === 'string' ? item.script.trim() : ''
  const label = typeof item.label === 'string' ? item.label.trim() : ''
  const id =
    typeof item.id === 'string' && item.id.trim() ? item.id.trim() : createId()
  return {
    id,
    bind,
    script,
    enabled: item.enabled !== false,
    label,
  }
}

function parseEntriesPayload(data: unknown): KeybindEntry[] {
  const list = Array.isArray(data)
    ? data
    : data &&
        typeof data === 'object' &&
        Array.isArray((data as { entries?: unknown }).entries)
      ? (data as { entries: unknown[] }).entries
      : []
  return list
    .map(normalizeEntry)
    .filter((entry): entry is KeybindEntry => entry != null)
}

function resolveJsScriptPath(filename: string): string {
  const base = path.basename(filename.trim())
  if (!base || base !== filename.trim() || base.includes('..')) {
    throw new Error('Invalid script filename')
  }
  if (!/\.mjs$/i.test(base)) {
    throw new Error('Keybind scripts must be .mjs files')
  }
  return path.join(getScriptsDir(), base)
}

function validateEntry(entry: KeybindEntry): void {
  if (entry.bind && !parseKeybind(entry.bind)) {
    throw new Error(`Invalid keybind: ${entry.bind}`)
  }
  if (entry.script) {
    resolveJsScriptPath(entry.script)
  }
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

async function saveEntries(entries: KeybindEntry[]): Promise<void> {
  const filePath = getKeybindJsonPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const payload = {
    schemaVersion: 1,
    entries,
  }
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function loadEntries(): Promise<KeybindEntry[]> {
  const primary = getKeybindJsonPath()
  const primaryData = await readJsonFile(primary)
  if (primaryData != null) {
    return parseEntriesPayload(primaryData)
  }

  // One-time migrate from older locations / seed packaged defaults
  const candidates = [
    ...legacyKeybindPaths(),
    path.join(getShippedDataDir(), 'keybinds', 'keybind.json'),
  ]
  for (const legacyPath of candidates) {
    if (path.resolve(legacyPath) === path.resolve(primary)) continue
    const legacyData = await readJsonFile(legacyPath)
    if (legacyData == null) continue
    const migrated = parseEntriesPayload(legacyData)
    await saveEntries(migrated)
    return migrated
  }

  await saveEntries([])
  return []
}

async function listJsScripts(): Promise<KeybindJsScript[]> {
  try {
    const dir = getScriptsDir()
    const names = await fs.readdir(dir)
    return names
      .filter((name) => /\.mjs$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map((filename) => ({ filename }))
  } catch {
    return []
  }
}

class KeybindsService {
  private entries: KeybindEntry[] = []
  private scripts: KeybindJsScript[] = []
  private error: string | null = null
  private lastMessage: string | null = null
  private win: BrowserWindow | null = null
  private hookAttached = false
  private running = new Set<string>()
  private writeQueue: Promise<void> = Promise.resolve()

  private onKeyDown = (event: UiohookKeyboardEvent) => {
    this.dispatchKeyboard(event)
  }

  private onMouseDown = (event: UiohookMouseEvent) => {
    this.dispatchMouse(event)
  }

  async start(win: BrowserWindow): Promise<void> {
    this.win = win
    this.entries = await loadEntries()
    this.scripts = await listJsScripts()
    this.attachHook()
    this.emit()
  }

  stop(): void {
    this.detachHook()
    this.win = null
  }

  getState(): KeybindsState {
    return {
      entries: this.entries.map((entry) => ({ ...entry })),
      scripts: this.scripts.map((script) => ({ ...script })),
      filePath: getKeybindJsonPath(),
      error: this.error,
      lastMessage: this.lastMessage,
    }
  }

  async refreshScripts(): Promise<KeybindsState> {
    this.scripts = await listJsScripts()
    this.emit()
    return this.getState()
  }

  async setEntries(next: KeybindEntry[]): Promise<KeybindsState> {
    const normalized = next
      .map(normalizeEntry)
      .filter((entry): entry is KeybindEntry => entry != null)
      .map((entry) => ({
        ...entry,
        bind: entry.bind ? normalizeKeybind(entry.bind) : '',
      }))

    for (const entry of normalized) validateEntry(entry)

    this.entries = normalized
    await this.syncToDisk(
      `Saved ${normalized.length} keybind${normalized.length === 1 ? '' : 's'}`,
    )
    return this.getState()
  }

  async create(partial?: Partial<KeybindEntry>): Promise<KeybindsState> {
    const entry = normalizeEntry({
      id: createId(),
      bind: '',
      script: '',
      enabled: true,
      label: '',
      ...partial,
    })
    if (!entry) throw new Error('Failed to create keybind')
    validateEntry(entry)
    this.entries = [...this.entries, entry]
    await this.syncToDisk('Created keybind')
    return this.getState()
  }

  async update(
    id: string,
    patch: Partial<KeybindEntry>,
  ): Promise<KeybindsState> {
    const index = this.entries.findIndex((entry) => entry.id === id)
    if (index < 0) throw new Error(`Keybind not found: ${id}`)

    const merged = normalizeEntry({ ...this.entries[index], ...patch, id })
    if (!merged) throw new Error('Invalid keybind update')
    validateEntry(merged)

    const next = [...this.entries]
    next[index] = merged
    this.entries = next
    await this.syncToDisk('Updated keybind')
    return this.getState()
  }

  async remove(id: string): Promise<KeybindsState> {
    const next = this.entries.filter((entry) => entry.id !== id)
    if (next.length === this.entries.length) {
      throw new Error(`Keybind not found: ${id}`)
    }
    this.entries = next
    await this.syncToDisk('Deleted keybind')
    return this.getState()
  }

  /** Serialize writes so rapid CRUD cannot interleave on disk. */
  private async syncToDisk(message: string): Promise<void> {
    const snapshot = this.entries.map((entry) => ({ ...entry }))
    this.writeQueue = this.writeQueue.then(async () => {
      await saveEntries(snapshot)
    })
    try {
      await this.writeQueue
      this.error = null
      this.lastMessage = message
      this.emit()
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Failed to write keybind.json'
      this.emit()
      throw error
    }
  }

  private attachHook(): void {
    if (this.hookAttached) return
    try {
      uIOhook.off('keydown', this.onKeyDown)
      uIOhook.off('mousedown', this.onMouseDown)
      uIOhook.on('keydown', this.onKeyDown)
      uIOhook.on('mousedown', this.onMouseDown)
      uIOhook.start()
      this.hookAttached = true
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Failed to start keybind hook'
      this.emit()
    }
  }

  private detachHook(): void {
    if (!this.hookAttached) return
    try {
      uIOhook.off('keydown', this.onKeyDown)
      uIOhook.off('mousedown', this.onMouseDown)
    } catch {
      // ignore
    }
    this.hookAttached = false
  }

  private dispatchKeyboard(event: UiohookKeyboardEvent): void {
    for (const entry of this.entries) {
      if (!entry.enabled || !entry.bind || !entry.script) continue
      const parts = parseKeybind(entry.bind)
      if (!parts || !matchesKeyboard(event, parts)) continue
      void this.runEntry(entry)
      return
    }
  }

  private dispatchMouse(event: UiohookMouseEvent): void {
    for (const entry of this.entries) {
      if (!entry.enabled || !entry.bind || !entry.script) continue
      const parts = parseKeybind(entry.bind)
      if (!parts || !matchesMouse(event, parts)) continue
      void this.runEntry(entry)
      return
    }
  }

  private async runEntry(entry: KeybindEntry): Promise<void> {
    if (this.running.has(entry.id)) return
    this.running.add(entry.id)
    const isNextAudio = entry.script.toLowerCase() === 'next_audio_output.mjs'
    try {
      if (isNextAudio) {
        await showAppToast({
          mode: 'loading',
          title: 'Switching audio output…',
          message: 'Finding next playback device',
        })
      }

      const fullPath = resolveJsScriptPath(entry.script)
      const href = `${pathToFileURL(fullPath).href}?t=${Date.now()}`
      const mod = (await import(href)) as {
        default?: unknown
        run?: unknown
      }
      const runner =
        typeof mod.default === 'function'
          ? mod.default
          : typeof mod.run === 'function'
            ? mod.run
            : null
      if (!runner) {
        throw new Error(
          `Script ${entry.script} must export default function or run()`,
        )
      }
      const result = await Promise.resolve(runner())
      this.error = null
      this.lastMessage = `Ran ${entry.script}`
      this.emit()

      if (isNextAudio) {
        const device =
          typeof result === 'string' && result.trim()
            ? result.trim()
            : 'Next device selected'
        await showAppToast({
          mode: 'success',
          title: 'Audio output switched',
          message: device,
          durationMs: 3000,
        })
      }
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : `Failed to run ${entry.script}`
      this.emit()
      if (isNextAudio) {
        await showAppToast({
          mode: 'error',
          title: 'Audio switch failed',
          message: this.error ?? 'Unknown error',
          durationMs: 3000,
        })
      }
    } finally {
      this.running.delete(entry.id)
    }
  }

  private emit(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('keybinds:state', this.getState())
    }
  }
}

const keybinds = new KeybindsService()

export function startKeybinds(win: BrowserWindow): void {
  void keybinds.start(win)
}

export function stopKeybinds(): void {
  keybinds.stop()
}

export function registerKeybindsIpc(ipcMain: IpcMain): void {
  ipcMain.handle('keybinds:getState', async () => keybinds.getState())
  ipcMain.handle('keybinds:refreshScripts', async () =>
    keybinds.refreshScripts(),
  )
  ipcMain.handle(
    'keybinds:setEntries',
    async (_event, entries: KeybindEntry[]) =>
      keybinds.setEntries(entries ?? []),
  )
  ipcMain.handle(
    'keybinds:create',
    async (_event, partial?: Partial<KeybindEntry>) => keybinds.create(partial),
  )
  ipcMain.handle(
    'keybinds:update',
    async (_event, id: string, patch: Partial<KeybindEntry>) =>
      keybinds.update(id, patch ?? {}),
  )
  ipcMain.handle('keybinds:remove', async (_event, id: string) =>
    keybinds.remove(id),
  )
}
