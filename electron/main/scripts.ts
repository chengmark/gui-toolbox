import fs from 'node:fs/promises'
import path from 'node:path'
import { getScriptsDir } from './paths'

export type ScriptEntry = {
  filename: string
  name: string
  toggle?: string
}

const SCRIPT_SCHEMA_VERSION = 1

const COMMAND_ALIASES: Record<string, string> = {
  run_script: 'RunScript',
}

export { getScriptsDir }

function scriptPath(filename: string): string {
  const base = path.basename(filename)
  if (base !== filename || base.includes('..')) {
    throw new Error('Invalid script filename')
  }
  return path.join(getScriptsDir(), base)
}

function normalizeFilename(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Filename cannot be empty')
  }
  if (/[\\/]/.test(trimmed) || trimmed.includes('..')) {
    throw new Error('Invalid script filename')
  }
  return trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`
}

function normalizeSteps(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined
  const steps = value.map((item) => {
    if (!item || typeof item !== 'object') {
      return { command: 'Delay', args: [100] }
    }
    const step = item as Record<string, unknown>
    const commandRaw = typeof step.command === 'string' ? step.command : 'Delay'
    return {
      command: COMMAND_ALIASES[commandRaw] ?? commandRaw,
      args: Array.isArray(step.args) ? step.args : [],
    }
  })
  return steps.length ? steps : undefined
}

function normalizeSubroutines(value: unknown): unknown[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const result: unknown[] = []

  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>

    if (entry.kind === 'process' || typeof entry.file === 'string') {
      const file = typeof entry.file === 'string' ? entry.file.replace(/\.py$/i, '.mjs') : ''
      const next: Record<string, unknown> = { kind: 'process', file }
      if (Array.isArray(entry.args) && entry.args.length) next.args = entry.args
      result.push(next)
      continue
    }

    if (entry.kind === 'inline' || typeof entry.script === 'string') {
      const next: Record<string, unknown> = {
        kind: 'inline',
        id:
          (typeof entry.id === 'string' && entry.id) ||
          (typeof entry.script === 'string' && entry.script) ||
          'subroutine',
      }
      const initial = normalizeSteps(entry.initial)
      const loop = normalizeSteps(entry.loop ?? entry.steps)
      if (initial) next.initial = initial
      if (loop) next.loop = loop
      result.push(next)
    }
  }

  return result.length ? result : undefined
}

export function normalizeScriptDocument(
  raw: Record<string, unknown>,
  fallbackName: string,
): Record<string, unknown> {
  const name =
    (typeof raw.name === 'string' && raw.name.trim()) ||
    (typeof raw.description === 'string' && raw.description.trim()) ||
    fallbackName

  const doc: Record<string, unknown> = {
    schemaVersion: SCRIPT_SCHEMA_VERSION,
    name,
  }

  if (typeof raw.toggle === 'string' && raw.toggle.trim()) {
    doc.toggle = raw.toggle.trim()
  }
  // Legacy `trigger` is stripped — Scripts are toggle-only.

  const initial = normalizeSteps(raw.initial)
  const loop = normalizeSteps(raw.loop ?? raw.steps)
  const background = normalizeSteps(raw.background)
  const subroutines = normalizeSubroutines(raw.subroutines ?? raw.scripts)

  if (initial) doc.initial = initial
  if (loop) doc.loop = loop
  if (background) doc.background = background
  if (subroutines) doc.subroutines = subroutines

  return doc
}

function displayName(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.name === 'string' && data.name.trim()) return data.name
  if (typeof data.description === 'string' && data.description.trim()) return data.description
  return fallback
}

function optionalBind(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function toScriptEntry(
  filename: string,
  data: Record<string, unknown>,
): ScriptEntry {
  return {
    filename,
    name: displayName(data, filename),
    toggle: optionalBind(data.toggle),
  }
}

export async function listScripts(): Promise<ScriptEntry[]> {
  const dir = getScriptsDir()
  await fs.mkdir(dir, { recursive: true })

  const names = await fs.readdir(dir)
  const entries: ScriptEntry[] = []

  for (const name of names.sort((a, b) => a.localeCompare(b))) {
    if (!name.toLowerCase().endsWith('.json')) continue
    const fullPath = path.join(dir, name)
    const stat = await fs.stat(fullPath)
    if (!stat.isFile()) continue

    let data: Record<string, unknown> = {}
    try {
      const raw = await fs.readFile(fullPath, 'utf8')
      data = JSON.parse(raw) as Record<string, unknown>
    } catch {
      // keep filename fallback
    }

    entries.push(toScriptEntry(name, data))
  }

  entries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )

  return entries
}

export async function updateScriptName(
  filename: string,
  name: string,
): Promise<ScriptEntry> {
  const fullPath = scriptPath(filename)
  const raw = await fs.readFile(fullPath, 'utf8')
  const data = JSON.parse(raw) as Record<string, unknown>
  const normalized = normalizeScriptDocument(data, path.basename(fullPath, '.json'))
  normalized.name = name
  await fs.writeFile(fullPath, `${JSON.stringify(normalized, null, 4)}\n`, 'utf8')
  return toScriptEntry(path.basename(fullPath), normalized)
}

/** @deprecated use updateScriptName */
export async function updateScriptDescription(
  filename: string,
  description: string,
): Promise<ScriptEntry> {
  return updateScriptName(filename, description)
}

export async function renameScript(
  filename: string,
  nextFilename: string,
): Promise<ScriptEntry> {
  const currentPath = scriptPath(filename)
  const normalizedName = normalizeFilename(nextFilename)
  const nextPath = scriptPath(normalizedName)

  if (path.resolve(currentPath) === path.resolve(nextPath)) {
    const raw = await fs.readFile(currentPath, 'utf8')
    const data = JSON.parse(raw) as Record<string, unknown>
    return toScriptEntry(path.basename(currentPath), data)
  }

  try {
    await fs.access(nextPath)
    throw new Error(`Script already exists: ${normalizedName}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  await fs.rename(currentPath, nextPath)

  const raw = await fs.readFile(nextPath, 'utf8')
  const data = JSON.parse(raw) as Record<string, unknown>
  return toScriptEntry(normalizedName, data)
}

export async function deleteScript(filename: string): Promise<void> {
  await fs.unlink(scriptPath(filename))
}

export async function readScript(filename: string): Promise<{
  filename: string
  content: Record<string, unknown>
}> {
  const fullPath = scriptPath(filename)
  const raw = await fs.readFile(fullPath, 'utf8')
  const data = JSON.parse(raw) as Record<string, unknown>
  const content = normalizeScriptDocument(data, path.basename(fullPath, '.json'))
  return { filename: path.basename(fullPath), content }
}

export async function writeScript(
  filename: string,
  content: Record<string, unknown>,
): Promise<ScriptEntry> {
  const fullPath = scriptPath(filename)
  const normalized = normalizeScriptDocument(
    content,
    path.basename(fullPath, '.json'),
  )
  await fs.writeFile(fullPath, `${JSON.stringify(normalized, null, 4)}\n`, 'utf8')
  return toScriptEntry(path.basename(fullPath), normalized)
}
