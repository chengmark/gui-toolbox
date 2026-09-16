#!/usr/bin/env bun
/**
 * Sustained background loop (like auto_space.json) via PostMessage.
 * Ctrl+C to stop. Keep another app focused while watching the game.
 *
 * Usage:
 *   bun poc/background-input/run-loop.mjs --process MyGame --key Space --delay 100
 *   bun poc/background-input/run-loop.mjs --hwnd 0x12345 --key 2 --delay 1000
 */
import { keyLParam, resolveKey } from './lib/keys.mjs'
import {
  WM_KEYDOWN,
  WM_KEYUP,
  assertKoffiResolvable,
  findWindows,
  getForegroundHwnd,
  postKeyMessage,
} from './lib/win32.mjs'

function parseArgs(argv) {
  const opts = {
    hwnd: null,
    pid: null,
    process: null,
    title: null,
    key: 'Space',
    delay: 200,
    holdMs: 0,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--hwnd') opts.hwnd = Number(next())
    else if (a === '--pid') opts.pid = Number(next())
    else if (a === '--process') opts.process = next()
    else if (a === '--title') opts.title = next()
    else if (a === '--key') opts.key = next()
    else if (a === '--delay') opts.delay = Math.max(1, Number(next()) || 200)
    else if (a === '--hold-ms') opts.holdMs = Math.max(0, Number(next()) || 0)
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: bun poc/background-input/run-loop.mjs (--hwnd|--pid|--process|--title) [--key Space] [--delay 200] [--hold-ms 0]`)
      process.exit(0)
    } else {
      throw new Error(`Unknown arg: ${a}`)
    }
  }
  if (opts.hwnd == null && opts.pid == null && !opts.process && !opts.title) {
    throw new Error('Provide --hwnd, --pid, --process, or --title')
  }
  return opts
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

assertKoffiResolvable()
const opts = parseArgs(process.argv.slice(2))
const key = resolveKey(opts.key)
if (!key) throw new Error(`Unknown key: ${opts.key}`)

let target
if (opts.hwnd != null) {
  target = { hwnd: opts.hwnd, title: '(by --hwnd)', pid: opts.pid, exeBase: '' }
} else {
  const matches = findWindows({
    pid: opts.pid,
    process: opts.process,
    title: opts.title,
  })
  if (!matches.length) throw new Error('No matching window')
  target = matches[0]
  if (matches.length > 1) {
    console.warn(`Using first of ${matches.length} matches: ${target.hwndHex} ${target.title}`)
  }
}

const downLp = keyLParam(key.scan, key.extended, { up: false })
const upLp = keyLParam(key.scan, key.extended, { up: true })
let n = 0
let stopping = false

process.on('SIGINT', () => {
  stopping = true
  console.log('\nStopping...')
})

console.log(
  `Loop PostMessage ${opts.key} → HWND 0x${Number(target.hwnd).toString(16)} every ${opts.delay}ms (Ctrl+C to stop)`,
)
console.log(
  `Foreground now 0x${getForegroundHwnd().toString(16)} — switch away from the game to validate background.`,
)

while (!stopping) {
  postKeyMessage(target.hwnd, WM_KEYDOWN, key.vk, downLp)
  if (opts.holdMs > 0) await sleep(opts.holdMs)
  postKeyMessage(target.hwnd, WM_KEYUP, key.vk, upLp)
  n += 1
  if (n % 10 === 0) {
    const fg = getForegroundHwnd()
    process.stdout.write(
      `  taps=${n} fg=0x${fg.toString(16)}${fg === target.hwnd ? ' (game focused)' : ' (bg)'}\r`,
    )
  }
  await sleep(opts.delay)
}

console.log(`Stopped after ${n} taps.`)
