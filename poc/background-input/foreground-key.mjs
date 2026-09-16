#!/usr/bin/env bun
/**
 * Control POC: inject via keybd_event (same path as the Electron runner).
 * Requires the game (or target) to be focused — proves the key mapping works.
 *
 * Usage (from repo root, on Windows):
 *   bun poc/background-input/foreground-key.mjs --key Space
 *   bun poc/background-input/foreground-key.mjs --key 2 --times 3 --delay 500
 *
 * Tip: focus the game, then run this within a few seconds (--countdown).
 */
import { resolveKey } from './lib/keys.mjs'
import { assertKoffiResolvable, getForegroundHwnd, keybdEvent } from './lib/win32.mjs'

function parseArgs(argv) {
  const opts = { key: 'Space', times: 1, delay: 100, holdMs: 0, countdown: 3 }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--key') opts.key = next()
    else if (a === '--times') opts.times = Math.max(1, Number(next()) || 1)
    else if (a === '--delay') opts.delay = Math.max(0, Number(next()) || 0)
    else if (a === '--hold-ms') opts.holdMs = Math.max(0, Number(next()) || 0)
    else if (a === '--countdown') opts.countdown = Math.max(0, Number(next()) || 0)
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: bun poc/background-input/foreground-key.mjs [--key Space] [--times 1] [--delay 100] [--hold-ms 0] [--countdown 3]`)
      process.exit(0)
    } else {
      throw new Error(`Unknown arg: ${a}`)
    }
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

if (opts.countdown > 0) {
  console.log(`Focus the game window. Injecting in ${opts.countdown}s...`)
  for (let s = opts.countdown; s > 0; s -= 1) {
    process.stdout.write(`  ${s}...\r`)
    await sleep(1000)
  }
  console.log('  go.   ')
}

const fg = getForegroundHwnd()
console.log(
  `Foreground HWND=0x${fg.toString(16)} — injecting ${opts.times}x ${opts.key} via keybd_event`,
)

for (let i = 0; i < opts.times; i += 1) {
  keybdEvent(key.vk, key.scan, { extended: key.extended, up: false })
  if (opts.holdMs > 0) await sleep(opts.holdMs)
  keybdEvent(key.vk, key.scan, { extended: key.extended, up: true })
  console.log(`[${i + 1}/${opts.times}] tapped`)
  if (i < opts.times - 1 && opts.delay > 0) await sleep(opts.delay)
}

console.log('Done. If this works focused but post-key.mjs fails unfocused, background mode is not viable for this game.')
