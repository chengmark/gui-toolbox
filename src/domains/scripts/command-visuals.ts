export type CommandCategory = "timing" | "keyboard" | "mouse" | "script" | "audio" | "other"

export const COMMAND_CATEGORY: Record<string, CommandCategory> = {
  Delay: "timing",
  KeyPress: "keyboard",
  KeyDown: "keyboard",
  KeyUp: "keyboard",
  KeyHoldAndRelease: "keyboard",
  MouseClick: "mouse",
  MouseMove: "mouse",
  MouseMoveTo: "mouse",
  ClickOn: "mouse",
  ImportScript: "script",
  Script: "script",
  RunScript: "script",
  SetVolume: "audio",
  ToggleMute: "audio",
}

export const CATEGORY_ACCENT: Record<
  CommandCategory,
  { icon: string; ring: string; soft: string }
> = {
  timing: {
    icon: "text-sky-300",
    ring: "ring-sky-500/30",
    soft: "bg-sky-500/10",
  },
  keyboard: {
    icon: "text-cyan-300",
    ring: "ring-cyan-500/30",
    soft: "bg-cyan-500/10",
  },
  mouse: {
    icon: "text-orange-300",
    ring: "ring-orange-500/30",
    soft: "bg-orange-500/10",
  },
  script: {
    icon: "text-emerald-300",
    ring: "ring-emerald-500/30",
    soft: "bg-emerald-500/10",
  },
  audio: {
    icon: "text-amber-300",
    ring: "ring-amber-500/30",
    soft: "bg-amber-500/10",
  },
  other: {
    icon: "text-muted-foreground",
    ring: "ring-border",
    soft: "bg-muted/40",
  },
}

export function commandCategory(command: string): CommandCategory {
  return COMMAND_CATEGORY[command] ?? "other"
}
