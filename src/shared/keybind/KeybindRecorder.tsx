import { Keyboard } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { cn } from "@/shared/lib/utils"
import { useI18n } from "@/shared/i18n"
import { formatKeybindLabel } from "@/shared/keybind/model"
import { useKeybindRecording } from "@/shared/keybind/useKeybindRecording"

export type KeybindRecorderProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  className?: string
  /** Visual density / surface. */
  variant?: "default" | "editor"
}

export function KeybindRecorder({
  value,
  onChange,
  placeholder,
  invalid = false,
  disabled = false,
  className,
  variant = "default",
}: KeybindRecorderProps) {
  const { t } = useI18n()
  const resolvedPlaceholder = placeholder ?? t("common.clickRecord")
  const { recording, toggle, stop } = useKeybindRecording({
    enabled: !disabled,
    onRecord: onChange,
  })

  return (
    <div
      className={cn(
        "flex h-9 items-center gap-1 rounded-md border px-1.5 transition-colors",
        variant === "editor"
          ? "rounded-lg border-white/8 bg-[#222]"
          : "border-input bg-transparent dark:bg-input/30",
        invalid && "border-destructive",
        recording && "border-primary ring-1 ring-primary/40",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <input
        value={recording ? "" : value}
        spellCheck={false}
        disabled={disabled || recording}
        placeholder={
          recording
            ? t("common.recordingHint")
            : value
              ? formatKeybindLabel(value)
              : resolvedPlaceholder
        }
        className="h-full min-w-0 flex-1 bg-transparent px-2 font-mono text-[12px] text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-default"
        aria-invalid={invalid || undefined}
        title={value ? formatKeybindLabel(value) : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => {
          const next = event.target.value.trim()
          if (next !== value) onChange(next)
        }}
      />
      <Button
        type="button"
        size="xs"
        variant={recording ? "default" : "secondary"}
        data-keybind-record=""
        className="shrink-0 rounded-md"
        disabled={disabled}
        onClick={() => {
          if (recording) stop()
          else toggle()
        }}
      >
        <Keyboard className="size-3.5" />
        {recording ? "…" : t("common.record")}
      </Button>
    </div>
  )
}
