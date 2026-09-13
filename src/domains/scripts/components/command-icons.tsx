import type { ReactNode, SVGProps } from "react"
import { cn } from "@/shared/lib/utils"

export const COMMAND_ICON_SIZE = "size-8"

type IconProps = SVGProps<SVGSVGElement> & {
  className?: string
}

/** Shared frame: every glyph is drawn inside ~6–26 so optical size matches. */
function BaseIcon({ className, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className={cn("block size-8 shrink-0 overflow-visible", className)}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

/** Hourglass / wait */
export function DelayIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 7h14M9 25h14" {...stroke} />
      <path d="M10 7c0 4.5 3.5 6.5 6 9-2.5 2.5-6 4.5-6 9" {...stroke} />
      <path d="M22 7c0 4.5-3.5 6.5-6 9 2.5 2.5 6 4.5 6 9" {...stroke} />
      <path d="M12.5 16h7" {...stroke} />
    </BaseIcon>
  )
}

/** Key cap press */
export function KeyPressIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="7" y="8" width="18" height="12" rx="2.5" {...stroke} />
      <path d="M11 14h10" {...stroke} />
      <path d="M16 22v3M12.5 26h7" {...stroke} />
    </BaseIcon>
  )
}

/** Key down */
export function KeyDownIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="8" y="6" width="16" height="10" rx="2" {...stroke} />
      <path d="M12 11h8" {...stroke} />
      <path d="M16 18v7M12 22l4 4 4-4" {...stroke} />
    </BaseIcon>
  )
}

/** Key up */
export function KeyUpIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M16 7v7M12 11l4-4 4 4" {...stroke} />
      <rect x="8" y="16" width="16" height="10" rx="2" {...stroke} />
      <path d="M12 21h8" {...stroke} />
    </BaseIcon>
  )
}

/** Hold key then release */
export function KeyHoldAndReleaseIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="7" y="8" width="18" height="11" rx="2.5" {...stroke} />
      <path d="M11 13.5h10" {...stroke} />
      <path d="M9 24h14" {...stroke} strokeDasharray="2.5 2" />
      <circle cx="9" cy="24" r="1.5" fill="currentColor" />
      <circle cx="23" cy="24" r="1.5" fill="currentColor" />
    </BaseIcon>
  )
}

type MouseIconProps = IconProps & {
  button?: "left" | "right" | "middle" | string
}

/** Mouse body — centered in the same 32 box as other icons */
export function MouseClickIcon({ button = "left", ...props }: MouseIconProps) {
  const left = button === "left"
  const right = button === "right"
  const middle = button === "middle"
  return (
    <BaseIcon {...props}>
      <rect x="10" y="5" width="12" height="22" rx="6" {...stroke} />
      <path d="M16 5v8.5M10 13.5h12" {...stroke} strokeWidth={1.5} />
      {left ? <path d="M10 5h6v8.5h-6Z" fill="currentColor" /> : null}
      {right ? <path d="M16 5h6v8.5h-6Z" fill="currentColor" /> : null}
      {middle ? <rect x="14.25" y="6.5" width="3.5" height="5" rx="1.2" fill="currentColor" /> : null}
      {!left && !right && !middle ? (
        <rect
          x="14.25"
          y="6.5"
          width="3.5"
          height="5"
          rx="1.2"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      ) : null}
    </BaseIcon>
  )
}

/** Relative mouse move */
export function MouseMoveIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="11" y="8" width="10" height="14" rx="5" {...stroke} />
      <path d="M16 8v5.5" {...stroke} strokeWidth={1.5} />
      <path d="M6 15H4M28 15h-2" {...stroke} />
      <path d="M5.5 12.5L3 15l2.5 2.5M26.5 12.5L29 15l-2.5 2.5" {...stroke} />
      <path d="M16 24v3" {...stroke} />
    </BaseIcon>
  )
}

/** Absolute move-to */
export function MouseMoveToIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="16" cy="16" r="5" {...stroke} />
      <path d="M16 6v4M16 22v4M6 16h4M22 16h4" {...stroke} />
      <circle cx="16" cy="16" r="1.6" fill="currentColor" />
    </BaseIcon>
  )
}

/** Click at coordinates */
export function ClickOnIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 8l3 9 3.5-3.5 5 8" {...stroke} />
      <path d="M10 8l8 4-5 2.2" {...stroke} />
      <circle cx="23" cy="23" r="3.2" {...stroke} />
      <path d="M23 20.8V23l1.7 1.7" {...stroke} strokeWidth={1.5} />
    </BaseIcon>
  )
}

/** Import external script */
export function ImportScriptIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M14 7H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V13" {...stroke} />
      <path d="M18 7h4l4 4v2" {...stroke} />
      <path d="M8 14V8l4 4M8 8l-4 4" {...stroke} />
    </BaseIcon>
  )
}

/** Process/script module */
export function ScriptIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10 6h8l5 5v13a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" {...stroke} />
      <path d="M18 6v5h5" {...stroke} />
      <path d="M12 16h8M12 20h5" {...stroke} />
    </BaseIcon>
  )
}

/** Run subroutine */
export function RunScriptIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="6" y="7" width="12" height="18" rx="2" {...stroke} />
      <path d="M9 12h6M9 16h5M9 20h5.5" {...stroke} strokeWidth={1.5} />
      <path d="M21 12.5l6 3.5-6 3.5v-7Z" fill="currentColor" />
    </BaseIcon>
  )
}

/** Set volume */
export function SetVolumeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 13h3.5L16 8v16l-5.5-5H7v-6Z" {...stroke} />
      <path d="M19.5 12c1.3 1.2 1.3 6.6 0 7.8M23 10c2.1 2.2 2.1 9.6 0 11.8" {...stroke} />
    </BaseIcon>
  )
}

/** Toggle mute */
export function ToggleMuteIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 13h3.5L16 8v16l-5.5-5H7v-6Z" {...stroke} />
      <path d="M20 11.5l6 9M26 11.5l-6 9" {...stroke} />
    </BaseIcon>
  )
}

const COMMAND_ICONS = {
  Delay: DelayIcon,
  KeyPress: KeyPressIcon,
  KeyDown: KeyDownIcon,
  KeyUp: KeyUpIcon,
  KeyHoldAndRelease: KeyHoldAndReleaseIcon,
  MouseClick: MouseClickIcon,
  MouseMove: MouseMoveIcon,
  MouseMoveTo: MouseMoveToIcon,
  ClickOn: ClickOnIcon,
  ImportScript: ImportScriptIcon,
  Script: ScriptIcon,
  RunScript: RunScriptIcon,
  SetVolume: SetVolumeIcon,
  ToggleMute: ToggleMuteIcon,
} as const

export function CommandIcon({
  command,
  button,
  className,
  ...props
}: IconProps & {
  command: string
  button?: string
}) {
  const Icon = COMMAND_ICONS[command as keyof typeof COMMAND_ICONS]
  if (!Icon) {
    return <ScriptIcon className={className} {...props} />
  }
  if (command === "MouseClick" || command === "ClickOn") {
    return <MouseClickIcon className={className} button={button} {...props} />
  }
  return <Icon className={className} {...props} />
}

export { COMMAND_ICONS }
