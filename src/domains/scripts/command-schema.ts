import { SCRIPT_COMMANDS, type ScriptStep } from "@/domains/scripts/model"

export type ArgFieldType = "number" | "text" | "keybind" | "mouseButton" | "select"

export type CommandArgField = {
  key: string
  label: string
  type: ArgFieldType
  required?: boolean
  /** Index in the args array */
  index: number
  placeholder?: string
  hint?: string
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string; label: string }>
  /** Default when creating / switching command */
  defaultValue?: string | number
}

export type CommandSchema = {
  command: (typeof SCRIPT_COMMANDS)[number] | string
  summary: string
  args: CommandArgField[]
}

const MOUSE_BUTTON_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "middle", label: "Middle" },
]

export const COMMAND_SCHEMAS: Record<string, CommandSchema> = {
  Delay: {
    command: "Delay",
    summary: "Wait before the next step",
    args: [
      {
        key: "ms",
        label: "Duration (ms)",
        type: "number",
        required: true,
        index: 0,
        placeholder: "100",
        hint: "Milliseconds to wait",
        min: 0,
        step: 1,
        defaultValue: 100,
      },
    ],
  },
  KeyPress: {
    command: "KeyPress",
    summary: "Press and release a key",
    args: [
      {
        key: "key",
        label: "Key",
        type: "keybind",
        required: true,
        index: 0,
        placeholder: "Space",
        hint: "Record or type a key name",
        defaultValue: "",
      },
      {
        key: "times",
        label: "Times",
        type: "number",
        index: 1,
        placeholder: "1",
        min: 1,
        step: 1,
        defaultValue: 1,
      },
      {
        key: "interval",
        label: "Interval (ms)",
        type: "number",
        index: 2,
        placeholder: "0",
        hint: "Delay between repeats",
        min: 0,
        step: 1,
        defaultValue: 0,
      },
    ],
  },
  KeyDown: {
    command: "KeyDown",
    summary: "Hold a key down",
    args: [
      {
        key: "key",
        label: "Key",
        type: "keybind",
        required: true,
        index: 0,
        defaultValue: "",
      },
      {
        key: "times",
        label: "Times",
        type: "number",
        index: 1,
        placeholder: "1",
        min: 1,
        step: 1,
        defaultValue: 1,
      },
    ],
  },
  KeyUp: {
    command: "KeyUp",
    summary: "Release a key",
    args: [
      {
        key: "key",
        label: "Key",
        type: "keybind",
        required: true,
        index: 0,
        defaultValue: "",
      },
      {
        key: "times",
        label: "Times",
        type: "number",
        index: 1,
        placeholder: "1",
        min: 1,
        step: 1,
        defaultValue: 1,
      },
    ],
  },
  KeyHoldAndRelease: {
    command: "KeyHoldAndRelease",
    summary: "Hold a key for a duration",
    args: [
      {
        key: "key",
        label: "Key",
        type: "keybind",
        required: true,
        index: 0,
        defaultValue: "",
      },
      {
        key: "seconds",
        label: "Hold (seconds)",
        type: "number",
        required: true,
        index: 1,
        placeholder: "1",
        min: 0,
        step: 0.1,
        defaultValue: 1,
      },
    ],
  },
  MouseClick: {
    command: "MouseClick",
    summary: "Click a mouse button",
    args: [
      {
        key: "button",
        label: "Button",
        type: "mouseButton",
        required: true,
        index: 0,
        options: MOUSE_BUTTON_OPTIONS,
        defaultValue: "left",
      },
      {
        key: "times",
        label: "Times",
        type: "number",
        index: 1,
        placeholder: "1",
        min: 1,
        step: 1,
        defaultValue: 1,
      },
    ],
  },
  MouseMove: {
    command: "MouseMove",
    summary: "Move mouse relatively",
    args: [
      {
        key: "dx",
        label: "Delta X",
        type: "number",
        required: true,
        index: 0,
        placeholder: "0",
        step: 1,
        defaultValue: 0,
      },
      {
        key: "dy",
        label: "Delta Y",
        type: "number",
        required: true,
        index: 1,
        placeholder: "0",
        step: 1,
        defaultValue: 0,
      },
    ],
  },
  MouseMoveTo: {
    command: "MouseMoveTo",
    summary: "Move mouse to absolute position",
    args: [
      {
        key: "x",
        label: "X",
        type: "number",
        required: true,
        index: 0,
        placeholder: "0",
        step: 1,
        defaultValue: 0,
      },
      {
        key: "y",
        label: "Y",
        type: "number",
        required: true,
        index: 1,
        placeholder: "0",
        step: 1,
        defaultValue: 0,
      },
    ],
  },
  ClickOn: {
    command: "ClickOn",
    summary: "Move to position and click",
    args: [
      {
        key: "x",
        label: "X",
        type: "number",
        required: true,
        index: 0,
        defaultValue: 0,
      },
      {
        key: "y",
        label: "Y",
        type: "number",
        required: true,
        index: 1,
        defaultValue: 0,
      },
      {
        key: "button",
        label: "Button",
        type: "mouseButton",
        index: 2,
        options: MOUSE_BUTTON_OPTIONS,
        defaultValue: "left",
      },
    ],
  },
  ImportScript: {
    command: "ImportScript",
    summary: "Run another script file once",
    args: [
      {
        key: "file",
        label: "Script file",
        type: "text",
        required: true,
        index: 0,
        placeholder: "other.json",
        defaultValue: "",
      },
    ],
  },
  Script: {
    command: "Script",
    summary: "Start a process subroutine file",
    args: [
      {
        key: "file",
        label: "Module file",
        type: "text",
        required: true,
        index: 0,
        placeholder: "limit_download.mjs",
        defaultValue: "",
      },
    ],
  },
  RunScript: {
    command: "RunScript",
    summary: "Run an inline subroutine by id",
    args: [
      {
        key: "id",
        label: "Subroutine id",
        type: "text",
        required: true,
        index: 0,
        placeholder: "combo",
        defaultValue: "",
      },
    ],
  },
  SetVolume: {
    command: "SetVolume",
    summary: "Bind a trigger to set master volume",
    args: [
      {
        key: "trigger",
        label: "Trigger",
        type: "keybind",
        required: true,
        index: 0,
        placeholder: "MB4",
        hint: "Key or mouse button (MB1–MB5)",
        defaultValue: "",
      },
      {
        key: "volume",
        label: "Volume (0–1)",
        type: "number",
        required: true,
        index: 1,
        placeholder: "0.5",
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.5,
      },
    ],
  },
  ToggleMute: {
    command: "ToggleMute",
    summary: "Bind a trigger to toggle mute",
    args: [
      {
        key: "trigger",
        label: "Trigger",
        type: "keybind",
        required: true,
        index: 0,
        placeholder: "MB5",
        hint: "Key or mouse button (MB1–MB5)",
        defaultValue: "",
      },
    ],
  },
}

export function getCommandSchema(command: string): CommandSchema {
  return (
    COMMAND_SCHEMAS[command] ?? {
      command,
      summary: "Custom command",
      args: [],
    }
  )
}

export function defaultArgsFor(command: string): unknown[] {
  const schema = getCommandSchema(command)
  if (!schema.args.length) return []
  const maxIndex = Math.max(...schema.args.map((field) => field.index))
  const args: unknown[] = Array.from({ length: maxIndex + 1 }, () => "")
  for (const field of schema.args) {
    args[field.index] = field.defaultValue ?? (field.type === "number" ? 0 : "")
  }
  return trimTrailingOptionalDefaults(schema, args)
}

function trimTrailingOptionalDefaults(
  schema: CommandSchema,
  args: unknown[],
): unknown[] {
  const next = [...args]
  // Keep required values; drop trailing optional empties/zeros that match defaults
  // when only defaults exist after last required.
  while (next.length > 0) {
    const lastIndex = next.length - 1
    const field = schema.args.find((item) => item.index === lastIndex)
    if (!field || field.required) break
    const value = next[lastIndex]
    if (
      value === "" ||
      value === field.defaultValue ||
      (field.type === "number" && Number(value) === Number(field.defaultValue ?? 0))
    ) {
      // Keep optional defaults that are meaningful for the runner (e.g. times=1)
      // Only trim truly empty strings for optional text/keybind.
      if (field.type === "text" || field.type === "keybind") {
        if (value === "" || value == null) {
          next.pop()
          continue
        }
      }
    }
    break
  }
  return next
}

export function setArgValue(
  command: string,
  args: unknown[],
  field: CommandArgField,
  raw: string,
): unknown[] {
  const schema = getCommandSchema(command)
  const maxIndex = Math.max(
    args.length - 1,
    ...schema.args.map((item) => item.index),
    field.index,
  )
  const next: unknown[] = Array.from({ length: maxIndex + 1 }, (_, i) =>
    i < args.length ? args[i] : schema.args.find((f) => f.index === i)?.defaultValue ?? "",
  )

  if (field.type === "number") {
    const trimmed = raw.trim()
    if (trimmed === "") {
      next[field.index] = ""
    } else {
      const num = Number(trimmed)
      next[field.index] = Number.isFinite(num) ? num : raw
    }
  } else {
    next[field.index] = raw
  }

  return compactArgs(schema, next)
}

function compactArgs(schema: CommandSchema, args: unknown[]): unknown[] {
  const requiredMax = schema.args
    .filter((field) => field.required)
    .reduce((max, field) => Math.max(max, field.index), -1)
  let end = Math.max(requiredMax, args.length - 1)
  while (end > requiredMax) {
    const value = args[end]
    const field = schema.args.find((item) => item.index === end)
    if (value === "" || value == null) {
      end -= 1
      continue
    }
    if (
      field &&
      !field.required &&
      field.defaultValue !== undefined &&
      value === field.defaultValue
    ) {
      // keep non-empty optional defaults (times etc.) — stop compacting
      break
    }
    break
  }
  return args.slice(0, end + 1)
}

export type ArgValidation = {
  valid: boolean
  errors: Record<string, string>
}

export function validateStepArgs(step: ScriptStep): ArgValidation {
  const schema = getCommandSchema(step.command)
  const errors: Record<string, string> = {}

  for (const field of schema.args) {
    const value = step.args[field.index]
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "")

    if (field.required && empty) {
      errors[field.key] = "Required"
      continue
    }
    if (empty) continue

    if (field.type === "number") {
      const num = typeof value === "number" ? value : Number(value)
      if (!Number.isFinite(num)) {
        errors[field.key] = "Must be a number"
        continue
      }
      if (field.min !== undefined && num < field.min) {
        errors[field.key] = `Min ${field.min}`
      }
      if (field.max !== undefined && num > field.max) {
        errors[field.key] = `Max ${field.max}`
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export function summarizeStepArgs(step: ScriptStep): string {
  const schema = getCommandSchema(step.command)
  if (!schema.args.length) {
    return step.args.length ? step.args.map(String).join(", ") : "No args"
  }
  const parts = schema.args
    .map((field) => {
      const value = step.args[field.index]
      if (value === undefined || value === null || value === "") return null
      return `${field.label}: ${String(value)}`
    })
    .filter(Boolean)
  return parts.length ? parts.join(" · ") : "No args set"
}

/** Short human-readable line for step list rows. */
export function briefStepDescription(step: ScriptStep): string {
  const a = step.args
  const key = String(a[0] ?? "").trim() || "?"

  switch (step.command) {
    case "Delay":
      return `Delay ${a[0] == null || a[0] === "" ? "—" : String(a[0])}ms`
    case "KeyPress": {
      const times = Number(a[1] ?? 1)
      return times > 1 ? `Press ${key} ×${times}` : `Press ${key}`
    }
    case "KeyDown":
      return `Key down ${key}`
    case "KeyUp":
      return `Key up ${key}`
    case "KeyHoldAndRelease":
      return `Hold ${key} ${a[1] == null || a[1] === "" ? "?" : String(a[1])}s`
    case "MouseClick": {
      const button = String(a[0] ?? "left")
      const times = Number(a[1] ?? 1)
      return times > 1 ? `Click ${button} ×${times}` : `Click ${button}`
    }
    case "MouseMove":
      return `Move by (${a[0] ?? "?"}, ${a[1] ?? "?"})`
    case "MouseMoveTo":
      return `Move to (${a[0] ?? "?"}, ${a[1] ?? "?"})`
    case "ClickOn":
      return `Click (${a[0] ?? "?"}, ${a[1] ?? "?"}) ${String(a[2] ?? "left")}`
    case "ImportScript":
      return `Import ${String(a[0] ?? "").trim() || "?"}`
    case "RunScript":
      return `Run ${String(a[0] ?? "").trim() || "?"}`
    case "SetVolume":
      return `Volume ${a[1] ?? "?"} on ${String(a[0] ?? "").trim() || "?"}`
    case "ToggleMute":
      return `Mute toggle on ${String(a[0] ?? "").trim() || "?"}`
    default:
      return summarizeStepArgs(step)
  }
}

export function createStepForCommand(command: string): ScriptStep {
  return {
    command,
    args: defaultArgsFor(command),
  }
}
