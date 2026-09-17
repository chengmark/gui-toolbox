import { app, ipcMain } from 'electron'
import type {
  ProgressInfo,
  UpdateDownloadedEvent,
} from 'electron-updater'
import updater from 'electron-updater'

const autoUpdater = updater.autoUpdater

let cancellationToken = new updater.CancellationToken()
let isDownloading = false
let handlersRegistered = false

export type UpdaterCheckResult =
  | {
      status: 'available'
      currentVersion: string
      newVersion: string
    }
  | {
      status: 'not-available'
      currentVersion: string
      newVersion?: string
    }
  | {
      status: 'skipped'
      currentVersion: string
      message: string
    }
  | {
      status: 'error'
      currentVersion: string
      message: string
    }

export type UpdaterProgress = {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export function registerUpdaterIpc() {
  if (handlersRegistered) return
  handlersRegistered = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.disableWebInstaller = false
  autoUpdater.allowDowngrade = false

  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'chengmark',
      repo: 'gui-toolbox',
    })
  } catch {
    // Feed URL may already be configured via electron-builder publish config.
  }

  ipcMain.handle('updater:get-version', () => app.getVersion())

  ipcMain.handle('updater:check', async (): Promise<UpdaterCheckResult> => {
    const currentVersion = app.getVersion()

    if (!app.isPackaged) {
      return {
        status: 'skipped',
        currentVersion,
        message: 'Updates are only available in packaged builds.',
      }
    }

    try {
      const result = await autoUpdater.checkForUpdates()
      if (!result?.updateInfo) {
        return { status: 'not-available', currentVersion }
      }

      const newVersion = result.updateInfo.version
      if (result.isUpdateAvailable) {
        return { status: 'available', currentVersion, newVersion }
      }

      return { status: 'not-available', currentVersion, newVersion }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to check for updates'
      return { status: 'error', currentVersion, message }
    }
  })

  ipcMain.handle('updater:download', (event) => {
    if (isDownloading) return { started: false as const }
    isDownloading = true

    startDownload(
      (error, progressInfo) => {
        if (error) {
          isDownloading = false
          event.sender.send('updater:error', { message: error.message })
          return
        }
        if (progressInfo) {
          event.sender.send('updater:progress', {
            percent: progressInfo.percent,
            bytesPerSecond: progressInfo.bytesPerSecond,
            transferred: progressInfo.transferred,
            total: progressInfo.total,
          } satisfies UpdaterProgress)
        }
      },
      () => {
        isDownloading = false
        event.sender.send('updater:downloaded')
      },
    )

    return { started: true as const }
  })

  ipcMain.handle('updater:cancel-download', () => {
    if (!isDownloading) return
    cancellationToken.cancel()
    cancellationToken = new updater.CancellationToken()
    isDownloading = false
  })

  ipcMain.handle('updater:install', () => {
    // Silent NSIS install + relaunch — VS Code–style in-app update, no installer UI.
    autoUpdater.quitAndInstall(true, true)
  })
}

function startDownload(
  callback: (error: Error | null, info: ProgressInfo | null) => void,
  complete: (event: UpdateDownloadedEvent) => void,
) {
  const onDownloadProgress = (info: ProgressInfo) => callback(null, info)
  const onError = (error: Error) => {
    cleanup()
    callback(error, null)
  }
  const onDownloaded = (event: UpdateDownloadedEvent) => {
    cleanup()
    complete(event)
  }

  const cleanup = () => {
    autoUpdater.off('download-progress', onDownloadProgress)
    autoUpdater.off('error', onError)
    autoUpdater.off('update-downloaded', onDownloaded)
  }

  autoUpdater.on('download-progress', onDownloadProgress)
  autoUpdater.on('error', onError)
  autoUpdater.once('update-downloaded', onDownloaded)
  void autoUpdater.downloadUpdate(cancellationToken)
}
