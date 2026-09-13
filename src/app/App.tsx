import { useState } from "react"
import { AppShell, type AppTab } from "@/shared"
import { ScriptsView } from "@/domains/scripts"
import { TranslatorView } from "@/domains/translator"
import { KeybindsView } from "@/domains/keybinds"
import { SettingsView } from "@/domains/settings"

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
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      {renderPage(activeTab)}
    </AppShell>
  )
}
