import { app, clipboard, type BrowserWindow, type IpcMain } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import OpenCC from 'opencc-js'
import {
  uIOhook,
  UiohookKey,
  type UiohookKeyboardEvent,
  type UiohookMouseEvent,
} from 'uiohook-napi'
import {
  isMouseToken,
  normalizeKeybind,
  parseKeybind,
  type KeybindParts,
} from '../../src/shared/keybind/model'
import { getTranslatorSettingsPath, legacyTranslatorSettingsPaths } from './paths'
import { loadAppConfig, patchAppConfig } from './app-config'
import { isKeybindRecording } from './keybind-recorder'

export type TranslatorTask = 'idle' | 'pending' | 'converting'

export type TranslatorKeybindAction = 'copyTrigger' | 'toggle' | 'fieldConvert'

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

const CONVERSION_DEBOUNCE_MS = 750
const CLIPBOARD_POLL_MS = 200
const COPY_SETTLE_MS = 150
const FIELD_CONVERT_COPY_SETTLE_MS = 50
const FIELD_CONVERT_SELECT_SETTLE_MS = 30
const FIELD_CONVERT_PASTE_SETTLE_MS = 40
const FIELD_CONVERT_CLIPBOARD_SYNC_MS = 400
const FIELD_CONVERT_CLIPBOARD_RESTORE_MS = 3000
const FIELD_CONVERT_KEY_GAP_MS = 12

const DEFAULT_SETTINGS: TranslatorSettings = {
  copyTrigger: 'ctrl+c',
  toggle: 'delete',
  fieldConvert: 'pagedown',
}

const KEY_ALIASES: Record<string, number> = {
  backspace: UiohookKey.Backspace,
  tab: UiohookKey.Tab,
  enter: UiohookKey.Enter,
  return: UiohookKey.Enter,
  escape: UiohookKey.Escape,
  esc: UiohookKey.Escape,
  space: UiohookKey.Space,
  pageup: UiohookKey.PageUp,
  pagedown: UiohookKey.PageDown,
  pgup: UiohookKey.PageUp,
  pgdn: UiohookKey.PageDown,
  end: UiohookKey.End,
  home: UiohookKey.Home,
  left: UiohookKey.ArrowLeft,
  up: UiohookKey.ArrowUp,
  right: UiohookKey.ArrowRight,
  down: UiohookKey.ArrowDown,
  insert: UiohookKey.Insert,
  delete: UiohookKey.Delete,
  del: UiohookKey.Delete,
  ctrl: UiohookKey.Ctrl,
  alt: UiohookKey.Alt,
  shift: UiohookKey.Shift,
  meta: UiohookKey.Meta,
  ...Object.fromEntries(
    '0123456789abcdefghijklmnopqrstuvwxyz'.split('').map((ch) => [
      ch,
      UiohookKey[ch.toUpperCase() as keyof typeof UiohookKey] as number,
    ]),
  ),
  ...Object.fromEntries(
    Array.from({ length: 24 }, (_, i) => [
      `f${i + 1}`,
      UiohookKey[`F${i + 1}` as keyof typeof UiohookKey] as number,
    ]),
  ),
}

/** libuiohook mouse button ids. */
const MOUSE_BUTTON_ALIASES: Record<string, number> = {
  mb1: 1,
  mb2: 2,
  mb3: 3,
  mb4: 4,
  mb5: 5,
}

function resolveBinding(input: string): KeybindParts | null {
  return parseKeybind(input)
}

function isValidBinding(input: string): boolean {
  const parts = resolveBinding(input)
  if (!parts) return false
  if (isMouseToken(parts.key)) return parts.key in MOUSE_BUTTON_ALIASES
  return parts.key in KEY_ALIASES
}

function modifiersMatch(
  event: { ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean },
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
  const keycode = KEY_ALIASES[parts.key]
  if (keycode == null) return false
  return event.keycode === keycode && modifiersMatch(event, parts)
}

function matchesMouse(event: UiohookMouseEvent, parts: KeybindParts): boolean {
  if (!isMouseToken(parts.key)) return false
  const button = MOUSE_BUTTON_ALIASES[parts.key]
  if (button == null) return false
  return Number(event.button) === button && modifiersMatch(event, parts)
}

function settingsPath(): string {
  return getTranslatorSettingsPath()
}

async function loadSettings(): Promise<TranslatorSettings> {
  const primary = settingsPath()
  const candidates = [primary, ...legacyTranslatorSettingsPaths()]
  for (const filePath of candidates) {
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      const data = JSON.parse(raw) as Partial<TranslatorSettings>
      const settings = {
        copyTrigger: normalizeKeybind(
          typeof data.copyTrigger === 'string' && data.copyTrigger
            ? data.copyTrigger
            : DEFAULT_SETTINGS.copyTrigger,
        ),
        toggle: normalizeKeybind(
          typeof data.toggle === 'string' && data.toggle
            ? data.toggle
            : DEFAULT_SETTINGS.toggle,
        ),
        fieldConvert: normalizeKeybind(
          typeof data.fieldConvert === 'string' && data.fieldConvert
            ? data.fieldConvert
            : DEFAULT_SETTINGS.fieldConvert,
        ),
      }
      if (path.resolve(filePath) !== path.resolve(primary)) {
        await saveSettings(settings)
      }
      return settings
    } catch {
      // try next candidate
    }
  }
  return { ...DEFAULT_SETTINGS }
}

async function saveSettings(settings: TranslatorSettings): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true })
  await fs.writeFile(
    settingsPath(),
    `${JSON.stringify(settings, null, 2)}\n`,
    'utf8',
  )
}

const convertTraditionalToSimplified = OpenCC.Converter({ from: 't', to: 'cn' })

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

class TranslatorService {
  private enabled = false
  private task: TranslatorTask = 'idle'
  private running = false
  private error: string | null = null
  private lastMessage: string | null = null
  private settings: TranslatorSettings = { ...DEFAULT_SETTINGS }
  private lastClipboard = ''
  private lastTriggerAt = 0
  private pollTimer: NodeJS.Timeout | null = null
  private win: BrowserWindow | null = null
  private clipboardBusy = false
  private fieldConvertBusy = false

  private onKeyDown = (event: UiohookKeyboardEvent) => {
    if (isKeybindRecording()) return
    this.onKeyEvent(event, 'down')
  }

  private onKeyUp = (event: UiohookKeyboardEvent) => {
    if (isKeybindRecording()) return
    this.onKeyEvent(event, 'up')
  }

  private onMouseDown = (event: UiohookMouseEvent) => {
    if (isKeybindRecording()) return
    this.onMouseEvent(event)
  }

  async start(win: BrowserWindow): Promise<void> {
    this.win = win

    if (this.running) {
      this.emit()
      return
    }

    this.settings = await loadSettings()
    const appConfig = await loadAppConfig()
    this.enabled = appConfig.translation.enabled
    this.lastClipboard = this.readClipboard()
    this.running = true
    this.error = null

    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => {
        void this.clipboardWatcherTick()
      }, CLIPBOARD_POLL_MS)
    }

    try {
      uIOhook.off('keydown', this.onKeyDown)
      uIOhook.off('keyup', this.onKeyUp)
      uIOhook.off('mousedown', this.onMouseDown)
      uIOhook.on('keydown', this.onKeyDown)
      uIOhook.on('keyup', this.onKeyUp)
      uIOhook.on('mousedown', this.onMouseDown)
      uIOhook.start()
    } catch (error) {
      this.error =
        error instanceof Error
          ? error.message
          : 'Failed to start global keyboard hook'
      this.emit()
      return
    }

    this.emit()
  }

  stop(): void {
    this.running = false
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    try {
      uIOhook.off('keydown', this.onKeyDown)
      uIOhook.off('keyup', this.onKeyUp)
      uIOhook.off('mousedown', this.onMouseDown)
      // Do not stop the global hook — script runner may still need it.
    } catch {
      // ignore shutdown errors
    }
    this.task = 'idle'
    this.win = null
  }

  getStatus(): TranslatorStatus {
    return {
      enabled: this.enabled,
      task: this.task,
      running: this.running,
      settings: { ...this.settings },
      error: this.error,
      lastMessage: this.lastMessage,
    }
  }

  async setEnabled(enabled: boolean): Promise<TranslatorStatus> {
    if (this.enabled === enabled) return this.getStatus()
    this.enabled = enabled
    if (!enabled) this.task = 'idle'
    await patchAppConfig({ translation: { enabled } })
    this.emit()
    return this.getStatus()
  }

  async toggleEnabled(): Promise<TranslatorStatus> {
    return this.setEnabled(!this.enabled)
  }

  async updateSettings(
    patch: Partial<TranslatorSettings>,
  ): Promise<TranslatorStatus> {
    const next: TranslatorSettings = {
      copyTrigger: normalizeKeybind(
        typeof patch.copyTrigger === 'string' && patch.copyTrigger.trim()
          ? patch.copyTrigger
          : this.settings.copyTrigger,
      ),
      toggle: normalizeKeybind(
        typeof patch.toggle === 'string' && patch.toggle.trim()
          ? patch.toggle
          : this.settings.toggle,
      ),
      fieldConvert: normalizeKeybind(
        typeof patch.fieldConvert === 'string' && patch.fieldConvert.trim()
          ? patch.fieldConvert
          : this.settings.fieldConvert,
      ),
    }

    if (
      !isValidBinding(next.copyTrigger) ||
      !isValidBinding(next.toggle) ||
      !isValidBinding(next.fieldConvert)
    ) {
      throw new Error('Invalid keybind')
    }

    this.settings = next
    await saveSettings(next)
    this.emit()
    return this.getStatus()
  }

  private emit(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('translator:status', this.getStatus())
    }
  }

  private readClipboard(): string {
    try {
      return clipboard.readText() || ''
    } catch {
      return ''
    }
  }

  private writeClipboard(text: string): void {
    clipboard.writeText(text)
  }

  private isDebounced(now = Date.now()): boolean {
    return now - this.lastTriggerAt < CONVERSION_DEBOUNCE_MS
  }

  private tryBeginTrigger(): boolean {
    const now = Date.now()
    if (!this.enabled) return false
    if (this.isDebounced(now)) return false
    this.lastTriggerAt = now
    this.task = 'pending'
    this.emit()
    return true
  }

  private setTask(task: TranslatorTask): void {
    if (this.task === task) return
    this.task = task
    if (task === 'converting') this.lastTriggerAt = Date.now()
    this.emit()
  }

  private processClipboard(): boolean {
    if (!this.enabled) return false
    if (this.clipboardBusy || this.fieldConvertBusy) return false

    const text = this.readClipboard()
    if (!text) return false
    if (text === this.lastClipboard) return false

    this.clipboardBusy = true
    try {
      this.setTask('converting')
      const simplified = convertTraditionalToSimplified(text)
      if (simplified === text) {
        this.lastClipboard = text
        this.setTask('idle')
        return false
      }

      this.lastClipboard = simplified
      this.writeClipboard(simplified)
      this.setTask('idle')
      return true
    } finally {
      this.clipboardBusy = false
    }
  }

  private onCopyHotkey(): void {
    if (this.fieldConvertBusy) return
    if (!this.tryBeginTrigger()) return

    setTimeout(() => {
      try {
        if (!this.enabled) {
          this.setTask('idle')
          return
        }
        this.processClipboard()
      } finally {
        if (this.enabled && this.task !== 'idle') {
          this.setTask('idle')
        }
      }
    }, COPY_SETTLE_MS)
  }

  private async sendChord(key: number, modifiers: number[] = []): Promise<void> {
    for (const modifier of modifiers) {
      uIOhook.keyToggle(modifier, 'down')
    }
    await sleep(8)
    uIOhook.keyToggle(key, 'down')
    await sleep(8)
    uIOhook.keyToggle(key, 'up')
    await sleep(8)
    for (const modifier of [...modifiers].reverse()) {
      uIOhook.keyToggle(modifier, 'up')
    }
    await sleep(FIELD_CONVERT_KEY_GAP_MS)
  }

  private async waitForClipboard(expected: string, timeoutMs: number): Promise<boolean> {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      if (this.readClipboard() === expected) return true
      await sleep(10)
    }
    return this.readClipboard() === expected
  }

  private async onFieldConvertHotkey(): Promise<void> {
    if (!this.enabled || this.fieldConvertBusy || this.clipboardBusy) return

    this.fieldConvertBusy = true
    this.setTask('converting')
    this.lastMessage = 'Field convert…'
    this.emit()

    const previousClipboard = this.readClipboard()

    try {
      await this.sendChord(UiohookKey.A, [UiohookKey.Ctrl])
      await sleep(FIELD_CONVERT_SELECT_SETTLE_MS)
      await this.sendChord(UiohookKey.C, [UiohookKey.Ctrl])
      await sleep(FIELD_CONVERT_COPY_SETTLE_MS)

      const original = this.readClipboard()
      if (!original.trim()) {
        this.lastMessage = 'Field convert: clipboard empty after select/copy'
        this.setTask('idle')
        return
      }

      // OpenCC is synchronous — translation itself is not backgrounded.
      const simplified = convertTraditionalToSimplified(original)
      if (simplified === original) {
        this.lastClipboard = original
        this.lastMessage = 'Field convert: no Traditional→Simplified changes'
        this.setTask('idle')
        return
      }

      this.writeClipboard(simplified)
      this.lastClipboard = simplified

      const synced = await this.waitForClipboard(
        simplified,
        FIELD_CONVERT_CLIPBOARD_SYNC_MS,
      )
      if (!synced) {
        this.lastMessage = 'Field convert: clipboard not ready after translate'
        this.setTask('idle')
        return
      }

      await sleep(FIELD_CONVERT_PASTE_SETTLE_MS)

      // Re-select before paste — many games clear selection after copy.
      await this.sendChord(UiohookKey.A, [UiohookKey.Ctrl])
      await sleep(FIELD_CONVERT_SELECT_SETTLE_MS)
      await this.sendChord(UiohookKey.V, [UiohookKey.Ctrl])

      this.lastMessage = 'Field convert: pasted Simplified text'
      this.setTask('idle')

      // Restore later — some games read clipboard asynchronously after Ctrl+V.
      setTimeout(() => {
        try {
          if (this.readClipboard() === simplified) {
            this.writeClipboard(previousClipboard)
            this.lastClipboard = previousClipboard
          }
        } catch {
          // ignore
        }
      }, FIELD_CONVERT_CLIPBOARD_RESTORE_MS)
    } catch (error) {
      this.error =
        error instanceof Error ? error.message : 'Field convert failed'
      this.lastMessage = this.error
      this.setTask('idle')
    } finally {
      this.fieldConvertBusy = false
      this.emit()
    }
  }

  private clipboardWatcherTick(): void {
    if (!this.running) return
    if (!this.enabled) return
    if (this.task !== 'idle') return
    if (this.fieldConvertBusy) return
    if (this.isDebounced()) return
    this.processClipboard()
  }

  private onKeyEvent(event: UiohookKeyboardEvent, phase: 'down' | 'up'): void {
    if (!this.running) return

    const copyTrigger = resolveBinding(this.settings.copyTrigger)
    const toggle = resolveBinding(this.settings.toggle)
    const fieldConvert = resolveBinding(this.settings.fieldConvert)

    if (phase === 'up' && copyTrigger && matchesKeyboard(event, copyTrigger)) {
      this.onCopyHotkey()
      return
    }

    if (phase === 'up' && fieldConvert && matchesKeyboard(event, fieldConvert)) {
      void this.onFieldConvertHotkey()
      return
    }

    if (phase === 'down' && toggle && matchesKeyboard(event, toggle)) {
      void this.toggleEnabled()
    }
  }

  private onMouseEvent(event: UiohookMouseEvent): void {
    if (!this.running) return

    const copyTrigger = resolveBinding(this.settings.copyTrigger)
    const toggle = resolveBinding(this.settings.toggle)
    const fieldConvert = resolveBinding(this.settings.fieldConvert)

    if (copyTrigger && matchesMouse(event, copyTrigger)) {
      this.onCopyHotkey()
      return
    }

    if (fieldConvert && matchesMouse(event, fieldConvert)) {
      void this.onFieldConvertHotkey()
      return
    }

    if (toggle && matchesMouse(event, toggle)) {
      void this.toggleEnabled()
    }
  }
}

const translator = new TranslatorService()

export function registerTranslatorIpc(ipcMain: IpcMain): void {
  ipcMain.handle('translator:getStatus', async () => translator.getStatus())

  ipcMain.handle('translator:setEnabled', async (_event, enabled: boolean) =>
    translator.setEnabled(Boolean(enabled)),
  )

  ipcMain.handle('translator:toggleEnabled', async () => translator.toggleEnabled())

  ipcMain.handle(
    'translator:updateSettings',
    async (_event, patch: Partial<TranslatorSettings>) =>
      translator.updateSettings(patch ?? {}),
  )

  app.on('before-quit', () => {
    translator.stop()
  })
}

export function startTranslator(win: BrowserWindow): void {
  void translator.start(win)
}

export function stopTranslator(): void {
  translator.stop()
}

export { DEFAULT_SETTINGS }
