import type { ReactNode } from "react"
import { SideNav } from "@/shared/components/SideNav"
import { StatusBar } from "@/shared/components/StatusBar"
import { useI18n } from "@/shared/i18n"
import { APP_TABS, type AppTab } from "@/shared/model"

type AppShellProps = {
  activeTab: AppTab
  onTabChange: (tab: AppTab) => void
  children: ReactNode
}

export function AppShell({ activeTab, onTabChange, children }: AppShellProps) {
  const { t } = useI18n()
  const activeTabDef = APP_TABS.find((tab) => tab.id === activeTab)
  const activeLabel = activeTabDef ? t(activeTabDef.labelKey) : ""

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <header className="app-drag relative h-9 shrink-0 border-b border-border bg-titlebar">
        <div
          className="absolute inset-y-0 flex items-center gap-2 px-3"
          style={{
            left: "env(titlebar-area-x, 0px)",
            width: "env(titlebar-area-width, 100%)",
            height: "env(titlebar-area-height, 36px)",
          }}
        >
          <span className="truncate text-[12px] font-medium text-foreground">
            {t("app.name")}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="truncate text-[12px] text-muted-foreground">
            {activeLabel}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <SideNav activeTab={activeTab} onTabChange={onTabChange} />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
          {children}
        </main>
      </div>

      <StatusBar />
    </div>
  )
}
