#!/usr/bin/env bun
/**
 * List visible top-level windows (HWND, PID, exe, title).
 *
 * Usage (from repo root, on Windows):
 *   bun poc/background-input/list-windows.mjs
 *   bun poc/background-input/list-windows.mjs --process game
 *   bun poc/background-input/list-windows.mjs --title "My Game"
 */
import { assertKoffiResolvable, listWindows } from './lib/win32.mjs'

function parseArgs(argv) {
  const opts = { process: null, title: null, json: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--json') opts.json = true
    else if (a === '--process') opts.process = argv[++i]
    else if (a === '--title') opts.title = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: bun poc/background-input/list-windows.mjs [--process NAME] [--title SUBSTR] [--json]`)
      process.exit(0)
    }
  }
  return opts
}

assertKoffiResolvable()
const opts = parseArgs(process.argv.slice(2))
let rows = listWindows()

if (opts.process) {
  const p = opts.process.toLowerCase().replace(/\.exe$/i, '')
  rows = rows.filter((w) =>
    w.exeBase.toLowerCase().replace(/\.exe$/i, '').includes(p),
  )
}
if (opts.title) {
  const t = opts.title.toLowerCase()
  rows = rows.filter((w) => w.title.toLowerCase().includes(t))
}

if (opts.json) {
  console.log(JSON.stringify(rows, null, 2))
  process.exit(0)
}

if (!rows.length) {
  console.log('No matching windows.')
  process.exit(1)
}

console.log(
  `${'HWND'.padEnd(12)} ${'PID'.padEnd(8)} ${'EXE'.padEnd(28)} TITLE`,
)
console.log('-'.repeat(80))
for (const w of rows) {
  console.log(
    `${w.hwndHex.padEnd(12)} ${String(w.pid).padEnd(8)} ${w.exeBase.slice(0, 27).padEnd(28)} ${w.title}`,
  )
}
console.log(`\n${rows.length} window(s). Pick HWND/PID for post-key.mjs`)
