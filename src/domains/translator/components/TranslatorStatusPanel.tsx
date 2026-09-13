import { Badge } from "@/shared/ui/badge"
import { Switch } from "@/shared/ui/switch"
import { Label } from "@/shared/ui/label"
import { cn } from "@/shared/lib/utils"
import { useI18n } from "@/shared/i18n"
import {
  statusBadgeTone,
  type TranslatorStatus,
} from "@/domains/translator/model"

const TONE_CLASS: Record<ReturnType<typeof statusBadgeTone>, string> = {
  success: "border-transparent bg-[#2d6a4f] text-white hover:bg-[#2d6a4f]",
  warning: "border-transparent bg-[#b08900] text-white hover:bg-[#b08900]",
  info: "border-transparent bg-[#1d6fb8] text-white hover:bg-[#1d6fb8]",
  muted: "border-transparent bg-[#6a2d2d] text-white hover:bg-[#6a2d2d]",
}

type TranslatorStatusPanelProps = {
  status: TranslatorStatus
  onEnabledChange: (enabled: boolean) => void
}

export function TranslatorStatusPanel({
  status,
  onEnabledChange,
}: TranslatorStatusPanelProps) {
  const { t } = useI18n()
  const tone = statusBadgeTone(status)
  const badgeText = !status.enabled
    ? t("translator.badgeDisabled")
    : status.task === "pending"
      ? t("translator.badgePending")
      : status.task === "converting"
        ? t("translator.badgeConverting")
        : t("translator.badgeIdle")

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-[13px] font-semibold text-foreground">
            {t("translator.panelTitle")}
          </h2>
          <p className="text-[12px] text-muted-foreground">
            {t("translator.panelDescription")}
          </p>
        </div>
        <Badge className={cn("rounded-md px-3 py-1 text-[12px]", TONE_CLASS[tone])}>
          {badgeText}
        </Badge>
      </div>

      <div className="mt-4 grid gap-2 text-[12px] text-muted-foreground">
        <div className="flex items-center justify-between gap-3 rounded-md bg-background/60 px-3 py-2">
          <span>{t("translator.conversion")}</span>
          <span className="font-mono text-foreground">
            {status.enabled ? t("common.on") : t("common.off")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md bg-background/60 px-3 py-2">
          <span>{t("translator.task")}</span>
          <span className="font-mono text-foreground">{status.task}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md bg-background/60 px-3 py-2">
          <span>{t("translator.service")}</span>
          <span className="font-mono text-foreground">
            {status.running ? t("common.running") : t("common.stopped")}
          </span>
        </div>
        {status.lastMessage ? (
          <div className="rounded-md bg-background/60 px-3 py-2">
            <div className="mb-1 text-[11px] text-muted-foreground">
              {t("translator.lastAction")}
            </div>
            <div className="font-mono text-foreground">{status.lastMessage}</div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="space-y-0.5">
          <Label htmlFor="translator-enabled" className="text-[12px]">
            {t("translator.enable")}
          </Label>
          <p className="text-[11px] text-muted-foreground">
            {t("translator.enableHint")}
          </p>
        </div>
        <Switch
          id="translator-enabled"
          checked={status.enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>
    </section>
  )
}
