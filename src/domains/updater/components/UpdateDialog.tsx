import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { useI18n } from "@/shared/i18n"
import type { UpdaterPromptState } from "@/domains/updater/model"

type UpdateDialogProps = {
  open: boolean
  state: UpdaterPromptState
  onDismiss: () => void
  onUpdate: () => void
  onInstall: () => void
  onSkip: () => void
}

export function UpdateDialog({
  open,
  state,
  onDismiss,
  onUpdate,
  onInstall,
  onSkip,
}: UpdateDialogProps) {
  const { t } = useI18n()
  const busy = state.phase === "downloading"
  const percent = Math.round(state.percent)
  const canSkip = state.phase === "available"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
    >
      <DialogContent showCloseButton={!busy} className="gap-3 p-4 sm:max-w-sm">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-[13px]">
            {state.phase === "ready"
              ? t("updater.readyTitle")
              : state.phase === "error"
                ? t("updater.errorTitle")
                : t("updater.availableTitle")}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {state.phase === "ready"
              ? t("updater.readyBody", {
                  version: state.newVersion,
                })
              : state.phase === "error"
                ? t("updater.errorBody", {
                    message: state.errorMessage || t("updater.unknownError"),
                  })
                : state.phase === "downloading"
                  ? t("updater.downloadingBody", { percent })
                  : t("updater.availableBody", {
                      current: state.currentVersion,
                      latest: state.newVersion,
                    })}
          </DialogDescription>
        </DialogHeader>

        {state.phase === "downloading" ? (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-end">
          {state.phase === "ready" ? (
            <Button type="button" size="sm" onClick={onInstall}>
              {t("updater.restart")}
            </Button>
          ) : state.phase === "error" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDismiss}
              >
                {t("common.cancel")}
              </Button>
              <Button type="button" size="sm" onClick={onUpdate}>
                {t("updater.retry")}
              </Button>
            </>
          ) : (
            <>
              {canSkip ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void onSkip()}
                >
                  {t("updater.skipVersion")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDismiss}
              >
                {t("updater.later")}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={onUpdate}
              >
                {busy ? t("updater.downloading") : t("updater.update")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
