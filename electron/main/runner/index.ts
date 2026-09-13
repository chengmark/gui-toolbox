import type { BrowserWindow, IpcMain } from 'electron'
import path from 'node:path'
import {
  uIOhook,
  type UiohookKeyboardEvent,
  type UiohookMouseEvent,
} from 'uiohook-napi'
import {
  isMouseToken,
  parseKeybind,
  type KeybindParts,
} from '../../../src/shared/keybind/model'
import { normalizeScriptDocument, getScriptsDir, readScript } from '../scripts'
import { resolveKeyCode } from './keys'
import type {
  InlineSubroutine,
  ProcessSubroutine,
  RunnerContext,
  RunnerStatus,
  ScriptDocument,
  ScriptStep,
} from './types'
import { workerLoop } from './worker'

/** libuiohook mouse button ids. */
const MOUSE_BUTTON_ALIASES: Record<string, number> = {
  mb1: 1,
  mb2: 2,
  mb3: 3,
  mb4: 4,
  mb5: 5,
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

function matchesToggleKeyboard(
  event: UiohookKeyboardEvent,
  parts: KeybindParts,
): boolean {
  if (isMouseToken(parts.key)) return false
  const keycode = resolveKeyCode(parts.key)
  if (keycode == null) return false
  return event.keycode === keycode && modifiersMatch(event, parts)
}

function matchesToggleMouse(
  event: UiohookMouseEvent,
  parts: KeybindParts,
): boolean {
  if (!isMouseToken(parts.key)) return false
  const button = MOUSE_BUTTON_ALIASES[parts.key]
  if (button == null) return false
  return Number(event.button) === button && modifiersMatch(event, parts)
}

function asSteps(value: unknown): ScriptStep[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      command: typeof item.command === 'string' ? item.command : 'Delay',
      args: Array.isArray(item.args) ? item.args : [],
    }))
}

function parseDocument(
  raw: Record<string, unknown>,
  fallbackName: string,
  baseDir: string,
): ScriptDocument {
  const normalized = normalizeScriptDocument(raw, fallbackName)
  const inlineScripts = new Map<string, InlineSubroutine>()
  const processSubs: ProcessSubroutine[] = []
  const subs = Array.isArray(normalized.subroutines)
    ? (normalized.subroutines as Array<Record<string, unknown>>)
    : []

  for (const entry of subs) {
    if (entry.kind === 'inline') {
      const id = typeof entry.id === 'string' ? entry.id : 'subroutine'
      inlineScripts.set(id, {
        kind: 'inline',
        id,
        initial: asSteps(entry.initial),
        loop: asSteps(entry.loop),
      })
    } else if (entry.kind === 'process') {
      processSubs.push({
        kind: 'process',
        file: typeof entry.file === 'string' ? entry.file : '',
        args: Array.isArray(entry.args) ? entry.args : [],
      })
    }
  }

  void processSubs
  void baseDir

  return {
    name: String(normalized.name ?? fallbackName),
    toggle: typeof normalized.toggle === 'string' && normalized.toggle
      ? normalized.toggle
      : 'home',
    initial: asSteps(normalized.initial),
    loop: asSteps(normalized.loop),
    background: asSteps(normalized.background),
    subroutines: [
      ...Array.from(inlineScripts.values()),
      ...processSubs,
    ],
  }
}

class ScriptRunnerService {
  private win: BrowserWindow | null = null
  private filename: string | null = null
  private doc: ScriptDocument | null = null
  private ctx: RunnerContext | null = null
  private workerPromise: Promise<void> | null = null
  private workerGeneration = 0
  private hookStarted = false
  private error: string | null = null
  private lastMessage: string | null = null
  private toggleBinding: KeybindParts | null = null

  private onKeyDown = (event: UiohookKeyboardEvent) => {
    // Shift+Esc unloads
    if (
      this.filename &&
      event.shiftKey &&
      event.keycode === resolveKeyCode('escape')
    ) {
      void this.unload()
      return
    }

    if (!this.filename || !this.ctx || !this.toggleBinding) return
    if (matchesToggleKeyboard(event, this.toggleBinding)) {
      this.handleToggleKey()
    }
  }

  private onMouseDown = (event: UiohookMouseEvent) => {
    if (!this.filename || !this.ctx || !this.toggleBinding) return
    if (matchesToggleMouse(event, this.toggleBinding)) {
      this.handleToggleKey()
    }
  }

  private handleToggleKey(): void {
    if (!this.ctx) return
    // Toggle on → Running (loop); toggle off → Active (loaded, waiting).
    this.setRunning(!this.ctx.running)
  }

  start(win: BrowserWindow): void {
    this.win = win
    this.ensureHook()
    this.emit()
  }

  stop(): void {
    void this.unload()
    try {
      uIOhook.off('keydown', this.onKeyDown)
      uIOhook.off('mousedown', this.onMouseDown)
    } catch {
      // ignore
    }
    this.hookStarted = false
    this.win = null
  }

  private ensureHook(): void {
    if (this.hookStarted) return
    try {
      uIOhook.on('keydown', this.onKeyDown)
      uIOhook.on('mousedown', this.onMouseDown)
      uIOhook.start()
      this.hookStarted = true
    } catch (error) {
      this.error =
        error instanceof Error
          ? error.message
          : 'Failed to start global keyboard hook'
    }
  }

  getStatus(): RunnerStatus {
    const loaded = this.filename != null
    const running = Boolean(this.ctx?.running)
    return {
      state: !loaded ? 'idle' : running ? 'running' : 'active',
      filename: this.filename,
      running,
      loaded,
      error: this.error,
      lastMessage: this.lastMessage,
    }
  }

  /** Load script (Active) or unload (Idle). Does not start Running. */
  async setActive(filename: string | null): Promise<RunnerStatus> {
    if (!filename) {
      await this.unload()
      return this.getStatus()
    }

    if (this.filename === filename) {
      return this.getStatus()
    }

    await this.unload()
    await this.load(filename)
    return this.getStatus()
  }

  async load(filename: string): Promise<RunnerStatus> {
    this.ensureHook()
    this.error = null

    try {
      const { content } = await readScript(filename)
      const baseName = filename.replace(/\.json$/i, '')
      const baseDir = getScriptsDir()
      const doc = parseDocument(content, baseName, baseDir)

      const inlineScripts = new Map<string, InlineSubroutine>()
      for (const entry of doc.subroutines) {
        if (entry.kind === 'inline') inlineScripts.set(entry.id, entry)
      }

      this.filename = path.basename(filename)
      this.doc = doc
      this.toggleBinding = parseKeybind(doc.toggle)
      this.ctx = {
        running: false,
        exiting: false,
        scriptBaseDir: baseDir,
        inlineScripts,
      }

      this.workerGeneration += 1
      const generation = this.workerGeneration
      const ctx = this.ctx
      this.workerPromise = workerLoop(
        doc.initial,
        doc.loop,
        ctx,
        () => generation === this.workerGeneration && this.ctx === ctx,
      ).catch((error) => {
        console.warn('[runner] Worker crashed:', error)
      })

      this.lastMessage = `Active ${doc.name} — press toggle to run`
      this.emit()
      return this.getStatus()
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to load script'
      this.filename = null
      this.doc = null
      this.ctx = null
      this.toggleBinding = null
      this.emit()
      return this.getStatus()
    }
  }

  async toggle(): Promise<RunnerStatus> {
    if (!this.ctx || !this.filename || !this.doc) return this.getStatus()
    this.handleToggleKey()
    return this.getStatus()
  }

  async unload(): Promise<RunnerStatus> {
    if (this.ctx) {
      this.ctx.running = false
      this.ctx.exiting = true
    }
    this.workerGeneration += 1
    this.workerPromise = null
    this.filename = null
    this.doc = null
    this.ctx = null
    this.toggleBinding = null
    this.lastMessage = 'Script unloaded'
    this.error = null
    this.emit()
    return this.getStatus()
  }

  private setRunning(running: boolean): void {
    if (!this.ctx) return
    if (this.ctx.running === running) {
      this.emit()
      return
    }
    this.ctx.running = running
    this.lastMessage = running ? 'Running' : 'Active — waiting'
    this.emit()
  }

  private emit(): void {
    const status = this.getStatus()
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('scripts:runner-status', status)
    }
  }
}

const runner = new ScriptRunnerService()

export function startScriptRunner(win: BrowserWindow): void {
  runner.start(win)
}

export function stopScriptRunner(): void {
  runner.stop()
}

export async function unloadScriptRunner(): Promise<RunnerStatus> {
  return runner.unload()
}

export function registerScriptRunnerIpc(ipcMain: IpcMain): void {
  ipcMain.handle('scripts:runner-getStatus', () => runner.getStatus())
  ipcMain.handle('scripts:runner-setActive', async (_event, filename: string | null) =>
    runner.setActive(filename),
  )
  ipcMain.handle('scripts:runner-toggle', async () => runner.toggle())
  ipcMain.handle('scripts:runner-unload', async () => runner.unload())
}

export type { RunnerStatus }
