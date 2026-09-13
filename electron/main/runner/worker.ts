import { runSteps } from './handlers'
import type { RunnerContext, ScriptStep } from './types'
import { sleep } from './utils'

export async function workerLoop(
  initial: ScriptStep[],
  loop: ScriptStep[],
  ctx: RunnerContext,
  shouldContinue: () => boolean,
): Promise<void> {
  while (shouldContinue() && !ctx.exiting) {
    if (!ctx.running) {
      await sleep(50)
      continue
    }

    try {
      if (initial.length && !(await runSteps(initial, ctx))) {
        continue
      }

      while (shouldContinue() && !ctx.exiting && ctx.running) {
        if (!(await runSteps(loop, ctx))) break
        // Yield so toggle/hotkeys can breathe between loop iterations.
        await sleep(1)
      }
    } catch (error) {
      console.warn('[runner] Worker loop error:', error)
      await sleep(100)
    }
  }
}
