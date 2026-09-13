/**
 * Canonical script document schema for gui-toolbox.
 *
 * Scripts are toggle-controlled: toggle on runs the loop until toggle off
 * (or a step-defined stop condition). One-shot press binds belong in Keybinds.
 *
 * {
 *   schemaVersion: 1,
 *   name: string,
 *   toggle?: string,
 *   initial?: Step[],
 *   loop?: Step[],
 *   background?: Step[],
 *   subroutines?: Subroutine[]
 * }
 *
 * Step: { command: PascalCase, args: unknown[] }
 * Subroutine:
 *   | { kind: "process", file: string, args?: unknown[] }
 *   | { kind: "inline", id: string, initial?: Step[], loop?: Step[] }
 */

export type ScriptItem = {
  id: string
  filename: string
  name: string
  toggle?: string
}

export type PendingDelete = {
  filename: string
  name: string
}

/** Sort normally, then stable-push favorites to the top. */
export function withFavoritesFirst<T extends { filename: string }>(
  sorted: T[],
  favorites: ReadonlySet<string>,
): T[] {
  const favs: T[] = []
  const rest: T[] = []
  for (const item of sorted) {
    if (favorites.has(item.filename)) favs.push(item)
    else rest.push(item)
  }
  return [...favs, ...rest]
}

export type ScriptStep = {
  command: string
  args: unknown[]
}

export type ProcessSubroutine = {
  kind: "process"
  file: string
  args?: unknown[]
}

export type InlineSubroutine = {
  kind: "inline"
  id: string
  initial?: ScriptStep[]
  loop?: ScriptStep[]
}

export type ScriptSubroutine = ProcessSubroutine | InlineSubroutine

export type ScriptDocument = {
  schemaVersion: 1
  name: string
  toggle?: string
  initial?: ScriptStep[]
  loop?: ScriptStep[]
  background?: ScriptStep[]
  subroutines?: ScriptSubroutine[]
}

export const SCRIPT_SCHEMA_VERSION = 1 as const

export const SCRIPT_COMMANDS = [
  "Delay",
  "KeyPress",
  "KeyDown",
  "KeyUp",
  "KeyHoldAndRelease",
  "MouseClick",
  "MouseMove",
  "MouseMoveTo",
  "ClickOn",
  "ImportScript",
  "Script",
  "RunScript",
  "SetVolume",
  "ToggleMute",
] as const

const COMMAND_ALIASES: Record<string, string> = {
  run_script: "RunScript",
  Run_Script: "RunScript",
}

export type ScriptSectionKey = "initial" | "loop" | "background"

export function createScriptId(filename: string) {
  return `${filename}:${Math.random().toString(36).slice(2, 9)}`
}

export function createEmptyStep(): ScriptStep {
  return { command: "Delay", args: [100] }
}

export function createEmptyProcessSubroutine(): ProcessSubroutine {
  return { kind: "process", file: "", args: [] }
}

export function createEmptyInlineSubroutine(): InlineSubroutine {
  return { kind: "inline", id: "subroutine", loop: [] }
}

export function normalizeCommand(command: string): string {
  return COMMAND_ALIASES[command] ?? command
}

export function normalizeSteps(value: unknown): ScriptStep[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    if (!item || typeof item !== "object") return createEmptyStep()
    const step = item as Record<string, unknown>
    return {
      command: normalizeCommand(
        typeof step.command === "string" ? step.command : "Delay",
      ),
      args: Array.isArray(step.args) ? [...step.args] : [],
    }
  })
}

function normalizeSubroutines(value: unknown): ScriptSubroutine[] {
  if (!Array.isArray(value)) return []
  const result: ScriptSubroutine[] = []

  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const entry = item as Record<string, unknown>

    if (entry.kind === "process" || typeof entry.file === "string") {
      const file = typeof entry.file === "string" ? entry.file : ""
      // Migrate legacy .py references to .mjs companions when present.
      const migratedFile = file.replace(/\.py$/i, ".mjs")
      result.push({
        kind: "process",
        file: migratedFile,
        args: Array.isArray(entry.args) ? [...entry.args] : [],
      })
      continue
    }

    if (entry.kind === "inline" || typeof entry.script === "string") {
      const id =
        typeof entry.id === "string"
          ? entry.id
          : typeof entry.script === "string"
            ? entry.script
            : "subroutine"
      result.push({
        kind: "inline",
        id,
        initial: normalizeSteps(entry.initial),
        loop: normalizeSteps(entry.loop ?? entry.steps),
      })
    }
  }

  return result
}

/** Normalize legacy or partial JSON into the canonical ScriptDocument. */
export function normalizeScriptDocument(
  raw: Record<string, unknown>,
  fallbackName: string,
): ScriptDocument {
  const nameFromLegacy =
    (typeof raw.name === "string" && raw.name.trim() && raw.name) ||
    (typeof raw.description === "string" && raw.description.trim() && raw.description) ||
    fallbackName

  const loop = normalizeSteps(raw.loop ?? raw.steps)
  const initial = normalizeSteps(raw.initial)
  const background = normalizeSteps(raw.background)
  const subroutines = normalizeSubroutines(raw.subroutines ?? raw.scripts)

  const doc: ScriptDocument = {
    schemaVersion: SCRIPT_SCHEMA_VERSION,
    name: nameFromLegacy,
  }

  if (typeof raw.toggle === "string" && raw.toggle.trim()) {
    doc.toggle = raw.toggle.trim()
  }
  // Legacy `trigger` is ignored — Scripts are toggle-only; one-shots use Keybinds.
  if (initial.length) doc.initial = initial
  if (loop.length) doc.loop = loop
  if (background.length) doc.background = background
  if (subroutines.length) doc.subroutines = subroutines

  return doc
}

export function displayNameOf(doc: Record<string, unknown>, fallback: string): string {
  if (typeof doc.name === "string" && doc.name.trim()) return doc.name
  if (typeof doc.description === "string" && doc.description.trim()) return doc.description
  return fallback
}

export function parseArgsInput(value: string): unknown[] {
  const trimmed = value.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) return parsed
    return [parsed]
  } catch {
    return trimmed.split(",").map((part) => {
      const token = part.trim()
      if (token === "") return ""
      if (token === "true") return true
      if (token === "false") return false
      const asNumber = Number(token)
      if (!Number.isNaN(asNumber) && token !== "") return asNumber
      return token
    })
  }
}

export function formatArgsInput(args: unknown[]): string {
  try {
    return JSON.stringify(args)
  } catch {
    return "[]"
  }
}
