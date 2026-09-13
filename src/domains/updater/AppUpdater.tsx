import { UpdateDialog } from "@/domains/updater/components/UpdateDialog"
import { useUpdater } from "@/domains/updater/UpdaterProvider"

export function AppUpdater() {
  const updater = useUpdater()

  return (
    <UpdateDialog
      open={updater.promptOpen}
      state={updater.prompt}
      onDismiss={updater.dismissPrompt}
      onUpdate={updater.startDownload}
      onInstall={updater.install}
      onSkip={updater.skipVersion}
    />
  )
}
