import fs from 'node:fs/promises'
import path from 'node:path'
import { expandKeySequence, normalizeKeyName } from './keys'
import {
  getCursorPos,
  mouseClick,
  mouseMoveRelative,
  normalizeMouseButton,
  setCursorPos,
} from './mouse'
import type { RunnerContext, ScriptStep } from './types'
import { sleepInterruptible, toFloat, toInt } from './utils'
import { keyDown, keyTap, keyUp } from './win-input'

type Handler = (args: unknown[], ctx: RunnerContext) => Promise<void>

/** Win32 keybd_event with hardware scan codes (matches Python `keyboard`). */
async function pressKey(name: string): Promise<void> {
  keyDown(name)
}

async function releaseKey(name: string): Promise<void> {
  keyUp(name)
}

async function tapKey(name: string): Promise<void> {
  keyTap(name)
}

const handlers: Record<string, Handler> = {
  async Delay(args, ctx) {
    await sleepInterruptible(ctx, toFloat(args[0], 0) / 1000)
  },

  async KeyPress(args, ctx) {
    if (args.length < 1) return
    const keys = expandKeySequence(String(args[0] ?? ''))
    const times = Math.max(1, toInt(args[1], 1))
    const intervalMs = toFloat(args[2], 0)
    const presses = Array.from({ length: times }, () => keys).flat()
    for (let i = 0; i < presses.length; i += 1) {
      if (ctx.exiting || !ctx.running) return
      await tapKey(presses[i])
      if (i < presses.length - 1 && intervalMs > 0) {
        await sleepInterruptible(ctx, intervalMs / 1000)
      }
    }
  },

  // Match Python: single normalize_key_name, not expand sequence.
  async KeyDown(args, ctx) {
    if (args.length < 1) return
    const key = normalizeKeyName(String(args[0] ?? ''))
    if (!key) return
    const times = Math.max(1, toInt(args[1], 1))
    for (let t = 0; t < times; t += 1) {
      if (ctx.exiting || !ctx.running) return
      await pressKey(key)
    }
  },

  async KeyUp(args, ctx) {
    if (args.length < 1) return
    const key = normalizeKeyName(String(args[0] ?? ''))
    if (!key) return
    const times = Math.max(1, toInt(args[1], 1))
    for (let t = 0; t < times; t += 1) {
      if (ctx.exiting || !ctx.running) return
      await releaseKey(key)
    }
  },

  async KeyHoldAndRelease(args, ctx) {
    if (args.length < 1) return
    const key = normalizeKeyName(String(args[0] ?? ''))
    if (!key) return
    const seconds = toFloat(args[1], 1)
    await pressKey(key)
    try {
      await sleepInterruptible(ctx, seconds)
    } finally {
      await releaseKey(key)
    }
  },

  async MouseClick(args, ctx) {
    const button = normalizeMouseButton(args[0])
    const times = Math.max(1, toInt(args[1], 1))
    for (let i = 0; i < times; i += 1) {
      if (ctx.exiting || !ctx.running) return
      mouseClick(button)
    }
  },

  async MouseMove(args, ctx) {
    const dx = toInt(args[0], 0)
    const dy = toInt(args[1], 0)
    if (dx === 0 && dy === 0) return
    const distance = Math.hypot(dx, dy)
    const steps = Math.max(1, Math.round(distance))
    let prevX = 0
    let prevY = 0
    for (let i = 1; i <= steps; i += 1) {
      if (ctx.exiting || !ctx.running) return
      const t = i / steps
      const curX = Math.round(dx * t)
      const curY = Math.round(dy * t)
      mouseMoveRelative(curX - prevX, curY - prevY)
      prevX = curX
      prevY = curY
    }
  },

  async MouseMoveTo(args, ctx) {
    const targetX = toInt(args[0], 0)
    const targetY = toInt(args[1], 0)
    const start = getCursorPos()
    const dx = targetX - start.x
    const dy = targetY - start.y
    if (dx === 0 && dy === 0) return
    const distance = Math.hypot(dx, dy)
    const steps = Math.max(1, Math.round(distance))
    for (let i = 1; i <= steps; i += 1) {
      if (ctx.exiting || !ctx.running) return
      const t = i / steps
      setCursorPos(start.x + dx * t, start.y + dy * t)
    }
  },

  async ClickOn(args, ctx) {
    await handlers.MouseMoveTo([args[0], args[1]], ctx)
    if (ctx.exiting || !ctx.running) return
    mouseClick(normalizeMouseButton(args[2]))
  },

  async ImportScript(args, ctx) {
    if (args.length < 1) return
    const file = String(args[0] ?? '').trim()
    if (!file) return
    const full = path.isAbsolute(file)
      ? file
      : path.join(ctx.scriptBaseDir, path.basename(file))
    try {
      const raw = JSON.parse(await fs.readFile(full, 'utf8')) as Record<
        string,
        unknown
      >
      const initial = Array.isArray(raw.initial) ? (raw.initial as ScriptStep[]) : []
      const loop = Array.isArray(raw.loop)
        ? (raw.loop as ScriptStep[])
        : Array.isArray(raw.steps)
          ? (raw.steps as ScriptStep[])
          : []
      if (initial.length && !(await runSteps(initial, ctx))) return
      if (loop.length) await runSteps(loop, ctx)
    } catch (error) {
      console.warn('[runner] ImportScript failed:', error)
    }
  },

  async RunScript(args, ctx) {
    const id = String(args[0] ?? '').trim()
    if (!id) return
    const sub = ctx.inlineScripts.get(id)
    if (!sub) {
      console.warn(`[runner] RunScript: unknown subroutine "${id}"`)
      return
    }
    if (sub.initial.length && !(await runSteps(sub.initial, ctx))) return
    if (sub.loop.length) await runSteps(sub.loop, ctx)
  },

  async Script(args) {
    console.warn(
      `[runner] Script (process) not yet supported in Electron: ${String(args[0] ?? '')}`,
    )
  },

  async SetVolume() {
    console.warn('[runner] SetVolume is not yet supported in Electron')
  },

  async ToggleMute() {
    console.warn('[runner] ToggleMute is not yet supported in Electron')
  },
}

handlers.run_script = handlers.RunScript

export async function performStep(
  step: ScriptStep,
  ctx: RunnerContext,
): Promise<void> {
  const command = step?.command
  if (!command) return
  const handler = handlers[command]
  if (!handler) {
    console.warn(`[runner] Unknown command: ${command}`)
    return
  }
  await handler(step.args ?? [], ctx)
}

export async function runSteps(
  steps: ScriptStep[],
  ctx: RunnerContext,
): Promise<boolean> {
  for (const step of steps) {
    if (!step?.command) continue
    if (ctx.exiting || !ctx.running) return false
    try {
      await performStep(step, ctx)
    } catch (error) {
      console.warn(`[runner] Step error (${step.command}):`, error)
    }
  }
  return true
}
