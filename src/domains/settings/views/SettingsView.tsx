import { useEffect, useState } from "react"
import { FolderOpen, RotateCcw } from "lucide-react"
import { PageHeader } from "@/shared"
import { useAppConfig } from "@/domains/persistence"
import { useUpdater } from "@/domains/updater"
import { useI18n, LOCALE_OPTIONS, type Locale } from "@/shared/i18n"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Switch } from "@/shared/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"

type PathInfo = {
  filePath: string
  defaultPath: string
  isCustom: boolean
}

export function SettingsView() {
  const { t, locale, setLocale } = useI18n()
  const { reload, config, ready, setOpenAtLogin, setOpenAtLoginAsAdmin, setCloseAction } = useAppConfig()
  const updater = useUpdater()
  const [pathInfo, setPathInfo] = useState<PathInfo | null>(null)
  const [draftPath, setDraftPath] = useState("")
  const [pathBusy, setPathBusy] = useState(false)
  const [pathError, setPathError] = useState<string | null>(null)
  const [startupError, setStartupError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.appConfigApi?.getPath().then((info) => {
      if (cancelled) return
      setPathInfo(info)
      setDraftPath(info.filePath)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function applyPathInfo(info: PathInfo) {
    setPathInfo(info)
    setDraftPath(info.filePath)
    setPathError(null)
    await reload()
  }

  async function onBrowse() {
    if (!window.appConfigApi || pathBusy) return
    setPathBusy(true)
    setPathError(null)
    try {
      const info = await window.appConfigApi.choosePath()
      if (info) await applyPathInfo(info)
    } catch (error) {
      setPathError(error instanceof Error ? error.message : t("settings.pathError"))
    } finally {
      setPathBusy(false)
    }
  }

  async function onApplyPath() {
    if (!window.appConfigApi || pathBusy) return
    const next = draftPath.trim()
    if (!next) {
      setPathError(t("settings.pathEmpty"))
      return
    }
    setPathBusy(true)
    setPathError(null)
    try {
      const info = await window.appConfigApi.setPath(next)
      await applyPathInfo(info)
    } catch (error) {
      setPathError(error instanceof Error ? error.message : t("settings.pathError"))
    } finally {
      setPathBusy(false)
    }
  }

  async function onResetPath() {
    if (!window.appConfigApi || pathBusy) return
    setPathBusy(true)
    setPathError(null)
    try {
      const info = await window.appConfigApi.resetPath()
      await applyPathInfo(info)
    } catch (error) {
      setPathError(error instanceof Error ? error.message : t("settings.pathError"))
    } finally {
      setPathBusy(false)
    }
  }

  const pathDirty = pathInfo != null && draftPath.trim() !== pathInfo.filePath
  const latestLabel = updater.info.latestVersion || t("settings.updatesUnknown")
  const currentLabel = updater.info.currentVersion || t("settings.updatesUnknown")
  const canUpdate =
    (updater.info.status === "available" || updater.info.status === "skipped") &&
    Boolean(updater.info.latestVersion) &&
    updater.prompt.phase !== "downloading" &&
    updater.prompt.phase !== "ready"

  const statusText = (() => {
    switch (updater.info.status) {
      case "checking":
        return t("settings.updatesStatusChecking")
      case "up-to-date":
        return t("settings.updatesStatusUpToDate")
      case "available":
        return t("settings.updatesStatusAvailable")
      case "skipped":
        return t("settings.updatesStatusSkipped", {
          version: updater.info.latestVersion || "",
        })
      case "error":
        return updater.info.message || t("settings.updatesStatusError")
      case "unsupported":
        return t("settings.updatesStatusUnsupported")
      default:
        return updater.info.checking
          ? t("settings.updatesStatusChecking")
          : t("settings.updatesStatusIdle")
    }
  })()

  const lastCheckedLabel = (() => {
    const at = updater.info.lastCheckedAt
    if (!at) return t("settings.updatesLastCheckedNever")
    const date = new Date(at)
    if (Number.isNaN(date.getTime())) return t("settings.updatesLastCheckedNever")
    return t("settings.updatesLastChecked", {
      time: date.toLocaleString(locale),
    })
  })()

  const statusClassName =
    updater.info.status === "up-to-date"
      ? "text-foreground"
      : updater.info.status === "available"
        ? "text-foreground"
        : updater.info.status === "error"
          ? "text-destructive"
          : "text-muted-foreground"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <section className="mx-auto max-w-xl rounded-md border border-border bg-card p-4">
          <div className="space-y-1">
            <h2 className="text-[13px] font-semibold text-foreground">
              {t("settings.languageTitle")}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {t("settings.languageDescription")}
            </p>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="settings-language" className="text-[12px]">
              {t("settings.languageLabel")}
            </Label>
            <Select
              value={locale}
              onValueChange={(value) => {
                if (value) setLocale(value as Locale)
              }}
            >
              <SelectTrigger id="settings-language" className="h-9 w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALE_OPTIONS.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.nativeLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="mx-auto max-w-xl rounded-md border border-border bg-card p-4">
          <div className="space-y-1">
            <h2 className="text-[13px] font-semibold text-foreground">
              {t("settings.generalTitle")}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {t("settings.generalDescription")}
            </p>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="settings-open-at-login" className="text-[12px]">
                  {t("settings.openAtLoginLabel")}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {t("settings.openAtLoginHint")}
                </p>
              </div>
              <Switch
                id="settings-open-at-login"
                checked={Boolean(config.common.openAtLogin)}
                disabled={!ready}
                onCheckedChange={(checked) => {
                  setStartupError(null)
                  void setOpenAtLogin(checked).catch((error: unknown) => {
                    setStartupError(
                      error instanceof Error ? error.message : t("settings.openAtLoginAsAdminError"),
                    )
                  })
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label htmlFor="settings-open-at-login-admin" className="text-[12px]">
                  {t("settings.openAtLoginAsAdminLabel")}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {t("settings.openAtLoginAsAdminHint")}
                </p>
              </div>
              <Switch
                id="settings-open-at-login-admin"
                checked={Boolean(config.common.openAtLogin && config.common.openAtLoginAsAdmin)}
                disabled={!ready || !config.common.openAtLogin}
                onCheckedChange={(checked) => {
                  setStartupError(null)
                  void setOpenAtLoginAsAdmin(checked).catch((error: unknown) => {
                    setStartupError(
                      error instanceof Error ? error.message : t("settings.openAtLoginAsAdminError"),
                    )
                  })
                }}
              />
            </div>
            {startupError ? (
              <p className="text-[11px] text-destructive">{startupError}</p>
            ) : null}

            <div className="space-y-1.5 border-t border-border pt-4">
              <Label htmlFor="settings-close-action" className="text-[12px]">
                {t("settings.closeActionLabel")}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t("settings.closeActionHint")}
              </p>
              <Select
                value={config.common.closeAction ?? "ask"}
                disabled={!ready}
                onValueChange={(value) => {
                  if (value === "ask" || value === "tray" || value === "quit") {
                    void setCloseAction(value)
                  }
                }}
              >
                <SelectTrigger id="settings-close-action" className="h-9 w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ask">{t("settings.closeActionAsk")}</SelectItem>
                  <SelectItem value="tray">{t("settings.closeActionTray")}</SelectItem>
                  <SelectItem value="quit">{t("settings.closeActionQuit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-xl rounded-md border border-border bg-card p-4">
          <div className="space-y-1">
            <h2 className="text-[13px] font-semibold text-foreground">
              {t("settings.updatesTitle")}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {t("settings.updatesDescription")}
            </p>
          </div>

          <dl className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-muted-foreground">{t("settings.updatesCurrent")}</dt>
              <dd className="font-mono text-foreground">{currentLabel}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-muted-foreground">{t("settings.updatesLatest")}</dt>
              <dd className="font-mono text-foreground">{latestLabel}</dd>
            </div>
          </dl>

          <div className="mt-3 space-y-1">
            <p className={`text-[12px] ${statusClassName}`}>{statusText}</p>
            <p className="text-[11px] text-muted-foreground">{lastCheckedLabel}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={updater.info.checking || updater.prompt.phase === "downloading"}
              onClick={() => void updater.checkNow()}
            >
              {updater.info.checking
                ? t("settings.updatesStatusChecking")
                : t("settings.updatesCheck")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canUpdate || updater.info.checking}
              onClick={() => updater.startDownload()}
            >
              {t("settings.updatesUpdate")}
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-xl rounded-md border border-border bg-card p-4">
          <div className="space-y-1">
            <h2 className="text-[13px] font-semibold text-foreground">
              {t("settings.pathTitle")}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {t("settings.pathDescription")}
            </p>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label htmlFor="settings-file-path" className="text-[12px]">
              {t("settings.pathLabel")}
            </Label>
            <Input
              id="settings-file-path"
              value={draftPath}
              spellCheck={false}
              disabled={pathBusy || pathInfo == null}
              className="h-9 font-mono text-[12px]"
              onChange={(event) => setDraftPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void onApplyPath()
              }}
            />
            {pathInfo?.isCustom ? (
              <p className="text-[11px] text-muted-foreground">
                {t("settings.pathCustomHint", { path: pathInfo.defaultPath })}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {t("settings.pathDefaultHint")}
              </p>
            )}
            {pathError ? (
              <p className="text-[11px] text-destructive">{pathError}</p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pathBusy || pathInfo == null}
              onClick={() => void onBrowse()}
            >
              <FolderOpen className="size-3.5" />
              {t("settings.pathBrowse")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pathBusy || !pathDirty}
              onClick={() => void onApplyPath()}
            >
              {t("settings.pathApply")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pathBusy || pathInfo == null || !pathInfo.isCustom}
              onClick={() => void onResetPath()}
            >
              <RotateCcw className="size-3.5" />
              {t("settings.pathReset")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
