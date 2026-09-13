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
import type { PendingDelete } from "@/domains/scripts/model"

type DeleteScriptDialogProps = {
  pending: PendingDelete | null
  deleting: boolean
  onOpenChange: (open: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteScriptDialog({
  pending,
  deleting,
  onOpenChange,
  onCancel,
  onConfirm,
}: DeleteScriptDialogProps) {
  const { t } = useI18n()
  const name = pending?.name || pending?.filename || ""
  const filename = pending?.filename || ""

  return (
    <Dialog open={pending !== null} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-3 p-4 sm:max-w-sm">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-[13px]">{t("scripts.deleteTitle")}</DialogTitle>
          <DialogDescription className="text-[12px]">
            {t("scripts.deleteBody", { name, filename })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deleting}
            onClick={onCancel}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? t("common.deleting") : t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
