import { UpdateDialog } from "@/domains/updater/components/UpdateDialog"
import { useAppUpdater } from "@/domains/updater/hooks/useAppUpdater"

export function AppUpdater() {
  const updater = useAppUpdater()

  return (
    <UpdateDialog
      open={updater.open}
      state={updater.state}
      onDismiss={updater.dismiss}
      onUpdate={updater.startDownload}
      onInstall={updater.install}
    />
  )
}
