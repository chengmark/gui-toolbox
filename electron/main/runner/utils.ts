import type { RunnerContext } from './types'

export function toInt(value: unknown, fallback = 1): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export function toFloat(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Sleep that aborts early when the runner context is stopped. */
export async function sleepInterruptible(
  ctx: RunnerContext,
  seconds: number,
): Promise<void> {
  if (seconds <= 0) return
  const end = Date.now() + seconds * 1000
  while (Date.now() < end) {
    if (ctx.exiting || !ctx.running) return
    const remaining = end - Date.now()
    await sleep(Math.min(50, remaining))
  }
}
