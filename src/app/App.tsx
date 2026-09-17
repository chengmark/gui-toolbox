import { useState } from "react"
import { AppShell, type AppTab } from "@/shared"
import { ScriptsView } from "@/domains/scripts"
import { TranslatorView } from "@/domains/translator"
import { KeybindsView } from "@/domains/keybinds"
import { ClosePromptDialog, SettingsView } from "@/domains/settings"
import { AppUpdater } from "@/domains/updater"

function renderPage(tab: AppTab) {
  switch (tab) {
    case "scripts":
      return <ScriptsView />
    case "translator":
      return <TranslatorView />
    case "keybinds":
      return <KeybindsView />
    case "settings":
      return <SettingsView />
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("scripts")

  return (
    <>
      <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
        {renderPage(activeTab)}
      </AppShell>
      <AppUpdater />
      <ClosePromptDialog />
    </>
  )
}
