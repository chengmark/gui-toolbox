import { useEffect, useRef, useState } from "react"
import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { Label } from "@/shared/ui/label"
import { useI18n } from "@/shared/i18n"

type ClosePromptChoice = "tray" | "quit" | "cancel"

export function ClosePromptDialog() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [remember, setRemember] = useState(false)
  const resolvedRef = useRef(false)
  const rememberRef = useRef(false)

  useEffect(() => {
    const api = window.appBehaviorApi
    if (!api?.onClosePrompt) return
    return api.onClosePrompt(() => {
      resolvedRef.current = false
      rememberRef.current = false
      setRemember(false)
      setOpen(true)
    })
  }, [])

  async function submit(choice: ClosePromptChoice) {
    if (resolvedRef.current) return
    resolvedRef.current = true
    setOpen(false)
    await window.appBehaviorApi?.submitClosePrompt({
      choice,
      remember: choice === "cancel" ? false : rememberRef.current,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          void submit("cancel")
          return
        }
        setOpen(true)
      }}
    >
      <DialogContent showCloseButton={false} className="gap-4 p-4 sm:max-w-md">
        <DialogHeader className="gap-1.5">
          <DialogTitle className="text-[13px]">
            {t("closePrompt.title")}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {t("closePrompt.body")}
          </DialogDescription>
        </DialogHeader>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <input
            type="checkbox"
            className="mt-0.5 size-3.5 shrink-0 rounded-sm border border-input accent-primary"
            checked={remember}
            onChange={(event) => {
              const next = event.target.checked
              rememberRef.current = next
              setRemember(next)
            }}
          />
          <span className="space-y-0.5">
            <Label className="cursor-pointer text-[12px] font-medium leading-none">
              {t("closePrompt.remember")}
            </Label>
            <p className="text-[11px] text-muted-foreground">
              {t("closePrompt.rememberHint")}
            </p>
          </span>
        </label>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => void submit("tray")}
          >
            {t("closePrompt.tray")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={() => void submit("quit")}
          >
            {t("closePrompt.quit")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full"
            onClick={() => void submit("cancel")}
          >
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
