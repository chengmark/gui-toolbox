import { useEffect, useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible"
import { cn } from "@/shared/lib/utils"

export type EditorSectionTone =
  | "profile"
  | "initial"
  | "loop"
  | "background"
  | "subroutines"

type EditorCollapsibleSectionProps = {
  title: string
  description?: string
  badge?: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  tone?: EditorSectionTone
  className?: string
  children?: ReactNode
}

export function EditorCollapsibleSection({
  title,
  description,
  badge,
  actions,
  defaultOpen = true,
  tone = "profile",
  className,
  children,
}: EditorCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    setOpen(defaultOpen)
  }, [defaultOpen])

  const hasBody = children != null && children !== false

  const titleBlock = (
    <>
      <span className="editor-section-accent" aria-hidden />
      <span className="editor-section-chevron" aria-hidden>
        <ChevronDown
          className={cn(
            "size-4 transition-transform duration-200",
            (!open || !hasBody) && "-rotate-90",
            !hasBody && "opacity-35",
          )}
        />
      </span>
      <span className="editor-section-titles min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] leading-5 font-semibold tracking-tight text-foreground">
            {title}
          </span>
          {badge}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-4 text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </>
  )

  return (
    <div className={cn("block w-full", className)}>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className={cn("editor-section", `editor-section--${tone}`)}
      >
        <div className="editor-section-header-row">
          {hasBody ? (
            <CollapsibleTrigger
              className="editor-section-header"
              aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
            >
              {titleBlock}
            </CollapsibleTrigger>
          ) : (
            <div className="editor-section-header is-static">{titleBlock}</div>
          )}

          {actions ? (
            <div className="editor-section-actions">{actions}</div>
          ) : null}
        </div>

        {hasBody ? (
          <CollapsibleContent className="editor-section-body data-[state=closed]:animate-none">
            {children}
          </CollapsibleContent>
        ) : null}
      </Collapsible>
    </div>
  )
}
