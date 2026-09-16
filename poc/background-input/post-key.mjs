#!/usr/bin/env bun
/**
 * Background POC: PostMessage / SendMessage WM_KEYDOWN+KEYUP to a target HWND.
 * Keep another app focused while this runs — if the game still reacts, background
 * scripting may be feasible for that title.
 *
 * Usage (from repo root, on Windows):
 *   bun poc/background-input/post-key.mjs --hwnd 0x12345 --key Space
 *   bun poc/background-input/post-key.mjs --pid 1234 --key 2
 *   bun poc/background-input/post-key.mjs --process MyGame --key Space --times 5 --delay 200
 *   bun poc/background-input/post-key.mjs --title "Game" --key Q --method send
 */
import { keyLParam, resolveKey } from './lib/keys.mjs'
import {
  WM_KEYDOWN,
  WM_KEYUP,
  assertKoffiResolvable,
  findWindows,
  getForegroundHwnd,
  postKeyMessage,
  sendKeyMessage,
} from './lib/win32.mjs'

function parseArgs(argv) {
  const opts = {
    hwnd: null,
    pid: null,
    process: null,
    title: null,
    key: 'Space',
    times: 1,
    delay: 100,
    holdMs: 0,
    method: 'post', // post | send
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--hwnd') opts.hwnd = Number(next())
    else if (a === '--pid') opts.pid = Number(next())
    else if (a === '--process') opts.process = next()
    else if (a === '--title') opts.title = next()
    else if (a === '--key') opts.key = next()
    else if (a === '--times') opts.times = Math.max(1, Number(next()) || 1)
    else if (a === '--delay') opts.delay = Math.max(0, Number(next()) || 0)
    else if (a === '--hold-ms') opts.holdMs = Math.max(0, Number(next()) || 0)
    else if (a === '--method') opts.method = String(next()).toLowerCase()
    else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  bun poc/background-input/post-key.mjs (--hwnd HWND | --pid PID | --process NAME | --title SUBSTR)
    [--key Space] [--times 1] [--delay 100] [--hold-ms 0] [--method post|send]`)
      process.exit(0)
    } else {
      throw new Error(`Unknown arg: ${a}`)
    }
  }
  if (opts.hwnd == null && opts.pid == null && !opts.process && !opts.title) {
    throw new Error('Provide --hwnd, --pid, --process, or --title')
  }
  if (opts.method !== 'post' && opts.method !== 'send') {
    throw new Error('--method must be post or send')
  }
  return opts
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function resolveTarget(opts) {
  if (opts.hwnd != null && !Number.isNaN(opts.hwnd)) {
    return {
      hwnd: opts.hwnd,
      hwndHex: `0x${opts.hwnd.toString(16)}`,
      pid: opts.pid,
      title: '(by --hwnd)',
      exeBase: '',
    }
  }
  const matches = findWindows({
    pid: opts.pid,
    process: opts.process,
    title: opts.title,
  })
  if (!matches.length) {
    throw new Error('No matching visible window. Run list-windows.mjs first.')
  }
  if (matches.length > 1) {
    console.warn(`Matched ${matches.length} windows; using first:`)
    for (const m of matches.slice(0, 8)) {
      console.warn(`  ${m.hwndHex} pid=${m.pid} ${m.exeBase} | ${m.title}`)
    }
  }
  return matches[0]
}

function deliver(method, hwnd, msg, vk, lParam) {
  if (method === 'send') return sendKeyMessage(hwnd, msg, vk, lParam)
  return postKeyMessage(hwnd, msg, vk, lParam)
}

assertKoffiResolvable()
const opts = parseArgs(process.argv.slice(2))
const key = resolveKey(opts.key)
if (!key) throw new Error(`Unknown key: ${opts.key}`)

const target = resolveTarget(opts)
const fg = getForegroundHwnd()

console.log('Target:', {
  hwnd: target.hwndHex ?? `0x${target.hwnd.toString(16)}`,
  pid: target.pid,
  exe: target.exeBase,
  title: target.title,
})
console.log('Foreground HWND now:', `0x${fg.toString(16)}`, fg === target.hwnd ? '(SAME — focus game elsewhere to test background)' : '(different — good for background test)')
console.log(
  `Sending ${opts.times}x ${opts.key} via ${opts.method === 'send' ? 'SendMessage' : 'PostMessage'} (scan=0x${key.scan.toString(16)})`,
)

const downLp = keyLParam(key.scan, key.extended, { up: false })
const upLp = keyLParam(key.scan, key.extended, { up: true })

for (let i = 0; i < opts.times; i += 1) {
  const okDown = deliver(opts.method, target.hwnd, WM_KEYDOWN, key.vk, downLp)
  if (opts.holdMs > 0) await sleep(opts.holdMs)
  const okUp = deliver(opts.method, target.hwnd, WM_KEYUP, key.vk, upLp)
  console.log(
    `[${i + 1}/${opts.times}] down=${Boolean(okDown)} up=${Boolean(okUp)}`,
  )
  if (i < opts.times - 1 && opts.delay > 0) await sleep(opts.delay)
}

console.log('Done. If the game did nothing while unfocused, PostMessage likely will not work for this title.')
