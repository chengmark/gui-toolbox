import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

type ViewTransitionProps = {
  /** Remount key — typically the active tab or nested route id. */
  viewKey: string
  children: ReactNode
  className?: string
  /** `fade` for top-level tabs; `swipe` / `swipe-out` for in-feature drill-ins. */
  variant?: "fade" | "swipe" | "swipe-out"
}

/** Shared enter/exit animation when a view mounts or leaves. */
export function ViewTransition({
  viewKey,
  children,
  className,
  variant = "fade",
}: ViewTransitionProps) {
  return (
    <div
      key={viewKey}
      className={cn(
        "h-full min-h-0",
        variant === "swipe"
          ? "view-swipe-in"
          : variant === "swipe-out"
            ? "view-swipe-out"
            : "view-fade-in",
        className,
      )}
    >
      {children}
    </div>
  )
}
