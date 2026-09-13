import { Button } from "@/shared/ui/button"
import { KeybindRecorder } from "@/shared/keybind"
import { useI18n, type MessageKey } from "@/shared/i18n"
import {
  KEYBIND_ACTIONS,
  type TranslatorKeybindAction,
  type TranslatorSettings,
} from "@/domains/translator/model"

const ACTION_COPY: Record<
  TranslatorKeybindAction,
  { label: MessageKey; description: MessageKey }
> = {
  copyTrigger: {
    label: "translator.actionCopyTrigger",
    description: "translator.actionCopyTriggerDesc",
  },
  fieldConvert: {
    label: "translator.actionFieldConvert",
    description: "translator.actionFieldConvertDesc",
  },
  toggle: {
    label: "translator.actionToggle",
    description: "translator.actionToggleDesc",
  },
}

type TranslatorKeybindsPanelProps = {
  settings: TranslatorSettings
  disabled?: boolean
  onChange: (action: TranslatorKeybindAction, value: string) => void
  onReset: () => void
}

export function TranslatorKeybindsPanel({
  settings,
  disabled = false,
  onChange,
  onReset,
}: TranslatorKeybindsPanelProps) {
  const { t } = useI18n()

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-[13px] font-semibold text-foreground">
            {t("translator.keybindsTitle")}
          </h2>
          <p className="text-[12px] text-muted-foreground">
            {t("translator.keybindsDescription")}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          {t("translator.resetDefaults")}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {KEYBIND_ACTIONS.map((action) => {
          const copy = ACTION_COPY[action.id]
          return (
            <div
              key={action.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/80 bg-background/50 px-3 py-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-[12px] font-medium text-foreground">
                  {t(copy.label)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t(copy.description)}
                </p>
              </div>

              <div className="w-full max-w-56 sm:w-56">
                <KeybindRecorder
                  value={settings[action.id]}
                  disabled={disabled}
                  placeholder={t("common.recordShortcut")}
                  onChange={(value) => onChange(action.id, value)}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
