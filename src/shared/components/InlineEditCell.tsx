import { useEffect, useRef, useState } from "react"
import { cn } from "@/shared/lib/utils"

type InlineEditCellProps = {
  value: string
  onChange: (value: string) => void
  className?: string
  inputClassName?: string
  ariaLabel: string
  spellCheck?: boolean
  invalid?: boolean
}

export function InlineEditCell({
  value,
  onChange,
  className,
  inputClassName,
  ariaLabel,
  spellCheck = true,
  invalid = false,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  if (!editing) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={() => setEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            setEditing(true)
          }
        }}
        className={cn(
          "flex w-fit min-w-full items-center px-1 leading-none text-foreground outline-none",
          "focus-visible:bg-input/40",
          invalid && "text-destructive",
          className,
        )}
      >
        <span className="whitespace-nowrap leading-none">{draft || "\u00A0"}</span>
      </div>
    )
  }

  return (
    <input
      ref={inputRef}
      aria-label={ariaLabel}
      value={draft}
      spellCheck={spellCheck}
      size={Math.max(draft.length, 1)}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        onChange(next)
      }}
      onBlur={() => setEditing(false)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "Escape") {
          event.currentTarget.blur()
        }
      }}
      className={cn(
        "cursor-input h-[18px] w-full min-w-[12rem] px-1 leading-none text-foreground",
        invalid && "border-destructive text-destructive",
        inputClassName,
        className,
      )}
    />
  )
}
