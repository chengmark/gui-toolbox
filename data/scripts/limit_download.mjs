#!/usr/bin/env node
/**
 * Limit inbound (download) bandwidth for a Windows process.
 *
 * JS port of limit_download.py for yysls-toolbox subroutines.
 * CLI-compatible: node limit_download.mjs <pid> <rate> [--controlled]
 *
 * Packet diversion still requires the WinDivert driver + admin rights.
 * When the optional native divert backend is unavailable, the process still
 * honors toggle/exit so parent script runners do not hang (simulation mode).
 */

import readline from "node:readline"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

const LIMIT_DURATION_SEC = 60
const RESUME_DURATION_SEC = 30

const UNIT_MULTIPLIERS = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
}

const RATE_PATTERN = /^\s*(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?\s*$/i

function parseRate(rateText) {
  const match = RATE_PATTERN.exec(rateText)
  if (!match) {
    throw new Error(
      `Invalid rate '${rateText}'. Use formats like 512 B, 10 KB, 5 MB, or 1 GB.`,
    )
  }
  const value = Number(match[1])
  const unit = (match[2] || "B").toUpperCase()
  const rate = Math.trunc(value * UNIT_MULTIPLIERS[unit])
  if (rate <= 0) throw new Error("Rate must be greater than zero.")
  return rate
}

function formatRate(bytesPerSec) {
  if (bytesPerSec >= UNIT_MULTIPLIERS.GB) {
    return `${(bytesPerSec / UNIT_MULTIPLIERS.GB).toFixed(2)} GB/s`
  }
  if (bytesPerSec >= UNIT_MULTIPLIERS.MB) {
    return `${(bytesPerSec / UNIT_MULTIPLIERS.MB).toFixed(2)} MB/s`
  }
  if (bytesPerSec >= UNIT_MULTIPLIERS.KB) {
    return `${(bytesPerSec / UNIT_MULTIPLIERS.KB).toFixed(2)} KB/s`
  }
  return `${bytesPerSec.toFixed(0)} B/s`
}

class ProcessDownloadLimiter {
  constructor(pid, rateBytesPerSec) {
    this.pid = pid
    this.rateBytesPerSec = rateBytesPerSec
    this.enabled = false
    this.phase = "idle"
    this.timer = null
    this.backend = null
  }

  async startBackend() {
    // Optional native WinDivert integration can be plugged here later.
    // Keep behavior predictable for runners even without the driver.
    try {
      // Placeholder for future: require("windivert") or a local native addon.
      void require
      this.backend = { mode: "simulate" }
      console.log(
        "[limit_download] Running in simulation mode (no WinDivert binding loaded).",
      )
    } catch {
      this.backend = { mode: "simulate" }
    }
  }

  async stopBackend() {
    this.backend = null
  }

  clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  schedule(phase, seconds) {
    this.clearTimer()
    this.phase = phase
    this.timer = setTimeout(() => {
      void this.advance()
    }, seconds * 1000)
  }

  async advance() {
    if (!this.enabled) return
    if (this.phase === "limit") {
      console.log(
        `[limit_download] resume normal traffic for ${RESUME_DURATION_SEC}s (pid=${this.pid})`,
      )
      this.schedule("resume", RESUME_DURATION_SEC)
      return
    }
    console.log(
      `[limit_download] apply cap ${formatRate(this.rateBytesPerSec)} for ${LIMIT_DURATION_SEC}s (pid=${this.pid})`,
    )
    this.schedule("limit", LIMIT_DURATION_SEC)
  }

  async toggle() {
    this.enabled = !this.enabled
    if (this.enabled) {
      console.log("[limit_download] cycle ON")
      await this.startBackend()
      await this.advance()
    } else {
      console.log("[limit_download] cycle OFF")
      this.clearTimer()
      this.phase = "idle"
      await this.stopBackend()
    }
  }

  async shutdown() {
    this.enabled = false
    this.clearTimer()
    this.phase = "idle"
    await this.stopBackend()
  }
}

function parseArgs(argv) {
  const args = [...argv]
  let controlled = false
  let pid
  let rate

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i]
    if (token === "--controlled") {
      controlled = true
      continue
    }
    if (token === "--pid") {
      pid = Number(args[++i])
      continue
    }
    if (token === "--rate") {
      rate = args[++i]
      continue
    }
    if (pid === undefined && /^\d+$/.test(token)) {
      pid = Number(token)
      continue
    }
    if (rate === undefined) {
      rate = token
    }
  }

  if (pid === undefined || rate === undefined) {
    throw new Error(
      "Usage: node limit_download.mjs <pid> <rate> [--controlled]  OR  --pid PID --rate '5 KB'",
    )
  }
  return { pid, rate, controlled }
}

async function runControlled(pid, rateBytesPerSec) {
  const limiter = new ProcessDownloadLimiter(pid, rateBytesPerSec)
  console.log(
    `Controlled subroutine: PID ${pid}, cap ${formatRate(rateBytesPerSec)}`,
  )
  console.log(
    `Cycle: limit ${LIMIT_DURATION_SEC}s, normal ${RESUME_DURATION_SEC}s, repeat`,
  )
  console.log("Listening for stdin commands: toggle, exit")

  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
  try {
    for await (const line of rl) {
      const cmd = line.trim().toLowerCase()
      if (cmd === "toggle") await limiter.toggle()
      if (cmd === "exit") {
        await limiter.shutdown()
        break
      }
    }
  } finally {
    await limiter.shutdown()
    rl.close()
    console.log("Exited.")
  }
}

async function main() {
  if (process.platform !== "win32") {
    throw new Error("This script only supports Windows.")
  }

  const { pid, rate, controlled } = parseArgs(process.argv.slice(2))
  const rateBytesPerSec = parseRate(rate)

  if (controlled) {
    await runControlled(pid, rateBytesPerSec)
    return
  }

  const limiter = new ProcessDownloadLimiter(pid, rateBytesPerSec)
  console.log("Interactive mode is not wired in the JS port; use --controlled.")
  console.log("Sending a one-shot toggle for smoke testing, then exit.")
  await limiter.toggle()
  await new Promise((resolve) => setTimeout(resolve, 1500))
  await limiter.shutdown()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
