import { useEffect, useState } from "react"
import {
  FileCode2,
  Keyboard,
  Languages,
  Settings,
  type LucideIcon,
} from "lucide-react"
import { useI18n } from "@/shared/i18n"
import { cn } from "@/shared/lib/utils"
import { APP_TABS, type AppTab } from "@/shared/model"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip"

const TAB_ICONS: Record<AppTab, LucideIcon> = {
  scripts: FileCode2,
  translator: Languages,
  keybinds: Keyboard,
  settings: Settings,
}

/** Expanded nav (icon + label) at this width and above. */
const EXPANDED_NAV_QUERY = "(min-width: 1024px)"

function useExpandedNav() {
  const [expanded, setExpanded] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(EXPANDED_NAV_QUERY).matches
      : false,
  )

  useEffect(() => {
    const media = window.matchMedia(EXPANDED_NAV_QUERY)
    const onChange = () => setExpanded(media.matches)
    onChange()
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  return expanded
}

type SideNavProps = {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
}

export function SideNav({ activeTab, onTabChange }: SideNavProps) {
  const expanded = useExpandedNav()
  const { t } = useI18n()

  return (
    <TooltipProvider delayDuration={0}>
      <nav
        aria-label={t("app.featuresNav")}
        className={cn(
          "flex shrink-0 flex-col gap-1 border-r border-sidebar-border bg-activity py-2 transition-[width] duration-200",
          expanded ? "w-44 items-stretch px-2" : "w-12 items-center",
        )}
      >
        {APP_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.id]
          const active = activeTab === tab.id
          const label = t(tab.labelKey)

          const button = (
            <button
              type="button"
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex h-10 items-center rounded-md text-muted-foreground transition-colors",
                "hover:bg-sidebar-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                expanded
                  ? "w-full gap-2.5 px-2.5 text-left"
                  : "size-10 justify-center",
                active && "bg-sidebar-accent text-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
              )}
              <Icon className="size-[18px] shrink-0" strokeWidth={1.75} />
              {expanded ? (
                <span className="truncate text-[12px] font-medium leading-none">
                  {label}
                </span>
              ) : null}
            </button>
          )

          if (expanded) {
            return <div key={tab.id}>{button}</div>
          }

          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </TooltipProvider>
  )
}
