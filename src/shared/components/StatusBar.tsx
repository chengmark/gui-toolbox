import type { ReactNode } from "react"
import { Download, RefreshCw, X } from "lucide-react"
import { useUpdater } from "@/domains/updater"
import { useI18n } from "@/shared/i18n"
import { cn } from "@/shared/lib/utils"

/**
 * Cursor-style footer status bar.
 * Dark chrome bar with muted text; accents via color, not VS Code blue fills.
 */
export function StatusBar() {
  const { t } = useI18n()
  const updater = useUpdater()
  const { info, prompt } = updater
  const percent = Math.round(prompt.percent)
  const version = info.currentVersion || t("settings.updatesUnknown")

  const updateActive =
    prompt.phase === "available" ||
    prompt.phase === "downloading" ||
    prompt.phase === "ready" ||
    prompt.phase === "error" ||
    info.checking

  return (
    <footer
      className={cn(
        "status-bar flex h-[22px] shrink-0 items-stretch",
        "border-t border-border bg-status-bar",
        "text-[11px] leading-none text-status-bar-foreground",
        "select-none",
      )}
      role="contentinfo"
    >
      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
        {info.checking && prompt.phase === "idle" ? (
          <StatusItem>
            <RefreshCw className="size-3 animate-spin opacity-70" aria-hidden />
            <span className="truncate">{t("statusBar.checking")}</span>
          </StatusItem>
        ) : null}

        {prompt.phase === "available" ? (
          <StatusItem tone="accent" className="gap-1.5">
            <Download className="size-3 shrink-0" aria-hidden />
            <span className="truncate">
              {t("statusBar.updateAvailable", { version: prompt.newVersion })}
            </span>
            <StatusAction onClick={() => updater.startDownload()}>
              {t("updater.update")}
            </StatusAction>
            <StatusAction onClick={() => void updater.skipVersion()}>
              {t("updater.skipVersion")}
            </StatusAction>
            <StatusIconButton
              label={t("updater.later")}
              onClick={updater.dismissPrompt}
            >
              <X className="size-3" />
            </StatusIconButton>
          </StatusItem>
        ) : null}

        {prompt.phase === "downloading" ? (
          <StatusItem tone="accent" className="min-w-0 flex-1 gap-2 pr-2">
            <Download className="size-3 shrink-0" aria-hidden />
            <span className="shrink-0">
              {t("statusBar.downloading", { percent })}
            </span>
            <div
              className="h-1 min-w-[72px] max-w-[160px] flex-1 overflow-hidden rounded-sm bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="h-full bg-status-accent transition-[width] duration-150"
                style={{ width: `${percent}%` }}
              />
            </div>
            <StatusIconButton
              label={t("common.cancel")}
              onClick={updater.dismissPrompt}
            >
              <X className="size-3" />
            </StatusIconButton>
          </StatusItem>
        ) : null}

        {prompt.phase === "ready" ? (
          <StatusItem tone="success" className="gap-1.5">
            <span className="truncate">
              {t("statusBar.ready", { version: prompt.newVersion })}
            </span>
            <StatusAction onClick={updater.install} tone="success">
              {t("updater.restart")}
            </StatusAction>
          </StatusItem>
        ) : null}

        {prompt.phase === "error" ? (
          <StatusItem tone="danger" className="gap-1.5">
            <span className="truncate">
              {t("statusBar.error", {
                message: prompt.errorMessage || t("updater.unknownError"),
              })}
            </span>
            <StatusAction onClick={updater.startDownload}>
              {t("updater.retry")}
            </StatusAction>
            <StatusIconButton
              label={t("common.cancel")}
              onClick={updater.dismissPrompt}
            >
              <X className="size-3" />
            </StatusIconButton>
          </StatusItem>
        ) : null}

        {!updateActive && info.status === "available" && info.latestVersion ? (
          <StatusItem tone="accent" className="gap-1.5">
            <Download className="size-3 shrink-0" aria-hidden />
            <span className="truncate">
              {t("statusBar.updateAvailable", { version: info.latestVersion })}
            </span>
            <StatusAction onClick={() => updater.startDownload()}>
              {t("updater.update")}
            </StatusAction>
            <StatusAction onClick={() => void updater.skipVersion()}>
              {t("updater.skipVersion")}
            </StatusAction>
          </StatusItem>
        ) : null}

        {!updateActive && info.status !== "available" ? (
          <StatusItem>
            <span className="truncate">{t("statusBar.readyIdle")}</span>
          </StatusItem>
        ) : null}
      </div>

      <div className="flex shrink-0 items-stretch">
        <StatusItem className="px-2.5 font-mono tabular-nums">
          <span title={t("statusBar.versionTitle")}>v{version}</span>
        </StatusItem>
      </div>
    </footer>
  )
}

function StatusItem({
  children,
  className,
  tone = "muted",
}: {
  children: ReactNode
  className?: string
  tone?: "muted" | "accent" | "success" | "danger"
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2",
        "hover:bg-status-bar-hover",
        tone === "accent" && "text-status-accent",
        tone === "success" && "text-status-success",
        tone === "danger" && "text-status-danger",
        className,
      )}
    >
      {children}
    </div>
  )
}

function StatusAction({
  children,
  onClick,
  tone,
}: {
  children: ReactNode
  onClick: () => void
  tone?: "accent" | "success"
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-sm px-1 py-0.5",
        "text-status-bar-foreground underline-offset-2",
        "hover:bg-status-bar-hover hover:underline",
        "transition-colors",
        tone === "success" && "text-status-success",
        !tone && "text-foreground/80",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function StatusIconButton({
  children,
  onClick,
  label,
}: {
  children: ReactNode
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "rounded-sm p-0.5 text-status-bar-foreground",
        "opacity-70 hover:bg-status-bar-hover hover:opacity-100",
        "transition-colors",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
